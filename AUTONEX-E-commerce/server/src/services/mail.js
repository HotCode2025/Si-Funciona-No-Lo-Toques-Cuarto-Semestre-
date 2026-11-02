import { config } from '../config.js';

/**
 * Envío de mails. Dos proveedores, según lo que haya en server/.env:
 *   - SMTP (SMTP_USER + SMTP_PASS): por ejemplo una cuenta de Gmail con contraseña de aplicación. Llega a cualquier
 *     dirección sin tener un dominio propio. Tiene prioridad.
 *   - Resend (RESEND_API_KEY), por su API HTTP. Para mandar a cualquier dirección necesita un dominio verificado.
 * Sin ninguno (desarrollo y tests) los mails no se envían: quedan en una bandeja en memoria y en el log. Un mail que
 * falla nunca rompe la operación que lo pidió (registro, compra, recuperación): se registra el error y se sigue.
 */

const bandeja = [];

/** Mails que se habrían enviado sin proveedor configurado (los usan los tests). */
export const bandejaDePrueba = () => bandeja;

/** 'smtp', 'resend' o null. */
export function proveedorMail() {
  if (config.mail.smtp.usuario && config.mail.smtp.clave) return 'smtp';
  if (config.mail.resendApiKey) return 'resend';
  return null;
}

/**
 * Remitente. Con SMTP tiene que ser la misma cuenta (Gmail reescribe cualquier otro): si MAIL_FROM no está o es el de
 * prueba de Resend, se usa "AUTONEX <cuenta SMTP>".
 */
export function remitente() {
  const configurado = config.mail.remitente;
  if (proveedorMail() === 'smtp' && (!configurado || /@resend\.dev>?\s*$/i.test(configurado))) {
    return `AUTONEX <${config.mail.smtp.usuario}>`;
  }
  return configurado || 'AUTONEX <onboarding@resend.dev>';
}

let transporte = null;
async function transporteSmtp() {
  if (!transporte) {
    const { default: nodemailer } = await import('nodemailer');
    const { host, puerto, usuario, clave } = config.mail.smtp;
    transporte = nodemailer.createTransport({
      host, port: puerto, secure: puerto === 465, auth: { user: usuario, pass: clave },
      pool: true, maxConnections: 2, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
    });
  }
  return transporte;
}

/** Cierra las conexiones SMTP abiertas (scripts y tests). */
export function cerrarMail() {
  transporte?.close();
  transporte = null;
}

async function enviarPorSmtp({ para, asunto, html, texto, idempotencia }, log) {
  try {
    const t = await transporteSmtp();
    const info = await t.sendMail({
      from: remitente(),
      to: para,
      subject: asunto,
      html,
      text: texto,
      ...(config.mail.responderA ? { replyTo: config.mail.responderA } : {}),
      ...(idempotencia ? { headers: { 'X-Entity-Ref-ID': idempotencia } } : {}),
    });
    return { enviado: true, id: info.messageId };
  } catch (error) {
    const pista = /535|Username and Password not accepted|Invalid login/i.test(error.message)
      ? ' (revisá SMTP_USER y SMTP_PASS: en Gmail hace falta una contraseña de aplicación)' : '';
    log.error?.(`No se pudo enviar el mail "${asunto}" para ${para} por SMTP: ${error.message}${pista}`);
    return { enviado: false, error: error.message };
  }
}

async function enviarPorResend({ para, asunto, html, texto, idempotencia }, log) {
  try {
    const respuesta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.mail.resendApiKey}`,
        'Content-Type': 'application/json',
        // Evita mails duplicados si el mismo envío se reintenta (Resend la guarda 24 horas)
        ...(idempotencia ? { 'Idempotency-Key': idempotencia } : {}),
      },
      body: JSON.stringify({
        from: remitente(),
        to: [para],
        subject: asunto,
        html,
        text: texto,
        ...(config.mail.responderA ? { reply_to: config.mail.responderA } : {}),
      }),
      signal: AbortSignal.timeout(10000),
    });
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) {
      log.error?.(`Resend rechazó el mail "${asunto}" para ${para}: ${respuesta.status} ${datos.message || ''}`);
      return { enviado: false, error: datos.message || `HTTP ${respuesta.status}` };
    }
    return { enviado: true, id: datos.id };
  } catch (error) {
    log.error?.(`No se pudo enviar el mail "${asunto}" para ${para}: ${error.message}`);
    return { enviado: false, error: error.message };
  }
}

export async function enviarMail(mail, log = console) {
  const proveedor = proveedorMail();
  if (!proveedor) {
    bandeja.push({ para: mail.para, asunto: mail.asunto, html: mail.html, texto: mail.texto });
    if (bandeja.length > 100) bandeja.shift();
    log.info?.(`Mail sin enviar (no hay proveedor de mails configurado): "${mail.asunto}" para ${mail.para}`);
    return { enviado: false };
  }
  return proveedor === 'smtp' ? enviarPorSmtp(mail, log) : enviarPorResend(mail, log);
}

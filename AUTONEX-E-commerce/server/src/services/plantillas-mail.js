import { config } from '../config.js';
import { TARIFAS } from './envios.js';

// Plantillas de los mails de AUTONEX: HTML con estilos en línea (lo que soportan los clientes de correo) y versión en texto.

const NARANJA = '#ff6a13';
const CARBON = '#0e0f11';
const GRIS = '#5f6672';
const LINEA = '#e1e4e9';

const pesos = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const precio = (valor) => pesos.format(Number(valor || 0));
const fechaHora = (valor) => new Intl.DateTimeFormat('es-AR', {
  day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires',
}).format(new Date(valor));

/** Escapa texto que viene de usuarios (nombres, productos, direcciones) antes de meterlo en el HTML. */
export const esc = (texto) => String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const urlSitio = (ruta = '') => `${config.publicUrl}${ruta}`;

function boton(texto, url) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0"><tr><td style="background:${NARANJA};border-radius:6px">
    <a href="${esc(url)}" style="display:inline-block;padding:12px 22px;color:#ffffff;font-weight:700;text-decoration:none;font-size:15px">${esc(texto)}</a>
  </td></tr></table>`;
}

function marco(titulo, contenido) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titulo)}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#1b1d21">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px"><tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden">
    <tr><td style="background:${CARBON};padding:18px 24px;border-bottom:4px solid ${NARANJA}">
      <span style="font-size:24px;font-weight:800;font-style:italic;color:#ffffff;letter-spacing:1px">AUTON<span style="color:${NARANJA}">EX</span></span>
      <div style="font-size:11px;letter-spacing:3px;color:#c9cdd3;margin-top:2px">TU MARKETPLACE DE AUTOPARTES</div>
    </td></tr>
    <tr><td style="padding:24px;font-size:15px;line-height:1.55">${contenido}</td></tr>
    <tr><td style="padding:16px 24px;border-top:1px solid ${LINEA};font-size:12px;line-height:1.5;color:${GRIS}">
      AUTONEX · <a href="${esc(urlSitio('/'))}" style="color:${GRIS}">${esc(urlSitio('/').replace(/^https?:\/\//, ''))}</a><br>
      <a href="${esc(urlSitio('/terminos'))}" style="color:${GRIS}">Términos y condiciones</a> ·
      <a href="${esc(urlSitio('/privacidad'))}" style="color:${GRIS}">Política de privacidad</a> ·
      <a href="${esc(urlSitio('/arrepentimiento'))}" style="color:${GRIS}">Botón de arrepentimiento</a>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

// ------------------------------------------------------------------------------------------- cuenta

export function mailVerificacion({ nombre, enlace }) {
  return {
    asunto: 'Confirmá tu email en AUTONEX',
    html: marco('Confirmá tu email', `
      <h1 style="font-size:22px;margin:0 0 12px">¡Hola, ${esc(nombre)}!</h1>
      <p style="margin:0 0 8px">Gracias por crear tu cuenta en AUTONEX. Para terminar, confirmá que este email es tuyo:</p>
      ${boton('Confirmar mi email', enlace)}
      <p style="margin:0 0 8px;color:${GRIS};font-size:13px">El link vence en 7 días. Si no creaste una cuenta en AUTONEX, ignorá este mail.</p>
      <p style="margin:0;color:${GRIS};font-size:12px;word-break:break-all">Si el botón no funciona, copiá este link: ${esc(enlace)}</p>`),
    texto: `¡Hola, ${nombre}!\n\nGracias por crear tu cuenta en AUTONEX. Confirmá tu email con este link (vence en 7 días):\n${enlace}\n\nSi no creaste una cuenta en AUTONEX, ignorá este mail.`,
  };
}

export function mailRecuperacion({ nombre, enlace }) {
  return {
    asunto: 'Restablecé tu contraseña de AUTONEX',
    html: marco('Restablecé tu contraseña', `
      <h1 style="font-size:22px;margin:0 0 12px">Hola, ${esc(nombre)}</h1>
      <p style="margin:0 0 8px">Recibimos un pedido para restablecer la contraseña de tu cuenta. Para elegir una nueva, tocá el botón:</p>
      ${boton('Elegir una nueva contraseña', enlace)}
      <p style="margin:0 0 8px;color:${GRIS};font-size:13px">El link vence en 1 hora y se puede usar una sola vez. Si no pediste cambiar tu contraseña, ignorá este mail: tu cuenta sigue igual.</p>
      <p style="margin:0;color:${GRIS};font-size:12px;word-break:break-all">Si el botón no funciona, copiá este link: ${esc(enlace)}</p>`),
    texto: `Hola, ${nombre}\n\nRecibimos un pedido para restablecer la contraseña de tu cuenta de AUTONEX. Elegí una nueva con este link (vence en 1 hora, un solo uso):\n${enlace}\n\nSi no lo pediste, ignorá este mail: tu cuenta sigue igual.`,
  };
}

export function mailCuentaEliminada({ nombre, esVendedor }) {
  return {
    asunto: 'Eliminamos tu cuenta de AUTONEX',
    html: marco('Cuenta eliminada', `
      <h1 style="font-size:22px;margin:0 0 12px">Hola, ${esc(nombre)}</h1>
      <p style="margin:0 0 8px">Tal como pediste, eliminamos tu cuenta de AUTONEX${esVendedor ? ' y dimos de baja tu local: tus publicaciones ya no aparecen en el sitio' : ''}.</p>
      <p style="margin:0 0 8px">Borramos tus datos personales de la cuenta. Las compras y los pedidos que hiciste se conservan con los datos de cada compra, porque la ley exige guardarlos para las facturas, las garantías y los reclamos.</p>
      <p style="margin:0;color:${GRIS};font-size:13px">Si no fuiste vos, respondé este mail. Podés volver a crear una cuenta cuando quieras con el mismo email.</p>`),
    texto: `Hola, ${nombre}\n\nTal como pediste, eliminamos tu cuenta de AUTONEX${esVendedor ? ' y dimos de baja tu local' : ''}. Borramos tus datos personales de la cuenta; las compras y los pedidos se conservan con los datos de cada compra, como exige la ley.\n\nSi no fuiste vos, respondé este mail.`,
  };
}

// ------------------------------------------------------------------------------------------- comprobante

function entregaTexto(pedido) {
  const { envio, vendedor } = pedido;
  if (envio.metodo === 'retiro') {
    return `Retiro en el local: ${vendedor.direccion}, ${vendedor.ciudad}, ${vendedor.provincia}${vendedor.horario ? ` · ${vendedor.horario}` : ''}`;
  }
  const transportista = TARIFAS[envio.transportista]?.nombre || envio.transportista;
  return `Envío a domicilio por ${transportista}: ${envio.calle} ${envio.numero}${envio.piso_depto ? `, ${envio.piso_depto}` : ''}, `
    + `${envio.localidad}, ${envio.provincia} (${envio.codigo_postal})${envio.demora_estimada ? ` · Demora estimada: ${envio.demora_estimada}` : ''}`;
}

export function mailComprobante(compra) {
  const enlace = urlSitio(`/seguir-compra?compra=${compra.id}`);
  const pago = compra.ultimo_pago?.mp_pago_id ? compra.ultimo_pago : null;
  const pedidosHtml = compra.pedidos.map((p) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINEA};border-radius:6px;margin:0 0 12px">
      <tr><td style="padding:10px 12px;background:#f6f7f9;font-weight:700">${esc(p.vendedor.nombre_comercial)} <span style="color:${GRIS};font-weight:400;font-size:13px">· Pedido #${p.id}</span></td></tr>
      <tr><td style="padding:8px 12px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
          ${p.items.map((i) => `<tr>
            <td style="padding:4px 0">${i.cantidad} × ${esc(i.nombre)}<br><span style="color:${GRIS};font-size:12px">${esc(i.numero_pieza)} · ${esc(i.condicion)}</span></td>
            <td style="padding:4px 0 4px 12px;text-align:right;white-space:nowrap;vertical-align:top">${precio(i.subtotal)}</td></tr>`).join('')}
          <tr><td style="padding:6px 0 0;color:${GRIS};font-size:13px">${esc(entregaTexto(p))}</td>
              <td style="padding:6px 0 0 12px;text-align:right;white-space:nowrap;vertical-align:top;color:${GRIS};font-size:13px">Envío ${p.costo_envio > 0 ? precio(p.costo_envio) : 'gratis'}</td></tr>
        </table>
      </td></tr>
    </table>`).join('');

  const html = marco(`Compra #${compra.id}`, `
    <h1 style="font-size:22px;margin:0 0 6px">¡Gracias por tu compra, ${esc(compra.comprador_nombre)}!</h1>
    <p style="margin:0 0 16px">Tu pago se aprobó y cada vendedor ya recibió su pedido. Este es el comprobante de tu compra.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff1e8;border-left:4px solid ${NARANJA};margin:0 0 16px">
      <tr><td style="padding:12px 14px;font-size:14px">
        <div style="font-size:12px;font-weight:700;color:#c94f08;letter-spacing:1px">NÚMERO DE COMPRA</div>
        <div style="font-size:26px;font-weight:800">#${compra.id}</div>
        <div style="color:${GRIS}">${fechaHora(compra.pagada_en || compra.creado_en)}${pago ? ` · Mercado Pago, operación ${esc(pago.mp_pago_id)}` : ''}</div>
      </td></tr>
    </table>
    ${pedidosHtml}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;margin:4px 0 0">
      <tr><td style="color:${GRIS}">Productos</td><td style="text-align:right">${precio(compra.subtotal_productos)}</td></tr>
      <tr><td style="color:${GRIS}">Envíos</td><td style="text-align:right">${precio(compra.total_envios)}</td></tr>
      <tr><td style="font-weight:800;font-size:18px;padding-top:6px">Total</td><td style="text-align:right;font-weight:800;font-size:18px;padding-top:6px">${precio(compra.total)}</td></tr>
    </table>
    ${boton('Ver mi compra', enlace)}
    <p style="margin:0 0 8px;font-size:13px;color:${GRIS}">Para ver el estado de cada pedido y el número de seguimiento del envío, entrá a "Seguí tu compra" con el número de compra y este email${compra.usuario_id ? ', o a "Mis compras" en tu cuenta' : ''}.</p>
    <p style="margin:0 0 8px;font-size:13px;color:${GRIS}">Tenés 10 días corridos desde que recibís el producto para arrepentirte de la compra, sin costo, desde el
      <a href="${esc(urlSitio(`/arrepentimiento?compra=${compra.id}`))}" style="color:${GRIS}">Botón de arrepentimiento</a> (art. 34 de la Ley 24.240).
      Garantía legal: 6 meses para productos nuevos y 3 meses para usados.</p>
    <p style="margin:0;font-size:12px;color:${GRIS}">Este comprobante no es una factura: cada vendedor emite la suya.</p>`);

  const texto = [
    `¡Gracias por tu compra, ${compra.comprador_nombre}!`,
    `Compra #${compra.id} · ${fechaHora(compra.pagada_en || compra.creado_en)}${pago ? ` · Mercado Pago ${pago.mp_pago_id}` : ''}`,
    '',
    ...compra.pedidos.flatMap((p) => [
      `${p.vendedor.nombre_comercial} · Pedido #${p.id}`,
      ...p.items.map((i) => `  ${i.cantidad} × ${i.nombre} (${i.numero_pieza}, ${i.condicion}) · ${precio(i.subtotal)}`),
      `  ${entregaTexto(p)} · Envío ${p.costo_envio > 0 ? precio(p.costo_envio) : 'gratis'}`,
      '',
    ]),
    `Total: ${precio(compra.total)}`,
    '',
    `Seguí tu compra: ${enlace}`,
    `Botón de arrepentimiento (10 días corridos): ${urlSitio(`/arrepentimiento?compra=${compra.id}`)}`,
    'Este comprobante no es una factura: cada vendedor emite la suya.',
  ].join('\n');

  return { asunto: `Tu compra #${compra.id} en AUTONEX`, html, texto };
}

// ------------------------------------------------------------------------------------------- arrepentimiento

/** Pedido cancelado por el botón de arrepentimiento y su reintegro. */
export function mailReintegro({ compra_id: compraId, pedido_id: pedidoId, comprador_nombre: nombre, nombre_comercial: vendedor, monto, estado, mp_pago_id: pagoId, codigo }) {
  const enlace = urlSitio(`/seguir-compra?compra=${compraId}`);
  const aprobado = estado === 'aprobado';
  const reintegro = aprobado
    ? `Mercado Pago ya aprobó el reintegro de <strong>${precio(monto)}</strong> al mismo medio con el que pagaste${pagoId ? ` (operación ${esc(pagoId)})` : ''}. Según tu medio de pago puede tardar unos días en verse: con tarjeta de crédito, en el próximo resumen.`
    : `Estamos procesando el reintegro de <strong>${precio(monto)}</strong> al mismo medio con el que pagaste. Te avisamos cuando esté aprobado.`;
  return {
    asunto: `Cancelamos tu pedido #${pedidoId} y te reintegramos ${precio(monto)}`,
    html: marco(`Pedido #${pedidoId} cancelado`, `
      <h1 style="font-size:22px;margin:0 0 12px">Hola, ${esc(nombre)}</h1>
      <p style="margin:0 0 8px">${esc(vendedor)} canceló tu pedido #${pedidoId} (compra #${compraId}) por la solicitud que hiciste con el Botón de arrepentimiento${codigo ? ` (código <strong>${esc(codigo)}</strong>)` : ''}.</p>
      <p style="margin:0 0 8px">${reintegro}</p>
      ${boton('Ver mi compra', enlace)}
      <p style="margin:0;color:${GRIS};font-size:13px">El reintegro es por el total del pedido: productos y envío. Si tenés alguna duda, respondé este mail.</p>`),
    texto: `Hola, ${nombre}\n\n${vendedor} canceló tu pedido #${pedidoId} (compra #${compraId}) por tu solicitud del Botón de arrepentimiento${codigo ? ` (${codigo})` : ''}.\n\n`
      + `${aprobado ? `Mercado Pago aprobó el reintegro de ${precio(monto)} al mismo medio de pago.` : `Estamos procesando el reintegro de ${precio(monto)} al mismo medio de pago.`}\n\nVer la compra: ${enlace}`,
  };
}

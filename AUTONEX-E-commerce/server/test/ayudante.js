// Preparación de los tests: base de datos propia (autonex_test), seed y un Mercado Pago simulado.
// Nunca toca la base principal: la URL de prueba sale de TEST_DATABASE_URL o de DATABASE_URL cambiando el nombre.

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import pg from 'pg';

const RAIZ_SERVER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function urlDePrueba() {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  try {
    process.loadEnvFile(path.join(RAIZ_SERVER, '.env'));
  } catch {
    /* sin .env */
  }
  const base = new URL(process.env.DATABASE_URL || 'postgresql://localhost:5432/autonex');
  base.pathname = `/${base.pathname.replace(/^\//, '') || 'autonex'}_test`;
  return base.toString();
}

export const SECRETO_WEBHOOK = 'secreto-de-prueba';
/** Contraseña de las cuentas de demo en la base de prueba (autonex_test): solo existe para los tests. */
export const CLAVE_DEMO_TESTS = 'clave-solo-para-tests';

export async function prepararEntorno() {
  const url = urlDePrueba();
  const nombre = new URL(url).pathname.replace(/^\//, '');
  if (!nombre.endsWith('_test')) throw new Error(`Por seguridad los tests solo corren sobre una base *_test (recibí "${nombre}")`);

  // Crea la base de prueba si no existe
  const admin = new URL(url);
  admin.pathname = '/postgres';
  const cliente = new pg.Client({ connectionString: admin.toString() });
  await cliente.connect();
  const { rowCount } = await cliente.query('SELECT 1 FROM pg_database WHERE datname = $1', [nombre]);
  if (!rowCount) await cliente.query(`CREATE DATABASE "${nombre}"`);
  await cliente.end();

  Object.assign(process.env, {
    DATABASE_URL: url,
    NODE_ENV: 'test',
    BASE_PATH: '',
    SERVE_FRONTEND: 'false',
    PUBLIC_URL: 'https://autonex.test',
    WEBHOOK_BASE_URL: '',
    MP_ACCESS_TOKEN: '',
    MP_WEBHOOK_SECRET: SECRETO_WEBHOOK,
    JWT_SECRET: 'jwt-de-prueba',
    SEED_PASSWORD: CLAVE_DEMO_TESTS,
    // Los tests nunca mandan mails de verdad: quedan en la bandeja de prueba de services/mail.js
    RESEND_API_KEY: '',
    SMTP_USER: '',
    SMTP_PASS: '',
    MAIL_FROM: 'AUTONEX <no-responder@autonex.test>',
  });

  // --muestra: solo las marcas de la demo (el seed completo con las 15.000 versiones del DNRPA tarda varios minutos)
  execFileSync(process.execPath, ['db/seed.js', '--muestra'], { cwd: RAIZ_SERVER, env: { ...process.env, AUTONEX_SEED_SILENCIO: '1' }, stdio: 'pipe' });
}

/** Mercado Pago simulado: guarda las preferencias creadas y devuelve los pagos que el test registre. */
export function crearMercadoPagoFalso() {
  return {
    preferencias: [],
    pagos: new Map(),
    async crearPreferencia(body) {
      this.preferencias.push(body);
      const n = this.preferencias.length;
      return { id: `pref-test-${n}`, init_point: `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-test-${n}` };
    },
    async obtenerPago(id) {
      const pago = this.pagos.get(String(id));
      if (!pago) throw Object.assign(new Error('Pago inexistente'), { statusCode: 404 });
      return pago;
    },
    async buscarPagos(referencia) {
      return [...this.pagos.values()].filter((p) => p.external_reference === String(referencia)).reverse();
    },
    reembolsos: [],
    falloReembolso: null,
    async reembolsar({ pagoId, monto, idempotencia }) {
      if (this.falloReembolso) throw new Error(this.falloReembolso);
      const previo = this.reembolsos.find((r) => r.idempotencia === idempotencia);
      if (previo) return previo.respuesta;
      const respuesta = { id: 7000 + this.reembolsos.length, status: 'approved', amount: monto };
      this.reembolsos.push({ pagoId: String(pagoId), monto, idempotencia, respuesta });
      return respuesta;
    },
    registrarPago({ id, compraId, estado = 'approved', monto, detalle = 'accredited' }) {
      const pago = {
        id, status: estado, status_detail: detalle, external_reference: String(compraId),
        transaction_amount: monto, payment_method_id: 'master',
      };
      this.pagos.set(String(id), pago);
      return pago;
    },
  };
}

/** Firma x-signature igual que Mercado Pago (HMAC-SHA256 de "id:..;request-id:..;ts:..;"). */
export function firmarWebhook(dataId, requestId = 'req-1', ts = String(Date.now())) {
  const v1 = crypto.createHmac('sha256', SECRETO_WEBHOOK).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest('hex');
  return { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': requestId };
}

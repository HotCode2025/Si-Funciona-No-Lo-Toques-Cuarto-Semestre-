import { fileURLToPath } from 'node:url';
import path from 'node:path';

const aqui = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ_SERVER = path.resolve(aqui, '..');
export const RAIZ_PROYECTO = path.resolve(RAIZ_SERVER, '..');

// Carga server/.env si existe (Node 20.12+). Las variables ya definidas en el entorno tienen prioridad.
try {
  process.loadEnvFile(path.join(RAIZ_SERVER, '.env'));
} catch {
  /* sin .env: se usan las variables del entorno */
}

const env = process.env;

/** "/autonex/" -> "/autonex"; "/" o vacío -> "" */
function normalizarBase(valor) {
  const limpio = (valor || '').trim().replace(/\/+$/, '');
  if (!limpio) return '';
  return limpio.startsWith('/') ? limpio : `/${limpio}`;
}

const puerto = Number(env.PORT || 3200);

export const config = {
  entorno: env.NODE_ENV || 'development',
  host: env.HOST || '127.0.0.1',
  puerto,
  // Prefijo bajo el que vive toda la app (útil detrás de nginx en /autonex). Vacío = raíz.
  basePath: normalizarBase(env.BASE_PATH),
  databaseUrl: env.DATABASE_URL || 'postgresql://localhost:5432/autonex',
  jwtSecret: env.JWT_SECRET || 'autonex-secreto-de-desarrollo-cambiar',
  jwtExpira: env.JWT_EXPIRA || '7d',
  // URL pública del frontend (sin barra final), para las back_urls de Mercado Pago.
  publicUrl: (env.PUBLIC_URL || `http://localhost:5173`).replace(/\/+$/, ''),
  // URL pública del backend para el webhook. Si queda vacía se usa PUBLIC_URL.
  webhookBaseUrl: (env.WEBHOOK_BASE_URL || '').replace(/\/+$/, ''),
  // Sirve el build del frontend (client/dist) desde Fastify en producción.
  servirFrontend: env.SERVE_FRONTEND === 'true',
  clienteDist: path.join(RAIZ_PROYECTO, 'client', 'dist'),
  clientePublic: path.join(RAIZ_PROYECTO, 'client', 'public'),
  // Titular del sitio (Ley 24.240 y comercio electrónico): se muestra en el pie y en los términos y condiciones
  operador: {
    razonSocial: (env.OPERADOR_RAZON_SOCIAL || '').trim(),
    cuit: (env.OPERADOR_CUIT || '').trim(),
    domicilio: (env.OPERADOR_DOMICILIO || '').trim(),
    email: (env.OPERADOR_EMAIL || '').trim(),
  },
  // Cuentas nuevas: hasta confirmar el email no pueden ingresar (EXIGIR_EMAIL_CONFIRMADO=false lo desactiva)
  exigirEmailConfirmado: env.EXIGIR_EMAIL_CONFIRMADO !== 'false',
  // Mails: confirmación de email, recuperación de contraseña, comprobante de compra y reintegros.
  // Por SMTP (por ejemplo Gmail con contraseña de aplicación, tiene prioridad) o por Resend (necesita dominio verificado).
  mail: {
    smtp: {
      host: (env.SMTP_HOST || 'smtp.gmail.com').trim(),
      puerto: Number(env.SMTP_PORT) || 465,
      usuario: (env.SMTP_USER || '').trim(),
      // Google muestra la contraseña de aplicación con espacios ("abcd efgh ijkl mnop"): se ignoran
      clave: (env.SMTP_PASS || '').replace(/\s+/g, ''),
    },
    resendApiKey: env.RESEND_API_KEY || '',
    // Con SMTP, si queda vacío se usa "AUTONEX <SMTP_USER>". Con Resend sin dominio verificado: onboarding@resend.dev
    remitente: (env.MAIL_FROM || '').trim(),
    responderA: (env.MAIL_REPLY_TO || '').trim(),
  },
  mercadoPago: {
    accessToken: env.MP_ACCESS_TOKEN || '',
    webhookSecret: env.MP_WEBHOOK_SECRET || '',
    statementDescriptor: 'AUTONEX',
  },
};

export function mercadoPagoConfigurado() {
  return Boolean(config.mercadoPago.accessToken);
}

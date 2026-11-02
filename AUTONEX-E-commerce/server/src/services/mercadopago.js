// Cliente de Mercado Pago (SDK oficial para Node, Checkout Pro).
// El access token se lee SOLO de server/.env (MP_ACCESS_TOKEN); nunca llega al frontend.
//
// La app usa este objeto a través de `app.mp`, así los tests pueden reemplazarlo por uno simulado.

import https from 'node:https';
import { MercadoPagoConfig, Payment, PaymentRefund, Preference } from 'mercadopago';
import { config } from '../config.js';
import { ErrorApi } from '../errores.js';

let cliente = null;

function obtenerCliente() {
  if (!config.mercadoPago.accessToken) {
    throw new ErrorApi(503, 'Mercado Pago no está configurado en el servidor (falta MP_ACCESS_TOKEN en server/.env).');
  }
  cliente ??= new MercadoPagoConfig({
    accessToken: config.mercadoPago.accessToken,
    // Conexiones sin keep-alive: el node-fetch 2 que usa el SDK corta las respuestas con Node 20
    // ("Invalid response body… Premature close") cuando reutiliza la conexión
    options: { timeout: 15000, agent: new https.Agent({ keepAlive: false }) },
  });
  return cliente;
}

/** Las credenciales TEST- usan el checkout de sandbox; las de usuarios de prueba (APP_USR-) el normal. */
function esTokenDePrueba() {
  return config.mercadoPago.accessToken.startsWith('TEST-');
}

function mensajeDeError(error) {
  const causa = Array.isArray(error?.cause) ? error.cause.map((c) => c.description || c.code).filter(Boolean).join('; ') : '';
  return causa || error?.message || error?.error || 'error desconocido';
}

function envolver(error, accion) {
  if (error instanceof ErrorApi) return error;
  return new ErrorApi(502, `Mercado Pago no pudo ${accion}: ${String(mensajeDeError(error)).replace(/\.+$/, '')}.`);
}

export const mercadoPagoReal = {
  async crearPreferencia(body) {
    const preferencia = new Preference(obtenerCliente());
    let respuesta;
    try {
      respuesta = await preferencia.create({ body });
    } catch (error) {
      // Mercado Pago rechaza auto_return cuando la back_url no es pública (por ejemplo http://localhost).
      // En ese caso se crea igual, sin redirección automática: el comprador vuelve con el botón "Volver al sitio".
      if (body.auto_return && /auto_return/i.test(JSON.stringify(error ?? {}) + mensajeDeError(error))) {
        const { auto_return: _omitido, ...sinAutoReturn } = body;
        try {
          respuesta = await preferencia.create({ body: sinAutoReturn });
        } catch (error2) {
          throw envolver(error2, 'crear la preferencia de pago');
        }
      } else {
        throw envolver(error, 'crear la preferencia de pago');
      }
    }
    const urlPago = esTokenDePrueba() ? (respuesta.sandbox_init_point || respuesta.init_point) : respuesta.init_point;
    return { id: respuesta.id, init_point: urlPago };
  },

  async obtenerPago(pagoId) {
    try {
      return await new Payment(obtenerCliente()).get({ id: String(pagoId) });
    } catch (error) {
      // Un pago inexistente (por ejemplo, el de "Simular notificación" del panel de Mercado Pago) no es una falla
      if (error?.status === 404 || error?.statusCode === 404) throw new ErrorApi(404, `Mercado Pago no tiene un pago ${pagoId}.`);
      throw envolver(error, `consultar el pago ${pagoId}`);
    }
  },

  /** Reintegro parcial o total de un pago (POST /v1/payments/:id/refunds). */
  async reembolsar({ pagoId, monto, idempotencia }) {
    try {
      const reintegro = await new PaymentRefund(obtenerCliente()).create({
        payment_id: String(pagoId), body: { amount: monto }, requestOptions: { idempotencyKey: idempotencia },
      });
      return { id: reintegro.id, status: reintegro.status, amount: reintegro.amount };
    } catch (error) {
      throw envolver(error, `reintegrar el pago ${pagoId}`);
    }
  },

  async buscarPagos(externalReference) {
    try {
      const respuesta = await new Payment(obtenerCliente()).search({
        options: { external_reference: String(externalReference), sort: 'date_created', criteria: 'desc' },
      });
      return respuesta.results || [];
    } catch (error) {
      throw envolver(error, 'buscar los pagos de la compra');
    }
  },
};

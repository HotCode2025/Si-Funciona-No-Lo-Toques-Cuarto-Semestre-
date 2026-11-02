import { ErrorApi } from '../errores.js';
import { obtenerCompra, puedeVerCompra } from '../services/compras.js';
import { codigoDeCompra } from './compras.js';
import { firmaWebhookValida, procesarPago } from '../services/pagos.js';

export default async function rutasPagos(app) {
  // Cuando el comprador vuelve de Mercado Pago (back_urls) el frontend manda el payment_id:
  // el backend consulta el pago a Mercado Pago (no confía en el estado que viene en la URL) y actualiza la compra.
  // El pago se confirma siempre (el dato sale de Mercado Pago, igual que en el webhook), pero el detalle de la compra
  // solo lo ve su dueño: con sesión o, para una compra sin cuenta, con su código de acceso (header X-Codigo-Compra).
  // Así quien paga desde otro navegador (por ejemplo, la app de Mercado Pago) ve el pago aprobado y busca su compra.
  app.post('/pagos/confirmar', {
    onRequest: app.autenticarOpcional,
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['payment_id'],
        properties: { payment_id: { type: 'string', pattern: '^[0-9]{1,20}$' } },
      },
    },
  }, async (request) => {
    const pago = await app.mp.obtenerPago(request.body.payment_id);
    const compraId = Number(pago.external_reference);
    if (!compraId) throw new ErrorApi(404, 'Ese pago no corresponde a ninguna compra de AUTONEX.');
    const resultado = await procesarPago(pago, request.log);
    const puedeVer = await puedeVerCompra(compraId, request.user?.id, codigoDeCompra(request));
    return {
      pago: { id: String(pago.id), estado: pago.status, estado_detalle: pago.status_detail ?? null },
      resultado,
      compra_id: compraId,
      compra: puedeVer ? await obtenerCompra(compraId) : null,
    };
  });

  // Webhook (notification_url) de Mercado Pago. Requiere una URL pública (dominio propio o ngrok).
  // Responde 200 para que Mercado Pago no reintente; si algo falla responde 500 y Mercado Pago reintenta.
  app.post('/pagos/webhook', async (request, reply) => {
    const q = request.query || {};
    const cuerpo = request.body && typeof request.body === 'object' ? request.body : {};
    const tipo = cuerpo.type || q.type || q.topic;
    const dataId = cuerpo.data?.id || q['data.id'] || q.id;

    if (!firmaWebhookValida(request.headers, q['data.id'] || cuerpo.data?.id)) {
      request.log.warn('Webhook de Mercado Pago con firma inválida');
      return reply.status(401).send({ ok: false, mensaje: 'Firma inválida.' });
    }
    if (tipo !== 'payment' || !dataId) return { ok: true, ignorado: true };

    try {
      const pago = await app.mp.obtenerPago(dataId);
      const resultado = await procesarPago(pago, request.log);
      request.log.info({ resultado }, `Webhook: pago ${dataId} (${pago.status})`);
      return { ok: true, ...resultado };
    } catch (error) {
      // El pago no existe en Mercado Pago (la notificación de prueba del panel usa uno inventado): reintentar no
      // sirve de nada, así que se responde 200
      if (error.statusCode === 404) {
        request.log.info(`Webhook: el pago ${dataId} no existe en Mercado Pago (notificación de prueba), se ignora`);
        return { ok: true, ignorado: 'pago inexistente' };
      }
      request.log.error({ err: error }, `Webhook: no se pudo procesar el pago ${dataId}`);
      return reply.status(500).send({ ok: false });
    }
  });

  // Mercado Pago a veces valida la URL con un GET.
  app.get('/pagos/webhook', async () => ({ ok: true }));
}

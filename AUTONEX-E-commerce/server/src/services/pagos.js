import crypto from 'node:crypto';
import { config } from '../config.js';
import { transaccion } from '../db.js';
import { obtenerCompra } from './compras.js';
import { enviarMail } from './mail.js';
import { mailComprobante } from './plantillas-mail.js';

const RECHAZADOS = new Set(['rejected', 'cancelled']);

/**
 * Aplica a la base el estado de un pago de Mercado Pago (el objeto que devuelve GET /v1/payments/:id).
 * Es idempotente: puede llamarse varias veces con el mismo pago (vuelta del comprador + webhook).
 *
 * - approved: la compra pasa a "pagada", los pedidos a "pagado" y se descuenta el stock. Todo en una transacción.
 * - rejected / cancelled: la compra queda "pago_rechazado" (el comprador puede reintentar).
 * - pending / in_process / authorized: la compra sigue "pendiente_pago".
 */
export async function procesarPago(pago, log = console) {
  const resultado = await aplicarPago(pago, log);
  if (resultado.compra_estado === 'pagada' && resultado.pago_estado === 'approved' && !resultado.ya_procesado && !resultado.error) {
    await enviarComprobante(resultado.compra_id, log);
  }
  return resultado;
}

/** Manda el comprobante de una compra recién pagada al email del comprador. Nunca corta el procesamiento del pago. */
export async function enviarComprobante(compraId, log = console) {
  try {
    const compra = await obtenerCompra(compraId);
    if (!compra) return;
    await enviarMail({ para: compra.comprador_email, ...mailComprobante(compra), idempotencia: `comprobante-${compraId}` }, log);
  } catch (error) {
    log.error?.(`No se pudo armar el comprobante de la compra ${compraId}: ${error.message}`);
  }
}

async function aplicarPago(pago, log) {
  const compraId = Number(pago?.external_reference);
  if (!Number.isInteger(compraId) || compraId <= 0) return { ignorado: true, motivo: 'sin external_reference' };

  return transaccion(async (db) => {
    const { rows: [compra] } = await db.query('SELECT id, estado, total FROM compras WHERE id = $1 FOR UPDATE', [compraId]);
    if (!compra) return { ignorado: true, motivo: 'compra inexistente' };

    const { rows: [previo] } = await db.query('SELECT estado FROM pagos WHERE mp_pago_id = $1', [String(pago.id)]);
    await registrarPago(db, compraId, pago);

    if (compra.estado === 'pagada') {
      return { compra_id: compraId, compra_estado: 'pagada', pago_estado: pago.status, ya_procesado: true };
    }
    if (compra.estado === 'cancelada') {
      if (pago.status === 'approved' && previo?.estado !== 'approved') {
        log.error?.(`Pago ${pago.id} aprobado para la compra ${compraId}, que está cancelada: hay que devolverlo.`);
      }
      return { compra_id: compraId, compra_estado: 'cancelada', pago_estado: pago.status, error: 'compra_cancelada' };
    }

    if (pago.status === 'approved') {
      // Control del monto: nunca se confirma una compra con un pago menor al total calculado por el backend.
      if (Number(pago.transaction_amount) + 0.5 < Number(compra.total)) {
        log.warn?.(`Pago ${pago.id} de $${pago.transaction_amount} no cubre el total $${compra.total} de la compra ${compraId}`);
        return { compra_id: compraId, compra_estado: compra.estado, pago_estado: pago.status, error: 'monto_insuficiente' };
      }

      const { rows: items } = await db.query(`
        SELECT pi.publicacion_id, pi.cantidad, pi.pedido_id, pi.nombre_producto
          FROM pedido_items pi JOIN pedidos pe ON pe.id = pi.pedido_id
         WHERE pe.compra_id = $1 ORDER BY pi.publicacion_id`, [compraId]);
      const ids = [...new Set(items.map((i) => i.publicacion_id))];
      // Bloquea las publicaciones en orden de id para evitar deadlocks entre pagos simultáneos.
      const { rows: stocks } = await db.query(
        'SELECT id, stock FROM publicaciones WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE', [ids]);
      const stockActual = new Map(stocks.map((s) => [s.id, s.stock]));

      for (const item of items) {
        const disponible = stockActual.get(item.publicacion_id) ?? 0;
        if (disponible < item.cantidad) {
          // Se vendió en otra compra mientras esta esperaba el pago: queda registrado para que el vendedor lo resuelva.
          await db.query(
            `UPDATE pedidos SET nota = concat_ws(' ', nota, $2::text) WHERE id = $1`,
            [item.pedido_id, `Atención: al confirmarse el pago había ${disponible} de ${item.cantidad} unidades de "${item.nombre_producto}". Coordinar con el comprador.`],
          );
        }
        const nuevo = Math.max(disponible - item.cantidad, 0);
        stockActual.set(item.publicacion_id, nuevo);
        await db.query('UPDATE publicaciones SET stock = $2, actualizado_en = now() WHERE id = $1', [item.publicacion_id, nuevo]);
      }

      await db.query(
        "UPDATE pedidos SET estado = 'pagado', actualizado_en = now() WHERE compra_id = $1 AND estado = 'pendiente_pago'",
        [compraId]);
      await db.query(
        "UPDATE compras SET estado = 'pagada', pagada_en = now(), actualizado_en = now() WHERE id = $1", [compraId]);
      return { compra_id: compraId, compra_estado: 'pagada', pago_estado: pago.status };
    }

    const nuevoEstado = RECHAZADOS.has(pago.status) ? 'pago_rechazado' : 'pendiente_pago';
    if (compra.estado !== nuevoEstado && compra.estado !== 'cancelada') {
      await db.query('UPDATE compras SET estado = $2, actualizado_en = now() WHERE id = $1', [compraId, nuevoEstado]);
    }
    return { compra_id: compraId, compra_estado: nuevoEstado, pago_estado: pago.status };
  });
}

/** Guarda o actualiza la fila del pago (un pago de MP = una fila; la preferencia sin pago se completa). */
async function registrarPago(db, compraId, pago) {
  const mpId = String(pago.id);
  const valores = [pago.status, pago.status_detail ?? null, pago.payment_method_id ?? null, pago.transaction_amount ?? 0];
  const existente = await db.query('SELECT id FROM pagos WHERE mp_pago_id = $1', [mpId]);
  if (existente.rowCount) {
    await db.query(
      `UPDATE pagos SET estado = $2, estado_detalle = $3, medio_pago = $4, monto = $5, actualizado_en = now() WHERE id = $1`,
      [existente.rows[0].id, ...valores]);
    return;
  }
  const libre = await db.query(
    'SELECT id FROM pagos WHERE compra_id = $1 AND mp_pago_id IS NULL ORDER BY id DESC LIMIT 1', [compraId]);
  if (libre.rowCount) {
    await db.query(
      `UPDATE pagos SET mp_pago_id = $6, estado = $2, estado_detalle = $3, medio_pago = $4, monto = $5, actualizado_en = now()
        WHERE id = $1`, [libre.rows[0].id, ...valores, mpId]);
    return;
  }
  const { rows: [ultima] } = await db.query(
    'SELECT preferencia_id FROM pagos WHERE compra_id = $1 ORDER BY id DESC LIMIT 1', [compraId]);
  await db.query(
    `INSERT INTO pagos (compra_id, preferencia_id, mp_pago_id, estado, estado_detalle, medio_pago, monto)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [compraId, ultima?.preferencia_id || 'sin-preferencia', mpId, ...valores]);
}

/**
 * Valida la firma x-signature de las notificaciones de Mercado Pago.
 * Plantilla: "id:{data.id};request-id:{x-request-id};ts:{ts};" firmada con HMAC-SHA256 y la clave secreta.
 * Si no hay MP_WEBHOOK_SECRET configurado, no se valida (modo demo).
 */
export function firmaWebhookValida(headers, dataId) {
  const secreto = config.mercadoPago.webhookSecret;
  if (!secreto) return true;
  const firma = headers['x-signature'];
  const requestId = headers['x-request-id'];
  if (!firma) return false;
  const partes = Object.fromEntries(firma.split(',').map((p) => p.trim().split('=')));
  if (!partes.ts || !partes.v1) return false;
  const id = /^[a-z0-9]+$/i.test(String(dataId)) ? String(dataId).toLowerCase() : String(dataId);
  let plantilla = '';
  if (dataId) plantilla += `id:${id};`;
  if (requestId) plantilla += `request-id:${requestId};`;
  plantilla += `ts:${partes.ts};`;
  const esperado = crypto.createHmac('sha256', secreto).update(plantilla).digest('hex');
  const a = Buffer.from(esperado);
  const b = Buffer.from(partes.v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

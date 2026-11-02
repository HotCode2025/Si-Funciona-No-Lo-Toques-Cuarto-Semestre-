// Botón de arrepentimiento, lado del vendedor: con una solicitud abierta el pedido no se puede avanzar. El vendedor lo
// cancela (si el comprador ya tiene el producto, cuando se lo devuelve) y AUTONEX reintegra el total del pedido
// (productos + envío) con Mercado Pago, al mismo medio de pago. Art. 34 de la Ley 24.240 y Res. 424/2020.

import { query, transaccion } from '../db.js';
import { ErrorApi } from '../errores.js';
import { enviarMail } from './mail.js';
import { mailReintegro } from './plantillas-mail.js';

/** Estados de un pedido pagado que todavía se pueden revocar. */
export const PEDIDO_REVOCABLE = ['pagado', 'en_preparacion', 'listo_para_retirar', 'enviado', 'entregado'];
/** El comprador ya tiene el producto: primero tiene que devolverlo. */
export const EN_MANOS_DEL_COMPRADOR = ['enviado', 'entregado'];

/** Solicitud de arrepentimiento abierta de una compra (o undefined). */
export async function arrepentimientoAbierto(db, compraId, { bloquear = false } = {}) {
  const { rows: [arrepentimiento] } = await db.query(
    `SELECT id, codigo FROM arrepentimientos WHERE compra_id = $1 AND estado = 'recibido'${bloquear ? ' FOR UPDATE' : ''}`, [compraId]);
  return arrepentimiento;
}

/**
 * Cancela un pedido por arrepentimiento y pide el reintegro. Si era el último pedido activo de la compra, la solicitud
 * queda resuelta y la compra cancelada. Devuelve el pedido actualizado con su reintegro.
 */
export async function revocarPedido({ pedidoId, vendedorId, productoDevuelto = false, reponerStock = true }, mp, log = console) {
  const { reintegroId } = await transaccion(async (db) => {
    const { rows: [pedido] } = await db.query(
      'SELECT id, estado, total, compra_id FROM pedidos WHERE id = $1 AND vendedor_id = $2 FOR UPDATE', [pedidoId, vendedorId]);
    if (!pedido) throw new ErrorApi(404, 'No encontramos ese pedido entre los de tu local.');
    const arrepentimiento = await arrepentimientoAbierto(db, pedido.compra_id, { bloquear: true });
    if (!arrepentimiento) throw new ErrorApi(409, 'Este pedido no tiene una solicitud de arrepentimiento abierta.');
    if (!PEDIDO_REVOCABLE.includes(pedido.estado)) throw new ErrorApi(409, 'Este pedido ya está cancelado.');
    if (EN_MANOS_DEL_COMPRADOR.includes(pedido.estado) && !productoDevuelto) {
      throw new ErrorApi(409, 'El comprador ya tiene el producto: cancelá el pedido cuando te lo devuelva y confirmá que lo recibiste.');
    }

    if (reponerStock) {
      await db.query(`
        UPDATE publicaciones pu SET stock = pu.stock + it.cantidad, actualizado_en = now()
          FROM (SELECT publicacion_id, sum(cantidad) AS cantidad FROM pedido_items WHERE pedido_id = $1 GROUP BY publicacion_id) it
         WHERE pu.id = it.publicacion_id`, [pedido.id]);
    }
    await db.query(
      `UPDATE pedidos SET estado = 'cancelado', actualizado_en = now(),
              nota = concat_ws(' ', nota, $2::text) WHERE id = $1`,
      [pedido.id, `Cancelado por arrepentimiento del comprador (${arrepentimiento.codigo}).`]);

    const { rows: [pago] } = await db.query(
      `SELECT mp_pago_id FROM pagos WHERE compra_id = $1 AND mp_pago_id IS NOT NULL AND estado IN ('approved', 'refunded')
        ORDER BY actualizado_en DESC LIMIT 1`, [pedido.compra_id]);
    const { rows: [reintegro] } = await db.query(
      `INSERT INTO reintegros (pedido_id, compra_id, arrepentimiento_id, monto, mp_pago_id, detalle)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [pedido.id, pedido.compra_id, arrepentimiento.id, pedido.total, pago?.mp_pago_id ?? null,
        pago ? null : 'La compra no tiene un pago aprobado de Mercado Pago: el reintegro se hace a mano.']);

    const { rows: [{ activos }] } = await db.query(
      "SELECT count(*)::int AS activos FROM pedidos WHERE compra_id = $1 AND estado NOT IN ('cancelado', 'pendiente_pago')", [pedido.compra_id]);
    if (activos === 0) {
      await db.query("UPDATE arrepentimientos SET estado = 'resuelto', resuelto_en = now() WHERE id = $1", [arrepentimiento.id]);
      await db.query("UPDATE compras SET estado = 'cancelada', actualizado_en = now() WHERE id = $1", [pedido.compra_id]);
    }
    log.info?.(`Pedido ${pedido.id} cancelado por arrepentimiento ${arrepentimiento.codigo}`);
    return { reintegroId: reintegro.id };
  });

  const reintegro = await procesarReintegro(reintegroId, mp, log);
  await avisarReintegro(reintegroId, log);
  return { id: pedidoId, estado: 'cancelado', siguientes_estados: [], revocable: false, reintegro };
}

/** Pide (o vuelve a pedir) el reintegro a Mercado Pago. Nunca tira: deja el estado y el detalle del error. */
export async function procesarReintegro(reintegroId, mp, log = console) {
  const { rows: [r] } = await query('SELECT * FROM reintegros WHERE id = $1', [reintegroId]);
  if (!r.mp_pago_id || r.estado === 'aprobado') return publico(r);
  let estado;
  let cambios;
  try {
    const respuesta = await mp.reembolsar({ pagoId: r.mp_pago_id, monto: Number(r.monto), idempotencia: `autonex-reintegro-${r.id}` });
    estado = respuesta.status === 'approved' ? 'aprobado' : ['rejected', 'cancelled'].includes(respuesta.status) ? 'error' : 'pendiente';
    cambios = [estado, respuesta.id ? String(respuesta.id) : null,
      estado === 'error' ? `Mercado Pago rechazó el reintegro (${respuesta.status}).` : null];
  } catch (error) {
    log.error?.(`No se pudo reintegrar el pedido ${r.pedido_id} (pago ${r.mp_pago_id}): ${error.message}`);
    cambios = ['error', null, error.message];
  }
  const { rows: [actualizado] } = await query(
    `UPDATE reintegros SET estado = $2, mp_reintegro_id = coalesce($3, mp_reintegro_id), detalle = $4, actualizado_en = now()
      WHERE id = $1 RETURNING *`, [r.id, ...cambios]);
  return publico(actualizado);
}

/** Reintento del vendedor cuando Mercado Pago no pudo hacer el reintegro. */
export async function reintentarReintegro(pedidoId, vendedorId, mp, log) {
  const { rows: [r] } = await query(
    `SELECT re.id, re.estado, re.mp_pago_id FROM reintegros re JOIN pedidos pe ON pe.id = re.pedido_id
      WHERE re.pedido_id = $1 AND pe.vendedor_id = $2`, [pedidoId, vendedorId]);
  if (!r) throw new ErrorApi(404, 'Ese pedido no tiene un reintegro.');
  if (r.estado === 'aprobado') throw new ErrorApi(409, 'El reintegro ya está aprobado.');
  if (!r.mp_pago_id) throw new ErrorApi(409, 'La compra no tiene un pago de Mercado Pago: el reintegro se hace a mano.');
  const reintegro = await procesarReintegro(r.id, mp, log);
  if (reintegro.estado === 'aprobado') await avisarReintegro(r.id, log);
  return reintegro;
}

const publico = (r) => ({
  estado: r.estado, monto: Number(r.monto), mp_reintegro_id: r.mp_reintegro_id, detalle: r.detalle, creado_en: r.creado_en,
});

/** Mail al comprador: pedido cancelado y reintegro (una vez por reintegro aprobado o en curso). */
async function avisarReintegro(reintegroId, log) {
  try {
    const { rows: [datos] } = await query(`
      SELECT re.estado, re.monto, re.mp_pago_id, re.pedido_id, co.id AS compra_id, co.comprador_email, co.comprador_nombre,
             ve.nombre_comercial, ar.codigo
        FROM reintegros re JOIN compras co ON co.id = re.compra_id JOIN pedidos pe ON pe.id = re.pedido_id
        JOIN vendedores ve ON ve.id = pe.vendedor_id LEFT JOIN arrepentimientos ar ON ar.id = re.arrepentimiento_id
       WHERE re.id = $1`, [reintegroId]);
    if (!datos || datos.estado === 'error') return;
    await enviarMail({
      para: datos.comprador_email, ...mailReintegro(datos), idempotencia: `reintegro-${reintegroId}-${datos.estado}`,
    }, log);
  } catch (error) {
    log.error?.(`No se pudo avisar el reintegro ${reintegroId}: ${error.message}`);
  }
}

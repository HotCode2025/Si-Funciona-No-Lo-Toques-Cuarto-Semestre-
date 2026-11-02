import crypto from 'node:crypto';
import { query } from '../db.js';
import { ErrorApi } from '../errores.js';
import { email, id, textoOpcional } from '../esquemas.js';

// Sin letras ni números que se confundan al dictar el código (0/O, 1/I/L)
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const codigoNuevo = (compraId) => `ARR-${compraId}-${Array.from(crypto.randomBytes(6), (b) => ALFABETO[b % ALFABETO.length]).join('')}`;

/**
 * Botón de arrepentimiento (Resolución 424/2020): el comprador pide revocar una compra pagada con el número de compra y
 * el email que usó al comprar, y recibe en el momento el código de identificación de su pedido de revocación. Cada
 * vendedor de la compra lo ve en sus pedidos y coordina la devolución y el reintegro.
 */
export default async function rutasArrepentimientos(app) {
  app.post('/arrepentimientos', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['compra_id', 'email'],
        properties: { compra_id: id, email, motivo: textoOpcional(500) },
      },
    },
  }, async (request, reply) => {
    const { compra_id: compraId, motivo } = request.body;
    const { rows: [compra] } = await query(
      'SELECT id, estado FROM compras WHERE id = $1 AND comprador_email = lower($2)', [compraId, request.body.email.trim()]);
    if (!compra) throw new ErrorApi(404, 'No encontramos una compra con ese número y ese email.');
    if (compra.estado === 'cancelada') {
      throw new ErrorApi(409, 'Esa compra ya está cancelada. Si la revocaste, el reintegro figura en el detalle de la compra.');
    }
    if (compra.estado !== 'pagada') {
      throw new ErrorApi(409, 'Esa compra no está pagada: no hay nada que revocar. Si no la vas a pagar, no tenés que hacer nada.');
    }

    const abierto = async () => (await query(
      "SELECT codigo, creado_en FROM arrepentimientos WHERE compra_id = $1 AND estado = 'recibido'", [compraId])).rows[0];
    const existente = await abierto();
    if (existente) return { ...existente, compra_id: compraId, ya_existia: true };

    try {
      const { rows: [creado] } = await query(
        `INSERT INTO arrepentimientos (codigo, compra_id, email, motivo) VALUES ($1, $2, lower($3), $4)
         RETURNING codigo, creado_en`,
        [codigoNuevo(compraId), compraId, request.body.email.trim(), motivo?.trim() || null]);
      request.log.info(`Arrepentimiento ${creado.codigo} para la compra ${compraId}`);
      return reply.status(201).send({ ...creado, compra_id: compraId, ya_existia: false });
    } catch (error) {
      // Dos pedidos a la vez para la misma compra: el segundo devuelve el código del primero
      if (error.code === '23505') return { ...(await abierto()), compra_id: compraId, ya_existia: true };
      throw error;
    }
  });
}

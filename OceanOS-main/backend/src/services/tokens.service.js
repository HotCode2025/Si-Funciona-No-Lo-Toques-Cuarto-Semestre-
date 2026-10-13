import { many, one, transaction } from '../db/index.js';
import { badRequest, notFound } from '../utils/errors.js';

export async function billetera(userId) {
  const saldo = await one('SELECT * FROM user_balances WHERE user_id = $1', [userId]);
  const movimientos = await many(
    `SELECT l.id, l.amount, l.reason, l.detail, l.created_at,
            s.kind AS sighting_kind, z.name AS zone_name
       FROM token_ledger l
       LEFT JOIN sightings s ON s.id = l.sighting_id
       LEFT JOIN zones z ON z.id = s.zone_id
      WHERE l.user_id = $1
      ORDER BY l.created_at DESC
      LIMIT 60`,
    [userId],
  );
  return { ...saldo, movimientos };
}

export async function recompensas() {
  return many(
    `SELECT r.*, z.name AS zone_name
       FROM rewards r LEFT JOIN zones z ON z.id = r.zone_id
      WHERE r.is_active ORDER BY r.cost_okn`,
  );
}

/** Canje: descuenta del libro mayor y baja stock, todo o nada. */
export async function canjear(userId, rewardId) {
  return transaction(async (cliente) => {
    const { rows: [premio] } = await cliente.query(
      'SELECT * FROM rewards WHERE id = $1 AND is_active FOR UPDATE',
      [rewardId],
    );
    if (!premio) throw notFound('Esa recompensa no está disponible');
    if (premio.stock <= 0) throw badRequest('Se agotó esa recompensa');

    const { rows: [saldo] } = await cliente.query(
      'SELECT COALESCE(SUM(amount), 0)::int AS balance FROM token_ledger WHERE user_id = $1',
      [userId],
    );
    if (saldo.balance < premio.cost_okn) {
      throw badRequest(`Te faltan ${premio.cost_okn - saldo.balance} OKN para este canje`);
    }

    const codigo = `OKN-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    await cliente.query(
      `INSERT INTO token_ledger (user_id, amount, reason, detail)
       VALUES ($1, $2, 'canje', $3)`,
      [userId, -premio.cost_okn, `${premio.title} · ${premio.partner}`],
    );
    await cliente.query('UPDATE rewards SET stock = stock - 1 WHERE id = $1', [rewardId]);
    const { rows: [canje] } = await cliente.query(
      `INSERT INTO redemptions (reward_id, user_id, cost_okn, code)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [rewardId, userId, premio.cost_okn, codigo],
    );

    return { canje, recompensa: premio, saldoRestante: saldo.balance - premio.cost_okn };
  });
}

export async function misCanjes(userId) {
  return many(
    `SELECT c.id, c.code, c.cost_okn, c.redeemed_at, r.title, r.partner
       FROM redemptions c JOIN rewards r ON r.id = c.reward_id
      WHERE c.user_id = $1 ORDER BY c.redeemed_at DESC`,
    [userId],
  );
}

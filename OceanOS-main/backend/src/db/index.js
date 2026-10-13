import pg from 'pg';
import { config } from '../config.js';

// Los numeric de Postgres llegan como string para no perder precisión.
// En este dominio (hectáreas, toneladas, precios) queremos números en el
// JSON, así que los convertimos explícitamente.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(pg.types.builtins.INT8,    (v) => (v === null ? null : Number(v)));

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
});

export const query = (text, params) => pool.query(text, params);

/** Devuelve la primera fila o null. */
export const one = async (text, params) => {
  const { rows } = await pool.query(text, params);
  return rows[0] ?? null;
};

/** Devuelve todas las filas. */
export const many = async (text, params) => {
  const { rows } = await pool.query(text, params);
  return rows;
};

/** Corre varias consultas en una transacción; hace ROLLBACK ante cualquier error. */
export const transaction = async (fn) => {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await fn(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
};

export const closePool = () => pool.end();

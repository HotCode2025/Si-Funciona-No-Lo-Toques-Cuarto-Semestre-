import pg from 'pg';
import { config } from './config.js';

// NUMERIC llega como string desde pg; para precios en pesos alcanza con Number.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (valor) => (valor === null ? null : Number(valor)));
// COUNT(*) devuelve BIGINT (string). Los conteos de esta app entran holgados en un Number.
pg.types.setTypeParser(pg.types.builtins.INT8, (valor) => (valor === null ? null : Number(valor)));

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
});

export function query(texto, params) {
  return pool.query(texto, params);
}

/**
 * Ejecuta `trabajo(cliente)` dentro de una transacción.
 * Si la función lanza un error se hace ROLLBACK y el error se propaga.
 */
export async function transaccion(trabajo) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await trabajo(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (error) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    cliente.release();
  }
}

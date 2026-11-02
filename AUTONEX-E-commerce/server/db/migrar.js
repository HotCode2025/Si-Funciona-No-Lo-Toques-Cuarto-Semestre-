// Aplica las migraciones pendientes sin borrar datos.
//   npm run db:migrar
import { pool } from '../src/db.js';
import { aplicarMigraciones } from './migraciones.js';

const db = await pool.connect();
try {
  console.log('AUTONEX · migraciones');
  const nuevas = await aplicarMigraciones(db);
  console.log(nuevas.length ? `Listo: ${nuevas.length} migración(es) aplicada(s).` : 'La base ya estaba al día.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  db.release();
  await pool.end();
}

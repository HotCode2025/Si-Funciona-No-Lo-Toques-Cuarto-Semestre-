#!/usr/bin/env node
// Carga los datos de demostración de database/seeds.
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, closePool } from '../src/db/index.js';

const aca = dirname(fileURLToPath(import.meta.url));
const carpeta = join(aca, '..', '..', 'database', 'seeds');

try {
  const archivos = (await readdir(carpeta)).filter((f) => f.endsWith('.sql')).sort();
  for (const archivo of archivos) {
    process.stdout.write(`  ${archivo} ... `);
    await pool.query(await readFile(join(carpeta, archivo), 'utf8'));
    console.log('ok');
  }
  console.log('\nDatos de demo cargados. Todas las cuentas usan: oceano1234');
  console.log('  demo@oceanos.ar         · cuenta del proyecto, sin reportes y con 200 OKN');
  console.log('  admin@oceanos.ar        · admin, titular de Fundación Kelp Patagonia');
  console.log('  buzo@oceanos.ar         · ciudadano con 378 OKN');
  console.log('  otar@oceanos.ar         · ciudadano con reputación alta');
  console.log('  jose@oceanos.ar         · APN Valdés (plan enterprise)');
} catch (error) {
  console.error('\nFalló el seed:', error.message);
  process.exitCode = 1;
} finally {
  await closePool();
}

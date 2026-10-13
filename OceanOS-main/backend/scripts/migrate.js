#!/usr/bin/env node
// Corre las migraciones de database/migrations en orden alfabético.
// Con --reset borra el esquema público antes (¡destructivo!).
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, closePool } from '../src/db/index.js';

const aca = dirname(fileURLToPath(import.meta.url));
const carpeta = join(aca, '..', '..', 'database', 'migrations');
const reset = process.argv.includes('--reset');

try {
  if (reset) {
    console.log('Borrando el esquema public...');
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  }
  const archivos = (await readdir(carpeta)).filter((f) => f.endsWith('.sql')).sort();
  for (const archivo of archivos) {
    process.stdout.write(`  ${archivo} ... `);
    await pool.query(await readFile(join(carpeta, archivo), 'utf8'));
    console.log('ok');
  }
  console.log(`\n${archivos.length} migración(es) aplicada(s).`);
} catch (error) {
  console.error('\nFalló la migración:', error.message);
  process.exitCode = 1;
} finally {
  await closePool();
}

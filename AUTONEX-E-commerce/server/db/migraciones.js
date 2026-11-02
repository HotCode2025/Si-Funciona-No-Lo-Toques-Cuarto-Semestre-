// Migraciones de la base: aplica en orden los archivos db/migraciones/NNN_*.sql que todavía no se aplicaron.
// Cada migración corre en su propia transacción y queda registrada en esquema_migraciones.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migraciones');

export function listarMigraciones() {
  return fs.readdirSync(DIR).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort();
}

export async function aplicarMigraciones(db, { log = console.log } = {}) {
  await db.query(`CREATE TABLE IF NOT EXISTS esquema_migraciones (
    archivo TEXT PRIMARY KEY, aplicada_en TIMESTAMPTZ NOT NULL DEFAULT now())`);
  const { rows } = await db.query('SELECT archivo FROM esquema_migraciones');
  const aplicadas = new Set(rows.map((r) => r.archivo));

  // Base creada con el schema.sql de la versión 1 (antes de las migraciones): se toma la 001 como aplicada.
  if (!aplicadas.size) {
    const { rows: [v1] } = await db.query("SELECT to_regclass('public.usuarios') IS NOT NULL AS existe");
    if (v1.existe) {
      const primera = listarMigraciones()[0];
      await db.query('INSERT INTO esquema_migraciones (archivo) VALUES ($1)', [primera]);
      aplicadas.add(primera);
      log(`  base existente: se toma ${primera} como punto de partida`);
    }
  }

  const nuevas = [];
  for (const archivo of listarMigraciones()) {
    if (aplicadas.has(archivo)) continue;
    const sql = fs.readFileSync(path.join(DIR, archivo), 'utf8');
    await db.query('BEGIN');
    try {
      await db.query(sql);
      await db.query('INSERT INTO esquema_migraciones (archivo) VALUES ($1)', [archivo]);
      await db.query('COMMIT');
      nuevas.push(archivo);
      log(`  migración aplicada: ${archivo}`);
    } catch (error) {
      await db.query('ROLLBACK');
      throw new Error(`Falló la migración ${archivo}: ${error.message}`);
    }
  }
  return nuevas;
}

/** Borra todo el esquema público (lo usa el seed para empezar de cero). */
export async function vaciarBase(db) {
  await db.query('DROP SCHEMA public CASCADE');
  await db.query('CREATE SCHEMA public');
}

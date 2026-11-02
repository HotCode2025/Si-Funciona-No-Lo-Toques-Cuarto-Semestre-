// Logos de marcas de vehículos y de marcas de repuestos: los descarga scripts/logos-marcas.js (con --repuestos para las
// de repuestos) y quedan listados (con fuente, autor y licencia) en un logos.json dentro de su carpeta. Esto los
// asigna a las marcas de la base.

import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

export const CARPETA_LOGOS = 'img/marcas/logos';

/** Dónde quedan los logos de las marcas de repuestos y en qué tabla se guardan. */
export const LOGOS_REPUESTOS = { tabla: 'marcas_repuesto', carpeta: 'img/marcas-repuesto/logos' };

export function leerLogos(carpeta = CARPETA_LOGOS) {
  const ruta = path.join(config.clientePublic, carpeta, 'logos.json');
  if (!fs.existsSync(ruta)) return [];
  return JSON.parse(fs.readFileSync(ruta, 'utf8'))
    .filter((l) => fs.existsSync(path.join(config.clientePublic, l.archivo)));
}

/** Guarda en la tabla de marcas la ruta del logo y si necesita fondo oscuro. Devuelve cuántas marcas tienen logo. */
export async function aplicarLogos(db, { tabla = 'marcas_vehiculo', carpeta = CARPETA_LOGOS } = {}) {
  const logos = leerLogos(carpeta);
  if (!logos.length) return 0;
  const { rowCount } = await db.query(`
    UPDATE ${tabla} ma SET logo = '/' || (l->>'archivo'), logo_fondo = l->>'fondo'
      FROM jsonb_array_elements($1::jsonb) l
     WHERE ma.slug = l->>'slug'`, [JSON.stringify(logos)]);
  return rowCount;
}

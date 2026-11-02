// Clasificación de modelos de moto por familia (CRF..R = motocross, EXC = enduro, Duke = naked...).
// Se basa en las convenciones públicas de nombres de cada fabricante (db/data/motos.js); lo que no encaja en ninguna
// regla queda sin categoría. Las categorías que salen de acá se guardan como UNVERIFIED.

import { ALIAS_MARCA_MOTO, LINEAS_POR_MARCA, MARCAS_ELECTRICAS, REGLAS_CATEGORIAS, REGLAS_LINEAS } from '../../db/data/motos.js';
import { normalizarTexto } from './normalizacion.js';

const mismaMarca = (a, b) => normalizarTexto(ALIAS_MARCA_MOTO[a] || a) === normalizarTexto(ALIAS_MARCA_MOTO[b] || b);

/** Categorías de un modelo: todas las reglas de su marca que coinciden, más SCOOTER/ELECTRIC si corresponde. */
export function categoriasDeModelo(marca, modelo, { scooter = false } = {}) {
  const categorias = new Set();
  for (const [marcaRegla, patron, lista] of REGLAS_CATEGORIAS) {
    if (mismaMarca(marcaRegla, marca) && patron.test(modelo.trim())) lista.forEach((c) => categorias.add(c));
  }
  if (scooter) categorias.add('SCOOTER');
  if (MARCAS_ELECTRICAS.some((m) => mismaMarca(m, marca))) categorias.add('ELECTRIC');
  return [...categorias];
}

/** Tipo de vehículo de AUTONEX para un modelo de moto según sus categorías. */
export function tipoDeMoto(categorias) {
  if (categorias.includes('ATV')) return 'cuatriciclo';
  if (categorias.includes('SCOOTER') || categorias.includes('MAXI_SCOOTER')) return 'scooter';
  return 'moto';
}

/**
 * Categoría (ruta completa, "Motos > Frenos > Pastillas") de una línea de producto de una marca de repuestos, o null si
 * la línea no tiene una categoría clara ("Filtros hidráulicos", "Rodamientos").
 */
export function categoriaDeLinea(marca, linea) {
  const porMarca = LINEAS_POR_MARCA[`${marca}|${linea}`];
  if (porMarca !== undefined) return porMarca ? `Motos > ${porMarca}` : null;
  const texto = normalizarTexto(linea);
  const regla = REGLAS_LINEAS.find(([patron]) => patron.test(texto));
  return regla ? `Motos > ${regla[1]}` : null;
}

// Lectura y escritura de CSV (RFC 4180). Detecta el separador (coma o punto y coma, típico de Excel en español).

import { parse } from 'csv-parse/sync';

export function detectarSeparador(texto) {
  const primeraLinea = texto.slice(0, texto.indexOf('\n') > 0 ? texto.indexOf('\n') : texto.length);
  const comas = (primeraLinea.match(/,/g) || []).length;
  const puntoYComa = (primeraLinea.match(/;/g) || []).length;
  return puntoYComa > comas ? ';' : ',';
}

/** Devuelve una lista de objetos { columna: valor }. Las cabeceras se normalizan después en el importador. */
export function leerCsv(contenido) {
  const texto = Buffer.isBuffer(contenido) ? contenido.toString('utf8') : String(contenido);
  return parse(texto, {
    columns: (cabecera) => cabecera.map((c) => String(c).replace(/^﻿/, '').trim()),
    bom: true,
    delimiter: detectarSeparador(texto.replace(/^﻿/, '')),
    relax_quotes: true,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
  });
}

function celda(valor) {
  if (valor === null || valor === undefined) return '';
  const texto = typeof valor === 'object' ? JSON.stringify(valor) : String(valor);
  return /[",\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function escribirCsv(filas, columnas = null) {
  if (!filas.length && !columnas) return '';
  const cab = columnas || Object.keys(filas[0]);
  return `${[cab.join(','), ...filas.map((f) => cab.map((c) => celda(f[c])).join(','))].join('\n')}\n`;
}

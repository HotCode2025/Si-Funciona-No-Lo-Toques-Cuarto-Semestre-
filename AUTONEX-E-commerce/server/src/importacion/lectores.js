// Lectura de archivos de importación: CSV, Excel (.xlsx), JSON y XML. Todos devuelven una lista de filas { columna: valor }.

import path from 'node:path';
import ExcelJS from 'exceljs';
import { XMLParser } from 'fast-xml-parser';
import { leerCsv } from './csv.js';
import { ErrorApi } from '../errores.js';

export function formatoDe(nombreArchivo, formatoIndicado) {
  if (formatoIndicado) return formatoIndicado;
  const ext = path.extname(nombreArchivo || '').toLowerCase();
  if (ext === '.csv' || ext === '.txt') return 'csv';
  if (ext === '.xlsx' || ext === '.xlsm') return 'excel';
  if (ext === '.json') return 'json';
  if (ext === '.xml') return 'xml';
  throw new ErrorApi(400, `No se reconoce el formato de "${nombreArchivo}". Usá .csv, .xlsx, .json o .xml.`);
}

function valorCelda(celda) {
  const v = celda.value;
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if ('result' in v) return v.result ?? '';            // fórmula
    if ('text' in v) return v.text;                      // hipervínculo
    if ('richText' in v) return v.richText.map((t) => t.text).join('');
  }
  return v;
}

async function leerExcel(buffer, hoja) {
  const libro = new ExcelJS.Workbook();
  try {
    await libro.xlsx.load(buffer);
  } catch {
    throw new ErrorApi(400, 'El archivo Excel no se pudo leer. Guardalo como .xlsx (Excel 2007 o posterior).');
  }
  const ws = hoja ? libro.getWorksheet(hoja) : libro.worksheets[0];
  if (!ws) throw new ErrorApi(400, `El Excel no tiene la hoja "${hoja}".`);
  const cabecera = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (celda, col) => { cabecera[col] = String(valorCelda(celda)).trim(); });
  const filas = [];
  ws.eachRow((fila, numero) => {
    if (numero === 1) return;
    const obj = {};
    let tieneDatos = false;
    fila.eachCell({ includeEmpty: true }, (celda, col) => {
      if (!cabecera[col]) return;
      const v = valorCelda(celda);
      if (v !== '') tieneDatos = true;
      obj[cabecera[col]] = v;
    });
    if (tieneDatos) filas.push(obj);
  });
  return filas;
}

function leerJson(buffer) {
  let datos;
  try {
    datos = JSON.parse(Buffer.isBuffer(buffer) ? buffer.toString('utf8') : buffer);
  } catch (e) {
    throw new ErrorApi(400, `El JSON no es válido: ${e.message}`);
  }
  const filas = Array.isArray(datos) ? datos : datos?.filas || datos?.rows || datos?.data;
  if (!Array.isArray(filas)) throw new ErrorApi(400, 'El JSON tiene que ser una lista de objetos o { "filas": [...] }.');
  return filas;
}

/** Aplana un registro XML: atributos y elementos hijos quedan como columnas ("medidas_ancho" para anidados). */
function aplanar(objeto, prefijo = '', fila = {}) {
  for (const [clave, valor] of Object.entries(objeto)) {
    const nombre = prefijo ? `${prefijo}_${clave}` : clave;
    if (valor === null || valor === undefined) continue;
    if (Array.isArray(valor)) fila[nombre] = valor.map((v) => (typeof v === 'object' ? (v['#text'] ?? JSON.stringify(v)) : v)).join(';');
    else if (typeof valor === 'object') {
      if ('#text' in valor && Object.keys(valor).length === 1) fila[nombre] = valor['#text'];
      else aplanar(valor, nombre, fila);
    } else fila[nombre] = valor;
  }
  return fila;
}

/**
 * XML (feeds de proveedores): toma como filas la lista de elementos repetidos más grande del documento
 * (<productos><producto>…</producto>…</productos>, <rss><channel><item>…, etc.).
 */
function leerXml(buffer) {
  let documento;
  try {
    documento = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, trimValues: true })
      .parse(buffer.toString('utf8'));
  } catch (e) {
    throw new ErrorApi(400, `El XML no es válido: ${e.message}`);
  }
  let mejor = null;
  const recorrer = (nodo) => {
    if (!nodo || typeof nodo !== 'object') return;
    for (const valor of Object.values(nodo)) {
      if (Array.isArray(valor) && valor.some((v) => v && typeof v === 'object')) {
        if (!mejor || valor.length > mejor.length) mejor = valor;
        valor.forEach(recorrer);
      } else if (valor && typeof valor === 'object') recorrer(valor);
    }
  };
  recorrer(documento);
  if (!mejor) {
    // Un solo registro: el primer elemento con hijos
    const raiz = Object.values(documento).find((v) => v && typeof v === 'object');
    const unico = raiz && Object.values(raiz).find((v) => v && typeof v === 'object');
    mejor = unico ? [unico] : [];
  }
  return mejor.filter((v) => v && typeof v === 'object').map((v) => aplanar(v));
}

export async function leerArchivo({ contenido, nombre, formato, hoja }) {
  const f = formatoDe(nombre, formato);
  let filas;
  if (f === 'csv') filas = leerCsv(contenido);
  else if (f === 'excel') filas = await leerExcel(contenido, hoja);
  else if (f === 'xml') filas = leerXml(contenido);
  else filas = leerJson(contenido);
  if (!filas.length) throw new ErrorApi(400, 'El archivo no tiene filas para importar.');
  return { formato: f, filas };
}

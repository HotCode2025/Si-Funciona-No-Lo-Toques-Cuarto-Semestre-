// Modelos de motos y sus fotos reales desde Wikidata + Wikimedia Commons.
//
//   npm run motos:wikidata -w autonex-server            genera el listado y baja las fotos que falten
//   npm run motos:wikidata -w autonex-server -- --sin-fotos   solo el listado
//
// Qué hace:
//   1. Una consulta SPARQL trae los ítems de Wikidata que son "modelo de moto" o "modelo de scooter", con su
//      fabricante, la foto (P18), años de producción (P571/P2669) y cilindrada (P8628) cuando existen.
//   2. Los asigna a las marcas de AUTONEX (las de db/data/motos.js; otros fabricantes con 10 o más modelos se suman
//      como marcas internacionales). También suma los fabricantes de motos de Argentina que figuren en Wikidata.
//   3. Baja la foto de cada modelo desde Commons (solo archivos con licencia libre), la ajusta a 640×480 y guarda
//      URL, página de origen, autor, licencia, fecha de descarga y hash SHA-256.
//   4. Escribe db/datos/motos/wikidata-motos.json, que el seed importa sin necesitar internet.
// No inventa nada: si un dato no está en Wikidata queda vacío (años, cilindrada) o sin foto (IMAGE_MISSING).

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../../src/config.js';
import { claveNombre, normalizarTexto, slugificar } from '../../src/catalogo/normalizacion.js';
import { ALIAS_MARCA_MOTO, FABRICANTES_WIKIDATA, MARCAS_MOTO, MINIMO_MODELOS_INTERNACIONAL } from '../../db/data/motos.js';

const { default: sharp } = await import('sharp').catch(() => {
  console.error('Falta sharp: npm install -D sharp -w autonex-server');
  process.exit(1);
});

const aqui = path.dirname(fileURLToPath(import.meta.url));
const SALIDA = path.join(aqui, '..', '..', 'db', 'datos', 'motos', 'wikidata-motos.json');
const CARPETA_FOTOS = 'img/motos';
const UA = 'AUTONEX/1.0 (https://gnuino.com.ar/AUTONEX; proyecto universitario, catálogo de motos)';
const sinFotos = process.argv.includes('--sin-fotos');
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const compacto = (t) => normalizarTexto(t).replace(/[^a-z0-9]/g, '');

const MODELO_MOTO = 'Q23866334';
const MODELO_SCOOTER = 'Q23867828';

async function pedir(url, opciones = {}, comoJson = true) {
  for (let intento = 1; intento <= 6; intento++) {
    const r = await fetch(url, { ...opciones, headers: { 'User-Agent': UA, ...(opciones.headers || {}) } }).catch(() => null);
    if (r?.ok) return comoJson ? r.json() : Buffer.from(await r.arrayBuffer());
    if (r && r.status === 404) return null;
    const espera = Number(r?.headers.get('retry-after')) * 1000 || 5000 * intento;
    await esperar(Math.min(espera, 60000));
  }
  return null;
}

const sparql = (consulta) => pedir('https://query.wikidata.org/sparql', {
  method: 'POST',
  headers: { Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ query: consulta }),
});

const CONSULTA_MODELOS = `
SELECT ?item ?en ?es ?tipo ?fab ?fabLabel ?img ?cc ?inicio ?fin WHERE {
  VALUES ?tipo { wd:${MODELO_MOTO} wd:${MODELO_SCOOTER} }
  ?item wdt:P31 ?tipo ; wdt:P176 ?fab .
  OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?item rdfs:label ?es FILTER(LANG(?es) = "es") }
  OPTIONAL { ?fab rdfs:label ?fabLabel FILTER(LANG(?fabLabel) = "en") }
  OPTIONAL { ?item wdt:P18 ?img }
  OPTIONAL { ?item wdt:P8628 ?cc }
  OPTIONAL { ?item wdt:P571 ?inicio }
  OPTIONAL { ?item wdt:P2669 ?fin }
}`;

// Fabricantes de motos con sede en Argentina
const CONSULTA_ARGENTINA = `
SELECT DISTINCT ?fab ?fabLabel WHERE {
  ?fab wdt:P31/wdt:P279* wd:Q15081030 ; wdt:P17 wd:Q414 .
  ?fab rdfs:label ?fabLabel FILTER(LANG(?fabLabel) IN ("es", "en"))
}`;

/** Nombre de la marca de AUTONEX para un nombre de la lista o un fabricante de Wikidata. */
function marcaDe(nombre) {
  return FABRICANTES_WIKIDATA[nombre] || ALIAS_MARCA_MOTO[nombre] || nombre;
}

/** Saca del nombre del modelo la marca repetida al principio ("Honda CRF250R" -> "CRF250R"). */
function limpiarModelo(etiqueta, marca, fabricante) {
  let nombre = etiqueta.trim();
  const prefijos = [...new Set([marca, fabricante, fabricante?.split(' ')[0], marca.split(' ')[0]].filter(Boolean))]
    .sort((a, b) => b.length - a.length);
  for (const p of prefijos) {
    if (normalizarTexto(nombre).startsWith(`${normalizarTexto(p)} `)) {
      nombre = nombre.slice(p.length).trim();
      break;
    }
  }
  return nombre;
}

async function datosCommons(archivos) {
  const datos = new Map();
  for (let i = 0; i < archivos.length; i += 40) {
    const lote = archivos.slice(i, i + 40);
    const r = await pedir(`https://commons.wikimedia.org/w/api.php?${new URLSearchParams({
      format: 'json', action: 'query', titles: lote.map((a) => `File:${a}`).join('|'), prop: 'imageinfo',
      iiprop: 'url|extmetadata|mime', iiurlwidth: '500',
    })}`);
    if (r) {
      const normalizados = new Map((r.query.normalized || []).map((n) => [n.to, n.from]));
      for (const p of Object.values(r.query.pages || {})) {
        const info = p.imageinfo?.[0];
        if (!info) continue;
        const m = info.extmetadata || {};
        const texto = (v) => String(v || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        datos.set((normalizados.get(p.title) || p.title).replace(/^File:/, ''), {
          titulo: p.title.replace(/^File:/, ''), url_imagen: info.thumburl || info.url, url_origen: info.descriptionurl,
          autor: texto(m.Artist?.value) || 'Desconocido', licencia: texto(m.LicenseShortName?.value) || null,
          licencia_url: m.LicenseUrl?.value || null, mime: info.mime,
          libre: !/fair use|non-free/i.test(texto(m.LicenseShortName?.value)),
        });
      }
    }
    await esperar(1500);
  }
  return datos;
}

async function main() {
  const anterior = fs.existsSync(SALIDA) ? JSON.parse(fs.readFileSync(SALIDA, 'utf8')) : { modelos: [] };
  const fotosPrevias = new Map(anterior.modelos.filter((m) => m.imagen?.archivo).map((m) => [m.wikidata, m.imagen]));

  console.log('Consultando Wikidata…');
  const [r, rArg] = [await sparql(CONSULTA_MODELOS), await sparql(CONSULTA_ARGENTINA)];
  if (!r) throw new Error('Wikidata no respondió la consulta de modelos');

  // Modelos agrupados por ítem
  const items = new Map();
  for (const f of r.results.bindings) {
    const id = f.item.value.split('/').pop();
    const e = items.get(id) || { id, en: f.en?.value, es: f.es?.value, fabricantes: new Set(), scooter: false };
    if (f.fabLabel?.value) e.fabricantes.add(f.fabLabel.value);
    e.scooter ||= f.tipo.value.endsWith(MODELO_SCOOTER);
    if (f.img && !e.foto) e.foto = decodeURIComponent(f.img.value.split('/').pop()).replace(/_/g, ' ');
    if (f.cc && !e.cc) e.cc = Math.round(Number(f.cc.value));
    if (f.inicio && !e.inicio) e.inicio = Number(f.inicio.value.slice(0, 4));
    if (f.fin && !e.fin) e.fin = Number(f.fin.value.slice(0, 4));
    items.set(id, e);
  }

  // Marcas: las de la lista + fabricantes de Argentina + internacionales con muchos modelos
  const deLista = new Set(Object.values(MARCAS_MOTO).flat().map((m) => compacto(marcaDe(m))));
  const argentinas = new Set((rArg?.results.bindings || []).map((f) => f.fabLabel.value));
  const porFabricante = new Map();
  for (const e of items.values()) for (const f of e.fabricantes) porFabricante.set(f, (porFabricante.get(f) || 0) + 1);
  const incluida = (fabricante) => deLista.has(compacto(marcaDe(fabricante))) || argentinas.has(fabricante)
    || (porFabricante.get(fabricante) || 0) >= MINIMO_MODELOS_INTERNACIONAL;

  const modelos = [];
  const vistos = new Set();
  for (const e of items.values()) {
    const fabricante = [...e.fabricantes].find(incluida);
    if (!fabricante) continue;
    const marca = marcaDe(fabricante);
    const etiqueta = e.es && e.en && compacto(e.es) !== compacto(e.en) ? e.en : (e.en || e.es);
    if (!etiqueta || /^Q\d+$/.test(etiqueta)) continue;
    const nombre = limpiarModelo(etiqueta, marca, fabricante);
    if (!nombre || nombre.length > 80) continue;
    const clave = `${compacto(marca)}|${claveNombre(nombre)}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    modelos.push({
      marca, nombre, wikidata: e.id, tipo: e.scooter ? 'scooter' : 'moto', foto: e.foto || null,
      cilindrada_cc: e.cc || null, anio_desde: e.inicio || null, anio_hasta: e.fin || null,
      grupo: deLista.has(compacto(marca)) ? 'lista' : argentinas.has(fabricante) ? 'argentina' : 'internacional',
    });
  }
  const marcas = [...new Set(modelos.map((m) => m.marca))].sort();
  console.log(`${modelos.length} modelos de ${marcas.length} marcas (${modelos.filter((m) => m.foto).length} con foto en Commons)`);
  console.log(`Fabricantes de motos de Argentina en Wikidata: ${[...argentinas].join(', ') || 'ninguno'}`);

  // Fotos (Commons): primero las marcas de la lista y las argentinas
  if (!sinFotos) {
    const orden = { lista: 0, argentina: 1, internacional: 2 };
    const conFoto = modelos.filter((m) => m.foto).sort((a, b) => orden[a.grupo] - orden[b.grupo]);
    const info = await datosCommons([...new Set(conFoto.map((m) => m.foto))]);
    let bajadas = 0;
    for (const [n, m] of conFoto.entries()) {
      const previa = fotosPrevias.get(m.wikidata);
      if (previa && fs.existsSync(path.join(config.clientePublic, previa.archivo))) {
        m.imagen = previa;
        continue;
      }
      const d = info.get(m.foto);
      if (!d || !d.libre || !/^image\/(jpeg|png|webp|tiff)/.test(d.mime || 'image/jpeg')) continue;
      const buffer = await pedir(d.url_imagen, {}, false);
      await esperar(1500);
      if (!buffer) continue;
      const archivo = `${CARPETA_FOTOS}/${slugificar(m.marca)}/${slugificar(m.nombre) || m.wikidata}.jpg`;
      const destino = path.join(config.clientePublic, archivo);
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      try {
        const salida = await sharp(buffer).rotate().resize(640, 480, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 78, mozjpeg: true }).toBuffer({ resolveWithObject: true });
        fs.writeFileSync(destino, salida.data);
        m.imagen = {
          archivo, titulo: d.titulo, url_imagen: d.url_imagen.split('?')[0], url_origen: d.url_origen, autor: d.autor,
          licencia: d.licencia, licencia_url: d.licencia_url, ancho: salida.info.width, alto: salida.info.height,
          hash_sha256: crypto.createHash('sha256').update(salida.data).digest('hex'), descargado_en: new Date().toISOString(),
        };
        bajadas++;
      } catch (e) {
        console.log(`  ✗ ${m.marca} ${m.nombre}: ${e.message}`);
      }
      if ((n + 1) % 50 === 0) console.log(`  fotos: ${n + 1}/${conFoto.length} revisadas, ${bajadas} nuevas`);
    }
    console.log(`Fotos descargadas: ${bajadas} nuevas · con foto: ${modelos.filter((m) => m.imagen).length} de ${modelos.length}`);
  }

  fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
  fs.writeFileSync(SALIDA, `${JSON.stringify({
    generado_en: new Date().toISOString(),
    fuente: 'Wikidata (CC0) + Wikimedia Commons (licencias libres, ver cada foto)',
    marcas_argentinas_wikidata: [...argentinas].map(marcaDe),
    modelos: modelos.sort((a, b) => a.marca.localeCompare(b.marca) || a.nombre.localeCompare(b.nombre)),
  }, null, 1)}\n`);
  console.log(`Escrito ${SALIDA}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

// ETL de vehículos desde los datos abiertos del Registro Nacional de la Propiedad Automotor (DNRPA).
//
// Fuente: datos.jus.gob.ar — "Inscripciones iniciales de autos" (0 km) y "Transferencias de autos" (usados).
// Licencia: Creative Commons Atribución 4.0 (CC BY 4.0). Se puede reutilizar y redistribuir citando la fuente.
//
// Qué hace:
//   1. Busca en la API del portal (CKAN) los ZIP anuales de los años pedidos y los descarga a una caché local.
//   2. Lee los CSV dentro de los ZIP sin descomprimirlos a disco. Usa SOLO las columnas del vehículo
//      (marca, modelo, tipo, año modelo, origen). Los datos del titular (género, edad, localidad) se ignoran.
//   3. Agrupa por versión oficial (código de marca + código de modelo del DNRPA), calcula años observados,
//      cantidad de registros y si se sigue patentando 0 km.
//   4. Separa modelo y versión, y lee del texto oficial lo que dice explícitamente (cilindrada, combustible,
//      transmisión, tracción) con las reglas de reglas.json. No completa nada que el registro no diga.
//   5. Escribe server/db/datos/dnrpa/vehiculos.csv en el formato de importación de AUTONEX.
//
// Uso:   npm run dnrpa -w autonex-server -- --anios 2024,2025,2026
// Opciones: --cache <dir>  --salida <archivo.csv>  --refrescar (vuelve a descargar)

import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse';
import yauzl from 'yauzl';
import { escribirCsv } from '../../src/importacion/csv.js';
import { claveNombre, claveVehiculo } from '../../src/catalogo/normalizacion.js';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const REGLAS = JSON.parse(fs.readFileSync(path.join(aqui, 'reglas.json'), 'utf8'));
const PORTAL = 'https://datos.jus.gob.ar';
const DATASETS = {
  inscripciones: 'inscripciones-iniciales-de-autos',
  transferencias: 'transferencias-de-autos',
};
const UA = 'AUTONEX-ETL/2.0 (proyecto universitario)';

function argumento(nombre, porDefecto) {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : porDefecto;
}
const ANIOS = argumento('anios', '2024,2025,2026').split(',').map((a) => a.trim());
const CACHE = path.resolve(argumento('cache', path.join(aqui, '..', '..', '.cache', 'dnrpa')));
const SALIDA = path.resolve(argumento('salida', path.join(aqui, '..', '..', 'db', 'datos', 'dnrpa', 'vehiculos.csv')));
const REFRESCAR = process.argv.includes('--refrescar');

// ------------------------------------------------------------------ descarga
async function recursosDe(dataset) {
  const r = await fetch(`${PORTAL}/api/3/action/package_show?id=${dataset}`, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`No se pudo consultar el dataset ${dataset} (${r.status})`);
  const { result } = await r.json();
  return {
    titulo: result.title,
    licencia: result.license_title,
    licencia_url: result.license_url,
    url: `${PORTAL}/dataset/${result.name}`,
    recursos: result.resources
      .filter((rec) => /zip/i.test(rec.format) && ANIOS.some((a) => rec.name.trim().endsWith(a)))
      .map((rec) => ({ nombre: rec.name.trim(), url: rec.url, anio: ANIOS.find((a) => rec.name.trim().endsWith(a)) })),
  };
}

async function descargar(url, destino) {
  if (fs.existsSync(destino) && !REFRESCAR) return;
  console.log(`  descargando ${path.basename(destino)}…`);
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`Descarga fallida ${url} (${r.status})`);
  const temporal = `${destino}.parcial`;
  await pipeline(Readable.fromWeb(r.body), fs.createWriteStream(temporal));
  fs.renameSync(temporal, destino);
}

// ------------------------------------------------------------------ lectura de ZIP + CSV
function entradasCsv(archivoZip, alLeer) {
  return new Promise((resolver, rechazar) => {
    yauzl.open(archivoZip, { lazyEntries: true }, (error, zip) => {
      if (error) return rechazar(error);
      zip.on('error', rechazar);
      zip.on('end', resolver);
      zip.on('entry', (entrada) => {
        if (!/\.csv$/i.test(entrada.fileName)) return zip.readEntry();
        zip.openReadStream(entrada, async (err, flujo) => {
          if (err) return rechazar(err);
          try {
            await alLeer(entrada.fileName, flujo);
            zip.readEntry();
          } catch (e) {
            rechazar(e);
          }
        });
      });
      zip.readEntry();
    });
  });
}

// ------------------------------------------------------------------ agregación
const versiones = new Map();
let fechaMaxima = '0000-00';
let filasLeidas = 0;

function sumar(mapa, clave, n = 1) {
  if (clave === undefined || clave === null || clave === '') return;
  mapa.set(clave, (mapa.get(clave) || 0) + n);
}

function masFrecuente(mapa) {
  let mejor = null;
  let max = -1;
  for (const [k, v] of mapa) if (v > max) { mejor = k; max = v; }
  return mejor;
}

async function procesarCsv(flujo, origenDataset) {
  const parser = flujo.pipe(parse({
    columns: (cab) => cab.map((c) => c.replace(/^﻿/, '').trim()),
    bom: true, relax_quotes: true, relax_column_count: true, skip_empty_lines: true, trim: true,
  }));
  for await (const fila of parser) {
    filasLeidas++;
    const marcaCod = fila.automotor_marca_codigo;
    const modeloCod = fila.automotor_modelo_codigo;
    if (!marcaCod || !modeloCod) continue;
    const clave = `${marcaCod}|${modeloCod}`;
    let v = versiones.get(clave);
    if (!v) {
      v = { marcaCod, modeloCod, marcas: new Map(), modelos: new Map(), tipos: new Map(), origenes: new Map(), anios: new Map(), inscripciones: 0, transferencias: 0, ultimo0km: null };
      versiones.set(clave, v);
    }
    sumar(v.marcas, fila.automotor_marca_descripcion?.toUpperCase());
    sumar(v.modelos, fila.automotor_modelo_descripcion?.toUpperCase().replace(/\s+/g, ' '));
    sumar(v.tipos, fila.automotor_tipo_descripcion?.toUpperCase());
    sumar(v.origenes, fila.automotor_origen);
    const anio = Number(fila.automotor_anio_modelo);
    if (anio >= 1940 && anio <= new Date().getFullYear() + 1) sumar(v.anios, anio);
    const mes = (fila.tramite_fecha || '').slice(0, 7);
    if (mes > fechaMaxima) fechaMaxima = mes;
    if (origenDataset === 'inscripciones') {
      v.inscripciones++;
      if (!v.ultimo0km || mes > v.ultimo0km) v.ultimo0km = mes;
    } else {
      v.transferencias++;
    }
  }
}

// ------------------------------------------------------------------ normalización
const MULTIPALABRA = Object.fromEntries(Object.entries(REGLAS.modelos_multipalabra)
  .map(([marca, lista]) => [marca, [...lista].sort((a, b) => b.length - a.length)]));
const PALABRAS_VERSION = new Set(REGLAS.palabras_version);
const TECNOLOGIAS = new Set(REGLAS.tecnologias_motor);
const conjunto = (lista) => new Set(lista.map((t) => t.toUpperCase()));
const DIESEL = conjunto(REGLAS.tokens_diesel);
const TURBO = conjunto(REGLAS.tokens_turbo);
const HIBRIDO = conjunto(REGLAS.tokens_hibrido);
const ELECTRICO = conjunto(REGLAS.tokens_electrico);
const GNC = conjunto(REGLAS.tokens_gnc);
const TIPOS = REGLAS.tipos.map((t) => ({ ...t, re: new RegExp(t.patron), reExcepto: t.excepto ? new RegExp(t.excepto) : null }));

function resolverMarca(texto) {
  let crudo = texto.trim().replace(/\s+/g, ' ');
  let carrocero = null;
  if (crudo.includes('/')) {
    const [chasis, carroceria] = crudo.split('/').map((s) => s.trim());
    crudo = chasis;
    carrocero = carroceria || null;
  }
  const alias = REGLAS.marcas_alias[crudo];
  if (typeof alias === 'string') return { clave: alias, prefijoModelo: null, carrocero };
  if (alias) return { clave: alias.marca, prefijoModelo: alias.prefijo_modelo || null, carrocero };
  return { clave: crudo, prefijoModelo: null, carrocero };
}

/**
 * Clave para reconocer el mismo modelo escrito de distintas formas dentro de una marca:
 * "RENAULT 19", "R 19", "R19" y "19" -> "19" (marca o inicial de la marca delante de un número);
 * "F-150", "F 150" y "F150" -> "F150" (sigla corta + número).
 */
function claveModelo(marcaClave, modelo) {
  let m = modelo.toUpperCase();
  const tokens = m.split(' ');
  if (tokens.length > 1 && esPrefijoDeMarca(marcaClave, tokens[0]) && /^\d/.test(tokens[1])) m = tokens.slice(1).join(' ');
  const compacto = m.replace(/[\s-]/g, '');
  if (/^[A-Z]{1,2}\d{1,4}[A-Z]?$/.test(compacto)) m = compacto;
  if (m[0] === marcaClave[0] && /^[A-Z]\d{1,3}$/.test(m)) m = m.slice(1);
  return claveNombre(m);
}

function nombreMarca(clave) {
  if (REGLAS.marcas_nombre[clave]) return REGLAS.marcas_nombre[clave];
  return clave.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, sep, letra) => sep + letra.toUpperCase());
}

const OVERRIDES_MODELO = { ECOSPORT: 'EcoSport', 'UP!': 'up!', KA: 'Ka', 'KA+': 'Ka+', 'ID.3': 'ID.3', 'ID.4': 'ID.4' };
function nombreModelo(clave) {
  if (OVERRIDES_MODELO[clave]) return OVERRIDES_MODELO[clave];
  return clave.split(' ').map((token) => token.split('-').map((parte) => {
    if (/\d/.test(parte) || parte.length <= 2 || /^(III|IV|VI{1,3}|IX)$/.test(parte)) return parte.toUpperCase();
    return parte.charAt(0) + parte.slice(1).toLowerCase();
  }).join('-')).join(' ');
}

const PATRONES = Object.fromEntries(Object.entries(REGLAS.modelos_patron || {})
  .map(([marca, lista]) => [marca, lista.map((p) => ({ re: new RegExp(p.patron), modelo: p.modelo }))]));
const PUERTAS = new Set(REGLAS.tokens_puertas || []);

/** Saca de la descripción el nombre de la marca si viene repetido al principio ("VW GOL 1.6" -> "GOL 1.6"). */
function prefijosDeMarca(marcaClave) {
  return new Set([marcaClave, marcaClave.split(/[\s-]/)[0], ...(REGLAS.abreviaturas_marca[marcaClave] || [])]);
}

function esPrefijoDeMarca(marcaClave, token) {
  return prefijosDeMarca(marcaClave).has(token);
}

function sinPrefijoDeMarca(marcaClave, tokens) {
  const prefijos = prefijosDeMarca(marcaClave);
  let i = 0;
  while (i < tokens.length - 1 && prefijos.has(tokens[i])) i++;
  // "RENAULT 12", "PEUGEOT 504": si lo que sigue es solo un número, la marca es parte del nombre del modelo
  if (i > 0 && /^\d+$/.test(tokens[i])) return tokens;
  return tokens.slice(i);
}

function separarModelo(marcaClave, descripcion) {
  let texto = descripcion.replace(/[,;]/g, ' ').replace(/\s+/g, ' ').trim();
  texto = sinPrefijoDeMarca(marcaClave, texto.split(' ')).join(' ');
  for (const p of PATRONES[marcaClave] || []) {
    const m = texto.match(p.re);
    if (m) return { modelo: p.modelo.replace(/\$(\d)/g, (_, n) => m[Number(n)] || '').trim(), version: texto };
  }
  for (const m of MULTIPALABRA[marcaClave] || []) {
    if (texto === m || texto.startsWith(`${m} `)) return { modelo: m, version: texto.slice(m.length).trim() };
  }
  let tokens = texto.split(' ');
  if (tokens.length > 1 && REGLAS.prefijos_omitir.includes(tokens[0])) tokens = tokens.slice(1);
  const [t1, t2, t3] = tokens;
  let n = 1;
  // "RENAULT 12 TL" -> modelo "Renault 12", versión "TL"
  if (t2 && /^\d+$/.test(t2) && esPrefijoDeMarca(marcaClave, t1)) n = 2;
  else if (t2 && REGLAS.prefijos_dos_palabras.includes(t1)) n = 2;
  // TIGGO 4 / R 450 (pero no "CLASSIC 4 PTAS", "FOCUS 5P" ni "NIVUS 170 TSI"): con un nombre largo solo se une
  // un dígito; los números de 2-3 cifras solo con nombres de 1-2 letras (series de camiones: R 450, G 410).
  else if (t2 && !PUERTAS.has(t3) && /^[A-Z][A-Z-]*$/.test(t1) && !PALABRAS_VERSION.has(t2)
    && (/^\d$/.test(t2) || (t1.length <= 2 && /^\d{2,3}[A-Z]?$/.test(t2)))) n = 2;
  return { modelo: tokens.slice(0, n).join(' '), version: tokens.slice(n).join(' ') };
}

/**
 * Segunda pasada por marca: une variantes que son el mismo modelo con un sufijo pegado
 * ("RANGER2" -> RANGER, "CLIO2" -> CLIO, "FOCUSEXE" -> FOCUS) y aplica los renombres de reglas.json.
 */
function unirVariantes(filasMarca, marcaClave) {
  const registrosPorModelo = new Map();
  for (const f of filasMarca) registrosPorModelo.set(f.modelo, (registrosPorModelo.get(f.modelo) || 0) + f.registros);
  const renombrar = REGLAS.modelos_renombrar[marcaClave] || {};
  const unibles = new Set(REGLAS.sufijos_modelo_unibles || []);
  for (const f of filasMarca) {
    if (renombrar[f.modelo]) {
      const original = f.modelo;
      f.modelo = renombrar[f.modelo];
      f.version = `${original.replace(f.modelo.replace(/!$/, ''), '').replace('!', '').trim()} ${f.version}`.trim();
      continue;
    }
    if (f.modelo.includes(' ') || f.modelo.length < 5) continue;
    for (let k = 1; k <= 3; k++) {
      const base = f.modelo.slice(0, -k);
      const sufijo = f.modelo.slice(-k);
      if (base.length < 3 || !registrosPorModelo.has(base)) continue;
      if (!/\d/.test(sufijo) && !unibles.has(sufijo)) continue;
      if (registrosPorModelo.get(base) < registrosPorModelo.get(f.modelo)) continue;
      f.version = `${sufijo} ${f.version}`.trim();
      f.modelo = base;
      break;
    }
  }
}

function tipoDe(tipoDnrpa) {
  for (const t of TIPOS) {
    if (t.re.test(tipoDnrpa) && !(t.reExcepto && t.reExcepto.test(tipoDnrpa))) return t;
  }
  return { tipo: 'sin_especificar', carroceria: null };
}

function leerMotor(descripcion) {
  const tokens = descripcion.split(/\s+/);
  const tiene = (set) => tokens.some((t) => set.has(t) || set.has(t.replace(/[^A-Z0-9-.]/g, '')));
  const cil = descripcion.match(/(?:^|\s)(\d\.\d)(?:L|T|I)?(?=\s|$|[A-Z])/);
  let combustible = null;
  if (tiene(ELECTRICO)) combustible = 'electrico';
  else if (tiene(HIBRIDO)) combustible = 'hibrido';
  else if (tiene(DIESEL)) combustible = 'diesel';
  else if (tiene(GNC)) combustible = 'gnc';
  const tecnologia = tokens.find((t) => TECNOLOGIAS.has(t)) || null;
  const aspiracion = tiene(TURBO) || /\d\.\dT\b/.test(descripcion) ? 'turbo' : null;
  let transmision = null;
  let velocidades = null;
  const at = descripcion.match(/\b(?:AT|A\/T|AUT|EAT)(\d{1,2})?\b|\b(\d{1,2})AT\b|AUTOMATIC|TIPTRONIC|\bCVT\b|\bDSG\b|\bDCT\b|S-TRONIC|STEPTRONIC/);
  const mt = descripcion.match(/\b(?:MT|M\/T)(\d)?\b|\b(\d)MT\b|MANUAL/);
  if (at) { transmision = 'automatica'; velocidades = Number(at[1] || at[2]) || null; }
  else if (mt) { transmision = 'manual'; velocidades = Number(mt[1] || mt[2]) || null; }
  // "AT20" o "MT1" no son cajas reales: es otra cosa pegada a la sigla
  if (velocidades && (velocidades < 3 || velocidades > 18)) velocidades = null;
  let traccion = null;
  if (/\b(4X4|4WD|AWD|4MOTION|QUATTRO|XDRIVE|4MATIC|ALL4)\b/.test(descripcion)) traccion = '4x4';
  else if (/\b4X2\b/.test(descripcion)) traccion = '4x2';
  else if (/\b(6X4|6X2|8X4|8X2)\b/.test(descripcion)) traccion = descripcion.match(/\b(6X4|6X2|8X4|8X2)\b/)[1].toLowerCase();
  const cilindrada = cil ? Number(cil[1]) : null;
  let motor = null;
  if (combustible === 'electrico') motor = 'Eléctrico';
  else if (cilindrada) motor = [cil[1], tecnologia].filter(Boolean).join(' ');
  return {
    motor,
    cilindrada_cc: cilindrada ? Math.round(cilindrada * 1000) : null,
    combustible,
    aspiracion,
    transmision,
    velocidades,
    traccion,
  };
}

/** Años: descarta valores aislados (menos del 1 % de los registros) cuando hay suficientes datos. */
function rangoAnios(anios) {
  const total = [...anios.values()].reduce((s, n) => s + n, 0);
  const validos = [...anios].filter(([, n]) => total < 50 || n >= Math.max(2, total * 0.01)).map(([a]) => a);
  const lista = validos.length ? validos : [...anios.keys()];
  return lista.length ? [Math.min(...lista), Math.max(...lista)] : [null, null];
}

/**
 * Años aislados por modelo: un año (viejo o nuevo) separado del resto por más de 3 años sin trámites y que suma menos del 2 %
 * de los registros del modelo es un error de carga (una Amarok "modelo 1997", un Falcon "2013"). Esos años se descartan;
 * si una versión solo tenía años así, se descarta la versión.
 */
function recortarAniosAislados(filas) {
  const porModelo = new Map();
  const vigentes = new Set();
  for (const f of filas) {
    const k = `${f.marca}|${claveNombre(f.modelo)}`;
    if (f.estado_mercado === 'comercializado') vigentes.add(k);
    const h = porModelo.get(k) || new Map();
    for (const [anio, n] of f.aniosMapa) h.set(anio, (h.get(anio) || 0) + n);
    porModelo.set(k, h);
  }
  // Busca el corte desde un extremo: el último año aislado (separado por más de 3 años) dentro del primer 2 %
  const corteDesde = (anios, h, total) => {
    let acumulado = 0;
    let corte = null;
    for (let i = 0; i < anios.length - 1; i++) {
      acumulado += h.get(anios[i]);
      if (acumulado / total >= 0.02) break;
      if (Math.abs(anios[i + 1] - anios[i]) > 3) corte = anios[i];
    }
    return corte;
  };
  const cortes = new Map();
  for (const [k, h] of porModelo) {
    const anios = [...h.keys()].sort((a, b) => a - b);
    const total = anios.reduce((s, a) => s + h.get(a), 0);
    const minimo = corteDesde(anios, h, total);            // años viejos aislados ("Amarok 1997")
    // años nuevos aislados ("Falcon 2013"); no si el modelo tiene patentamientos 0 km recientes (importaciones nuevas)
    const maximo = vigentes.has(k) ? null : corteDesde([...anios].reverse(), h, total);
    if (minimo !== null || maximo !== null) cortes.set(k, { minimo: minimo ?? -Infinity, maximo: maximo ?? Infinity });
  }
  let aniosDescartados = 0;
  let versionesDescartadas = 0;
  const resultado = [];
  for (const f of filas) {
    const corte = cortes.get(`${f.marca}|${claveNombre(f.modelo)}`);
    if (corte === undefined) {
      resultado.push(f);
      continue;
    }
    const mapa = new Map([...f.aniosMapa].filter(([anio]) => anio > corte.minimo && anio < corte.maximo));
    if (!mapa.size) {
      versionesDescartadas++;
      continue;
    }
    if (mapa.size < f.aniosMapa.size) aniosDescartados++;
    const [desde, hasta] = rangoAnios(mapa);
    resultado.push({ ...f, anio_desde: desde, anio_hasta: hasta, aniosMapa: mapa });
  }
  return { filas: resultado, aniosDescartados, versionesDescartadas };
}

/**
 * El DNRPA a veces registra la misma versión con dos códigos de modelo (por ejemplo, un código viejo y uno nuevo).
 * Si coinciden marca, modelo y descripción normalizada y los años se superponen, es un solo vehículo: se une en una
 * fila que conserva el código más registrado y anota los demás en dnrpa_codigos_unidos.
 */
function unirCodigosRepetidos(filas) {
  const grupos = new Map();
  for (const f of filas) {
    const k = `${f.marca}|${claveNombre(f.modelo)}|${claveVehiculo(f.modelo, f.version, f.motor)}`;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(f);
  }
  const resultado = [];
  let unidas = 0;
  for (const lista of grupos.values()) {
    lista.sort((a, b) => a.anio_desde - b.anio_desde);
    let grupo = [lista[0]];
    let hasta = lista[0].anio_hasta ?? 9999;
    const cerrar = () => {
      resultado.push(fusionarFilas(grupo));
      unidas += grupo.length - 1;
    };
    for (const f of lista.slice(1)) {
      if (f.anio_desde <= hasta) {
        grupo.push(f);
        hasta = Math.max(hasta, f.anio_hasta ?? 9999);
      } else {
        cerrar();
        grupo = [f];
        hasta = f.anio_hasta ?? 9999;
      }
    }
    cerrar();
  }
  return { filas: resultado, unidas };
}

function fusionarFilas(grupo) {
  if (grupo.length === 1) return { ...grupo[0], dnrpa_codigos_unidos: '' };
  const [principal] = [...grupo].sort((a, b) => b.registros - a.registros);
  const suma = (c) => grupo.reduce((s, f) => s + (Number(f[c]) || 0), 0);
  return {
    ...principal,
    anio_desde: Math.min(...grupo.map((f) => f.anio_desde)),
    anio_hasta: grupo.some((f) => f.anio_hasta == null) ? null : Math.max(...grupo.map((f) => f.anio_hasta)),
    pais_fabricacion: principal.pais_fabricacion ?? grupo.find((f) => f.pais_fabricacion)?.pais_fabricacion ?? null,
    estado_mercado: grupo.some((f) => f.estado_mercado === 'comercializado') ? 'comercializado' : principal.estado_mercado,
    registros: suma('registros'),
    dnrpa_inscripciones_0km: suma('dnrpa_inscripciones_0km'),
    dnrpa_transferencias: suma('dnrpa_transferencias'),
    dnrpa_ultimo_0km: grupo.map((f) => f.dnrpa_ultimo_0km).filter(Boolean).sort().pop() || null,
    dnrpa_codigos_unidos: grupo.filter((f) => f !== principal).map((f) => f.codigo).join(' '),
  };
}

function haceMeses(mes, n) {
  const [a, m] = mes.split('-').map(Number);
  const fecha = new Date(Date.UTC(a, m - 1 - n, 1));
  return fecha.toISOString().slice(0, 7);
}

// ------------------------------------------------------------------ caché de la agregación
// Leer los 6 millones de filas lleva varios minutos; la agregación se guarda para poder ajustar
// las reglas de normalización y volver a generar el CSV al instante (--desde-cache).
const ARCHIVO_AGREGADO = path.join(CACHE, `agregado-${ANIOS.join('-')}.json`);

function guardarAgregado(fuentes) {
  const serializable = [...versiones.values()].map((v) => ({
    ...v, marcas: [...v.marcas], modelos: [...v.modelos], tipos: [...v.tipos], origenes: [...v.origenes], anios: [...v.anios],
  }));
  fs.writeFileSync(ARCHIVO_AGREGADO, JSON.stringify({ fuentes, fechaMaxima, filasLeidas, versiones: serializable }));
}

function cargarAgregado() {
  const datos = JSON.parse(fs.readFileSync(ARCHIVO_AGREGADO, 'utf8'));
  fechaMaxima = datos.fechaMaxima;
  filasLeidas = datos.filasLeidas;
  for (const v of datos.versiones) {
    versiones.set(`${v.marcaCod}|${v.modeloCod}`, {
      ...v, marcas: new Map(v.marcas), modelos: new Map(v.modelos), tipos: new Map(v.tipos), origenes: new Map(v.origenes), anios: new Map(v.anios),
    });
  }
  return datos.fuentes;
}

// ------------------------------------------------------------------ principal
async function main() {
  fs.mkdirSync(CACHE, { recursive: true });
  let fuentes = {};
  if (process.argv.includes('--desde-cache') && fs.existsSync(ARCHIVO_AGREGADO)) {
    fuentes = cargarAgregado();
    console.log(`Usando la agregación guardada (${versiones.size} versiones, datos hasta ${fechaMaxima}).`);
  } else {
    for (const [tipo, dataset] of Object.entries(DATASETS)) {
      const info = await recursosDe(dataset);
      fuentes[tipo] = info;
      console.log(`${info.titulo}: ${info.recursos.map((r) => r.anio).join(', ')} (${info.licencia})`);
      for (const rec of info.recursos) {
        const archivo = path.join(CACHE, `${dataset}-${rec.anio}.zip`);
        await descargar(rec.url, archivo);
        await entradasCsv(archivo, async (nombre, flujo) => {
          const antes = filasLeidas;
          await procesarCsv(flujo, tipo);
          console.log(`  ${nombre}: ${(filasLeidas - antes).toLocaleString('es-AR')} filas`);
        });
      }
    }
    guardarAgregado(fuentes);
  }

  const corte = haceMeses(fechaMaxima, 12);

  // Registros por marca: una marca con 100 o más es "conocida" y puede absorber sus variantes del registro
  // ("FORD F 150" -> FORD con el modelo "F 150"; "FORD ARGENTINA S.A." -> FORD).
  const totalesMarca = new Map();
  for (const v of versiones.values()) {
    const { clave } = resolverMarca(masFrecuente(v.marcas));
    totalesMarca.set(clave, (totalesMarca.get(clave) || 0) + v.inscripciones + v.transferencias);
  }
  const RAZON_SOCIAL = /\b(ARGENTINA|S\.?\s?A\.?|S\.?R\.?L\.?|AUTOMOVIL(ES)?|MOTORS?|MOTOR CO(MPANY)?|CORPORATION|CORP\.?)\b|\([^)]*\)?|[-–]/g;
  function marcaPadre(clave) {
    const tokens = clave.split(/\s+/);
    for (let n = tokens.length - 1; n >= 1; n--) {
      const candidata = tokens.slice(0, n).join(' ');
      if ((totalesMarca.get(candidata) || 0) < 100 || candidata === clave) continue;
      const resto = tokens.slice(n).join(' ').replace(RAZON_SOCIAL, ' ').replace(/\s+/g, ' ').trim();
      return { clave: candidata, resto: resto || null };
    }
    return null;
  }
  const intermedias = [];
  const descartes = { tipo_excluido: 0, marca_excluida: 0, sin_anio: 0, variantes_unidas: 0 };
  for (const v of versiones.values()) {
    const marcaTexto = masFrecuente(v.marcas);
    const resuelta = resolverMarca(marcaTexto);
    // "FORD F 150", "KIA MOTORS", "IKA JEEP": variante de otra marca -> esa marca (y el resto, al modelo)
    const padre = marcaPadre(resuelta.clave);
    const marcaClave = padre?.clave || resuelta.clave;
    const prefijoModelo = resuelta.prefijoModelo || padre?.resto || null;
    const { carrocero } = resuelta;
    if (padre) descartes.variantes_unidas++;
    if (REGLAS.marcas_excluidas.includes(marcaClave)) { descartes.marca_excluida++; continue; }
    const tipoDnrpa = masFrecuente(v.tipos) || 'SIN ESPECIFICACION';
    const tipo = tipoDe(tipoDnrpa);
    if (tipo.tipo === null) { descartes.tipo_excluido++; continue; }

    let descripcion = masFrecuente(v.modelos) || '';
    if (prefijoModelo && !descripcion.startsWith(prefijoModelo)) descripcion = `${prefijoModelo} ${descripcion}`;
    const { modelo, version } = separarModelo(marcaClave, descripcion);
    if (!modelo) continue;
    const motor = leerMotor(descripcion);
    const [desde, hasta] = rangoAnios(v.anios);
    // Sin año de modelo no se puede ubicar la versión en el selector: no se inventa, se descarta
    if (!desde) { descartes.sin_anio++; continue; }
    const origen = masFrecuente(v.origenes);
    const segmento = REGLAS.tipos_pesados.includes(tipo.tipo) ? 'pesado'
      : REGLAS.tipos_comerciales.includes(tipo.tipo) ? 'comercial' : 'particular';

    intermedias.push({
      marcaClave,
      codigo: `DNRPA-${v.marcaCod}-${v.modeloCod}`,
      marca: nombreMarca(marcaClave),
      modelo,
      version,
      anio_desde: desde,
      anio_hasta: hasta,
      tipo_vehiculo: tipo.tipo,
      carroceria: tipo.carroceria,
      motor: motor.motor,
      cilindrada_cc: motor.cilindrada_cc,
      combustible: motor.combustible,
      aspiracion: motor.aspiracion,
      transmision: motor.transmision,
      velocidades: motor.velocidades,
      traccion: motor.traccion,
      pais_fabricacion: origen === 'Nacional' ? 'Argentina' : null,
      mercado: 'Argentina',
      estado_mercado: v.ultimo0km && v.ultimo0km >= corte ? 'comercializado' : 'discontinuado',
      segmento,
      carrocero,
      registros: v.inscripciones + v.transferencias,
      fuente: 'dnrpa',
      fuente_url: v.inscripciones ? fuentes.inscripciones.url : fuentes.transferencias.url,
      estado_verificacion: 'VERIFIED',
      confianza: 'alta',
      dnrpa_descripcion: descripcion,
      dnrpa_tipo: tipoDnrpa,
      dnrpa_origen: origen,
      dnrpa_inscripciones_0km: v.inscripciones,
      dnrpa_transferencias: v.transferencias,
      dnrpa_ultimo_0km: v.ultimo0km,
      aniosMapa: v.anios,
    });
  }

  // Segunda pasada por marca: variantes pegadas y renombres
  const porMarca = new Map();
  for (const f of intermedias) {
    if (!porMarca.has(f.marcaClave)) porMarca.set(f.marcaClave, []);
    porMarca.get(f.marcaClave).push(f);
  }
  for (const [marcaClave, lista] of porMarca) unirVariantes(lista, marcaClave);

  // Un solo nombre visible por modelo: "RAV4" y "RAV 4", o "RENAULT 19", "R19" y "19" (misma clave), se muestran
  // igual, con la grafía más registrada
  const nombres = new Map();
  for (const f of intermedias) {
    const k = `${f.marcaClave}|${claveModelo(f.marcaClave, f.modelo)}`;
    const conteo = nombres.get(k) || new Map();
    conteo.set(f.modelo, (conteo.get(f.modelo) || 0) + f.registros);
    nombres.set(k, conteo);
  }
  const conNombre = intermedias.map(({ marcaClave, ...f }) => ({
    ...f,
    modelo: nombreModelo(masFrecuente(nombres.get(`${marcaClave}|${claveModelo(marcaClave, f.modelo)}`))),
    version: f.version || 'Base',
  }));
  const recorte = recortarAniosAislados(conNombre);
  descartes.versiones_con_anios_aislados = recorte.aniosDescartados;
  descartes.versiones_solo_anios_aislados = recorte.versionesDescartadas;
  const { filas: unidasFilas, unidas } = unirCodigosRepetidos(recorte.filas);
  descartes.codigos_unidos = unidas;

  // Solo marcas argentinas o que se vendieron en Argentina. Se queda si: tiene versiones de origen nacional, o
  // tuvo al menos 5 patentamientos 0 km en el período, o tiene al menos 20 vehículos registrados (hubo venta real).
  // El resto son importaciones sueltas, casas rodantes, maquinaria o errores de carga.
  const porMarcaFinal = new Map();
  for (const f of unidasFilas) {
    const m = porMarcaFinal.get(f.marca) || { nacional: false, ceroKm: 0, registros: 0 };
    m.nacional ||= f.dnrpa_origen === 'Nacional';
    m.ceroKm += Number(f.dnrpa_inscripciones_0km) || 0;
    m.registros += Number(f.registros) || 0;
    porMarcaFinal.set(f.marca, m);
  }
  const conservar = new Set((REGLAS.marcas_conservar || []).map(nombreMarca));
  const sinVenta = new Set([...porMarcaFinal]
    .filter(([marca, m]) => !m.nacional && m.ceroKm < 5 && m.registros < 20 && !conservar.has(marca))
    .map(([marca]) => marca));
  descartes.marcas_sin_venta_en_argentina = sinVenta.size;
  descartes.marcas_descartadas = [...sinVenta].sort();
  const filas = unidasFilas.filter((f) => !sinVenta.has(f.marca)).map(({ aniosMapa: _a, ...f }) => f);
  filas.sort((a, b) => a.marca.localeCompare(b.marca) || a.modelo.localeCompare(b.modelo) || b.registros - a.registros);

  fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
  fs.writeFileSync(SALIDA, escribirCsv(filas));
  const marcas = new Set(filas.map((f) => f.marca));
  const modelos = new Set(filas.map((f) => `${f.marca}|${f.modelo}`));
  const metadatos = {
    generado_en: new Date().toISOString(),
    datos_hasta: fechaMaxima,
    anios: ANIOS,
    filas_leidas: filasLeidas,
    versiones: filas.length,
    modelos: modelos.size,
    marcas: marcas.size,
    descartes,
    columnas_usadas: ['automotor_marca_codigo', 'automotor_marca_descripcion', 'automotor_modelo_codigo', 'automotor_modelo_descripcion',
      'automotor_tipo_descripcion', 'automotor_anio_modelo', 'automotor_origen', 'tramite_fecha'],
    columnas_ignoradas: 'Todas las del titular (persona, género, año de nacimiento, localidad, país) y del registro seccional.',
    fuentes: Object.values(fuentes).map(({ titulo, url, licencia, licencia_url, recursos }) => ({
      titulo, url, licencia, licencia_url, archivos: recursos.map((r) => r.nombre),
    })),
    atribucion: 'Fuente: Dirección Nacional de los Registros Nacionales de la Propiedad del Automotor y de Créditos Prendarios (DNRPA), Ministerio de Justicia de la Nación. Datos publicados en datos.jus.gob.ar bajo licencia CC BY 4.0.',
  };
  fs.writeFileSync(path.join(path.dirname(SALIDA), 'metadatos.json'), `${JSON.stringify(metadatos, null, 2)}\n`);
  console.log(`\n${filasLeidas.toLocaleString('es-AR')} filas leídas (datos hasta ${fechaMaxima}).`);
  console.log(`${marcas.size} marcas · ${modelos.size} modelos · ${filas.length} versiones → ${SALIDA}`);
  console.log(`Descartados: ${descartes.tipo_excluido} versiones de remolques/otros, ${descartes.marca_excluida} de marcas excluidas y ${descartes.sin_anio} sin año de modelo. Unidos: ${descartes.codigos_unidos} códigos repetidos. Años aislados: recortados en ${descartes.versiones_con_anios_aislados} versiones, ${descartes.versiones_solo_anios_aislados} versiones descartadas. Variantes unidas a su marca: ${descartes.variantes_unidas}. Marcas sin venta en Argentina: ${descartes.marcas_sin_venta_en_argentina}.`);
}

main().catch((e) => {
  console.error('Error en el ETL del DNRPA:', e);
  process.exit(1);
});

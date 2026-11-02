// Carga del módulo de motos en el seed. Todo pasa por el importador (fuente, trazabilidad, duplicados) y no necesita
// internet: usa db/data/motos.js (lista de AUTONEX) y db/datos/motos/wikidata-motos.json (generado por
// scripts/motos/wikidata-motos.js, con las fotos ya descargadas en client/public/img/motos).
//
// Qué NO carga: años, versiones, motores ni repuestos de moto, porque no hay una fuente verificable para ellos
// en el proyecto. Quedan como UNKNOWN y se agregan importando catálogos (CSV, Excel, JSON, XML o API).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { importar } from '../src/importacion/importador.js';
import { categoriaDeLinea, categoriasDeModelo, tipoDeMoto } from '../src/catalogo/motos.js';
import { aplicarLogos, LOGOS_REPUESTOS } from '../src/catalogo/logos.js';
import { normalizarTexto } from '../src/catalogo/normalizacion.js';
import {
  ALIAS_MARCA_MOTO, CATEGORIAS_REPUESTOS_MOTO, LINEAS_MARCAS_REPUESTO_MOTO, MARCAS_MOTO, MARCAS_REPUESTO_MOTO, MODELOS_MOTO,
} from './data/motos.js';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const ARCHIVO_WIKIDATA = path.join(aqui, 'datos', 'motos', 'wikidata-motos.json');
const marcaDe = (nombre) => ALIAS_MARCA_MOTO[nombre] || nombre;
const siNo = (v) => (v ? 'si' : undefined);

// Ítems de Wikidata que no son un modelo: listas, familias ("XR series"), motores, prototipos, motos policiales
const NO_ES_MODELO = /^list of\b|\bseries$|\bmotorcycles$|\bengine\b|\bprototype\b|\bpolice\b/i;

/**
 * Nombre limpio de un modelo de Wikidata: sin lo que está antes de la marca ("1981 Suzuki TS125" -> "TS125",
 * "Piaggio Vespa GTS" -> "GTS", "CFMOTO 700MT" -> "700MT"), sin un año suelto al final y con el año entre paréntesis
 * como generación ("MT-03 (2006)" -> modelo "MT-03", generación 2006). null si no es un modelo.
 */
function limpiarModeloWikidata(m) {
  if (NO_ES_MODELO.test(m.nombre.trim())) return null;
  const palabras = m.nombre.trim().split(/\s+/);
  const claveMarca = normalizarTexto(m.marca).replace(/ /g, '');
  let corte = 0;
  for (let i = 0; i < palabras.length; i++) {
    for (let j = i; j < Math.min(palabras.length, i + 3); j++) {
      if (normalizarTexto(palabras.slice(i, j + 1).join('')).replace(/ /g, '') === claveMarca) corte = j + 1;
    }
  }
  let nombre = corte && corte < palabras.length ? palabras.slice(corte).join(' ') : palabras.join(' ');
  let generacion;
  const conAnio = nombre.match(/^(.*\S)\s*\(((?:19|20)\d\d)\)$/);
  if (conAnio) {
    nombre = conAnio[1];
    generacion = Number(conAnio[2]);
  }
  // Año suelto al final solo en etiquetas descriptivas ("Marc Coma KTM 660 Rally 2006"); en "Vulcan 2000" es la cilindrada
  const anioSuelto = corte > 0 && nombre.match(/^(.*[a-z].*\S)\s+(?:19|20)\d\d$/i);
  if (anioSuelto) nombre = anioSuelto[1];
  if (!nombre || normalizarTexto(nombre) === normalizarTexto(m.marca)) return null;
  return { ...m, nombre, generacion };
}

async function importarOFallar(pool, parametros, log, titulo) {
  const r = await importar(pool, { formato: 'json', ...parametros });
  log(`  ${titulo}: ${r.creado} nuevas, ${r.actualizado} actualizadas, ${r.sin_cambios} sin cambios, ${r.error} con error`);
  if (r.error) log(`    primeros errores: ${JSON.stringify(r.primeros_errores.slice(0, 3))}`);
  return r;
}

export async function sembrarMotos(pool, { log = () => {}, muestra = false } = {}) {
  await pool.query(`
    INSERT INTO fuentes (slug, nombre, tipo, url, licencia, licencia_url, terminos_revisados, licencia_verificada, api_disponible,
                         permite_uso_comercial, permite_redistribucion, nivel_confianza, atribucion, notas) VALUES
    ('lista-autonex', 'Lista de marcas y modelos de motos provista por AUTONEX', 'manual', NULL, NULL, NULL, true, true, false,
     true, true, 'baja', NULL, 'Punto de partida del catálogo de motos. Todo entra sin verificar hasta confirmarlo con el fabricante.'),
    ('wikidata', 'Wikidata', 'datos_abiertos', 'https://www.wikidata.org', 'CC0 1.0', 'https://creativecommons.org/publicdomain/zero/1.0/',
     true, true, true, true, true, 'media', 'Datos de Wikidata (CC0).', 'Modelos de motos, fabricantes y logos. Datos colaborativos: se cargan sin verificar.')
    ON CONFLICT (slug) DO NOTHING`);

  const wikidata = fs.existsSync(ARCHIVO_WIKIDATA) ? JSON.parse(fs.readFileSync(ARCHIVO_WIKIDATA, 'utf8')) : null;
  if (!wikidata) log('  (sin db/datos/motos/wikidata-motos.json: se cargan solo los modelos de la lista)');
  const marcasMuestra = new Set(['Honda', 'KTM', 'Yamaha', 'Motomel']);
  const enMuestra = (marca) => !muestra || marcasMuestra.has(marca);

  // 1) Marcas de la lista (las que ya existen por los autos se reutilizan y no se modifican)
  const filasMarcas = [];
  for (const [grupo, marcas] of Object.entries(MARCAS_MOTO)) {
    for (const nombre of marcas.map(marcaDe).filter(enMuestra)) {
      filasMarcas.push({
        nombre, segmento: 'moto',
        oficial_argentina: siNo(grupo === 'argentina'), disponible_argentina: siNo(grupo === 'argentina'),
      });
    }
  }
  await importarOFallar(pool, { entidad: 'marcas', fuente: 'lista-autonex', filas: filasMarcas, opciones: { crearDuplicados: true } }, log, 'marcas de motos (lista)');

  // Marcas que solo vienen de Wikidata (internacionales/históricas y fabricantes argentinos)
  const deLista = new Set(filasMarcas.map((m) => m.nombre));
  // Un modelo de Wikidata con las mismas palabras que uno de la lista en otro orden ("Duke 200" / "200 Duke") es el mismo
  const ordenado = (texto) => normalizarTexto(texto).split(' ').flatMap((x) => x.split(/(?<=[a-z])(?=\d)|(?<=\d)(?=[a-z])/)).sort().join(' ');
  const nombreDeLista = new Map();
  for (const [marcaLista, modelos] of Object.entries(MODELOS_MOTO)) {
    for (const nombre of modelos) nombreDeLista.set(`${marcaDe(marcaLista)}|${ordenado(nombre)}`, nombre);
  }
  // Varios ítems de Wikidata pueden ser el mismo modelo ("MT-03 (2006)" y "MT-03 (2016)" son generaciones de MT-03):
  // se agrupan en un modelo con sus generaciones y todas sus fotos (la principal, la de la generación más nueva)
  const grupos = new Map();
  for (const crudo of wikidata?.modelos || []) {
    const limpio = limpiarModeloWikidata({ ...crudo, marca: marcaDe(crudo.marca) });
    if (!limpio || !enMuestra(limpio.marca)) continue;
    const nombre = nombreDeLista.get(`${limpio.marca}|${ordenado(limpio.nombre)}`) || limpio.nombre;
    const clave = `${limpio.marca}|${ordenado(nombre)}`;
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push({ ...limpio, nombre });
  }
  const modelosWikidata = [...grupos.values()].map((items) => {
    const inicio = (x) => x.generacion || x.anio_desde || 0;
    items.sort((a, b) => inicio(a) - inicio(b));
    const desdes = items.map((x) => x.generacion || x.anio_desde).filter(Boolean);
    return {
      ...items[0],
      wikidata: items.find((x) => !x.generacion)?.wikidata,
      // Años del modelo solo si se conocen los de todos sus ítems; "hasta" vacío si alguno sigue o no se sabe
      anio_desde: desdes.length === items.length ? Math.min(...desdes) : undefined,
      anio_hasta: items.every((x) => x.anio_hasta) ? Math.max(...items.map((x) => x.anio_hasta)) : undefined,
      generaciones: items.filter((x) => x.generacion)
        .map((x) => ({ nombre: `${x.nombre} (${x.generacion})`, anio_desde: x.generacion, anio_hasta: x.anio_hasta, wikidata: x.wikidata })),
      imagenes: items.map((x) => x.imagen).filter((i) => i?.archivo),
    };
  });
  const marcasWikidata = [...new Set(modelosWikidata.map((m) => m.marca))].filter((m) => !deLista.has(m));
  if (marcasWikidata.length) {
    await importarOFallar(pool, {
      entidad: 'marcas', fuente: 'wikidata', opciones: { crearDuplicados: true },
      filas: marcasWikidata.map((nombre) => {
        const grupo = modelosWikidata.find((m) => m.marca === nombre)?.grupo;
        // Fabricantes argentinos según Wikidata (país = Argentina): se vendieron en el país
        return { nombre, segmento: 'moto', internacional: siNo(grupo === 'internacional'), historico_argentina: siNo(grupo === 'argentina') };
      }),
    }, log, 'marcas de motos (Wikidata)');
  }

  // 2) Modelos: primero la lista, después Wikidata (que completa con los que faltan)
  const filasLista = [];
  for (const [marcaLista, modelos] of Object.entries(MODELOS_MOTO)) {
    const marca = marcaDe(marcaLista);
    if (!enMuestra(marca)) continue;
    for (const nombre of modelos) {
      const categorias = categoriasDeModelo(marca, nombre);
      filasLista.push({ marca, nombre, segmento: 'moto', tipo_vehiculo: tipoDeMoto(categorias) });
    }
  }
  await importarOFallar(pool, { entidad: 'modelos', fuente: 'lista-autonex', filas: filasLista, opciones: { crearDuplicados: true } }, log, 'modelos de motos (lista)');

  if (modelosWikidata.length) {
    await importarOFallar(pool, {
      entidad: 'modelos', fuente: 'wikidata', opciones: { crearDuplicados: true },
      filas: modelosWikidata.map((m) => ({
        marca: m.marca, nombre: m.nombre, segmento: 'moto', wikidata: m.wikidata,
        tipo_vehiculo: tipoDeMoto(categoriasDeModelo(m.marca, m.nombre, { scooter: m.tipo === 'scooter' })),
        anio_desde: m.anio_desde || undefined, anio_hasta: m.anio_hasta || undefined,
        internacional: siNo(m.grupo === 'internacional'),
      })),
    }, log, 'modelos de motos (Wikidata)');
  }

  // 3) Categorías por familia de modelo (clasificación de AUTONEX, sin verificar)
  const filasCategorias = [
    ...filasLista.map((f) => ({ marca: f.marca, modelo: f.nombre, categorias: categoriasDeModelo(f.marca, f.nombre) })),
    ...modelosWikidata.map((m) => ({ marca: m.marca, modelo: m.nombre, categorias: categoriasDeModelo(m.marca, m.nombre, { scooter: m.tipo === 'scooter' }) })),
  ].filter((f) => f.categorias.length).map((f) => ({ ...f, categorias: f.categorias.join(';') }));
  await importarOFallar(pool, {
    entidad: 'categorias_moto', fuente: 'autonex', filas: filasCategorias,
    opciones: { estadoPorDefecto: 'UNVERIFIED', confianzaPorDefecto: 'baja' },
  }, log, 'categorías de modelos de moto');

  // Generaciones que Wikidata distingue por año ("MT-03 (2006)")
  const filasGeneraciones = modelosWikidata.flatMap((m) => m.generaciones.map((g, i) => ({
    marca: m.marca, modelo: m.nombre, nombre: g.nombre, numero: i + 1, anio_desde: g.anio_desde, anio_hasta: g.anio_hasta || undefined,
    fuente_url: g.wikidata ? `https://www.wikidata.org/wiki/${g.wikidata}` : undefined,
  })));
  if (filasGeneraciones.length) {
    await importarOFallar(pool, { entidad: 'generaciones', fuente: 'wikidata', filas: filasGeneraciones }, log, 'generaciones de motos (Wikidata)');
  }

  // 4) Fotos reales (Wikimedia Commons, licencia libre) ya descargadas; la última es la principal
  const filasFotos = modelosWikidata.flatMap((m) => m.imagenes.map((imagen, i) => ({
    entidad: 'modelo', marca_vehiculo: m.marca, modelo: m.nombre, tipo: 'principal', principal: i === m.imagenes.length - 1 ? 'si' : 'no',
    archivo: imagen.archivo, url_imagen: imagen.url_imagen, url_origen: imagen.url_origen, autor: imagen.autor,
    licencia: imagen.licencia, licencia_url: imagen.licencia_url || undefined, permiso: 'libre',
    hash_sha256: imagen.hash_sha256, ancho: imagen.ancho, alto: imagen.alto, descargado_en: imagen.descargado_en,
  })));
  if (filasFotos.length) {
    await importarOFallar(pool, { entidad: 'imagenes', fuente: 'wikimedia-commons', filas: filasFotos }, log, 'fotos de motos');
  }

  // 5) Repuestos de motos: categorías (raíz "Motos") y marcas de repuestos
  // Orden correlativo después de las categorías de autos (que usan 1..N)
  let orden = 500;
  const filasRepuestos = [{ nombre: 'Motos', slug: 'motos', prefijo_sku: 'MTO', rubro: 'motos', orden: orden++,
    descripcion: 'Repuestos para motos: motor, transmisión, frenos, suspensión, eléctrico, carrocería y off-road.' }];
  for (const [slug, nombre, hijas] of CATEGORIAS_REPUESTOS_MOTO) {
    filasRepuestos.push({ nombre, slug: `moto-${slug}`, padre: 'motos', rubro: 'motos', orden: orden++ });
    for (const hija of hijas) {
      // Una hija puede tener sus propias hijas: ['Neumáticos', ['Neumáticos de motocross', …]]
      const [nombreHija, nietas = []] = Array.isArray(hija) ? hija : [hija];
      filasRepuestos.push({ nombre: nombreHija, padre: `Motos > ${nombre}`, rubro: 'motos', orden: orden++ });
      for (const nieta of nietas) filasRepuestos.push({ nombre: nieta, padre: `Motos > ${nombre} > ${nombreHija}`, rubro: 'motos', orden: orden++ });
    }
  }
  await importarOFallar(pool, { entidad: 'categorias', fuente: 'autonex', filas: filasRepuestos }, log, 'categorías de repuestos de motos');
  // Foto de la categoría raíz: una moto real de Commons (ilustra el rubro, no se usa como foto de ningún repuesto)
  const portada = modelosWikidata.find((m) => m.imagenes.length && m.marca === 'Honda' && /^CRF250R$/i.test(m.nombre))
    || modelosWikidata.find((m) => m.imagenes.length);
  if (portada) await pool.query("UPDATE categorias SET imagen = $1 WHERE slug = 'motos'", [`/${portada.imagenes.at(-1).archivo}`]);

  const marcasRepuesto = [...new Set([...Object.keys(LINEAS_MARCAS_REPUESTO_MOTO), ...Object.values(MARCAS_REPUESTO_MOTO).flat()])];
  await importarOFallar(pool, {
    entidad: 'marcas_repuesto', fuente: 'lista-autonex', opciones: { crearDuplicados: true },
    filas: marcasRepuesto.map((nombre) => ({ nombre, para_motos: 'si' })),
  }, log, 'marcas de repuestos para motos');
  // Qué fabrica cada marca, relacionado con la categoría del catálogo (no son productos)
  const filasLineas = Object.entries(LINEAS_MARCAS_REPUESTO_MOTO).flatMap(([marca, lineas]) => lineas.map((linea, i) => ({
    marca, linea, categoria: categoriaDeLinea(marca, linea) || undefined, orden: i + 1,
  })));
  await importarOFallar(pool, { entidad: 'lineas_marca_repuesto', fuente: 'lista-autonex', filas: filasLineas }, log, 'líneas de producto de las marcas');
  // Logos ya descargados (npm run logos:marcas -- --repuestos)
  log(`  logos de marcas de repuestos: ${await aplicarLogos(pool, LOGOS_REPUESTOS)}`);
  // Las marcas nuevas de la lista son solo de motos; las que ya vendían repuestos de autos siguen sirviendo para los dos
  await pool.query(`
    UPDATE marcas_repuesto mr SET para_autos = false
      FROM fuentes f
     WHERE f.slug = 'lista-autonex' AND mr.fuente_id = f.id
       AND NOT EXISTS (SELECT 1 FROM productos p WHERE p.marca_repuesto_id = mr.id)`);
}

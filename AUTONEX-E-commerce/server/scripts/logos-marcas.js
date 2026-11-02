// Logos de las marcas de vehículos.
//
//   npm run logos:marcas -w autonex-server              busca y descarga los logos que falten
//   npm run logos:marcas -w autonex-server -- --todas   vuelve a buscar todos
//   npm run logos:marcas -w autonex-server -- --aplicar solo guarda en la base los logos ya descargados
//   npm run logos:marcas -w autonex-server -- --rehacer=bmw,fiat   borra esos logos y los vuelve a buscar
//   npm run logos:marcas -w autonex-server -- --aplicar --limpiar  borra los logos de marcas que ya no están
//   npm run logos:marcas -w autonex-server -- --repuestos          lo mismo para las marcas de repuestos para motos
//                                                                  (img/marcas-repuesto/logos, solo Wikidata + Commons)
//
// Fuentes, en este orden:
//   1. Wikidata (propiedad P154 "logo") + Wikimedia Commons: solo aloja archivos libres o de dominio público, y de
//      cada uno se guarda autor y licencia. Una sola consulta SPARQL trae los fabricantes y marcas de vehículos que
//      tienen logo (así se respetan los límites de Wikimedia); se acepta un candidato solo si su nombre o alias es el
//      de la marca. Se usa el logo vigente (sin fecha de fin) y nunca una foto (.jpg) cargada por error como logo.
//   2. Beepaway (beepaway.com/es/logos): logos PNG que ese sitio ofrece para uso educativo o no comercial. Se usa
//      solo para marcas que no están en Commons, bajando de a uno las URL directas que el sitio publica.
// Las marcas sin logo en ninguna de las dos siguen mostrando sus iniciales: no se inventa ningún logo.
//
// Resultado: client/public/img/marcas/logos/<slug>.png + logos.json (fuente, autor y licencia de cada uno).

import fs from 'node:fs';
import path from 'node:path';
import { pool } from '../src/db.js';
import { config } from '../src/config.js';
import { normalizarTexto } from '../src/catalogo/normalizacion.js';
import { aplicarLogos, CARPETA_LOGOS as CARPETA_VEHICULOS, LOGOS_REPUESTOS } from '../src/catalogo/logos.js';

const { default: sharp } = await import('sharp').catch(() => {
  console.error('Falta sharp. Instalalo con: npm install -D sharp -w autonex-server');
  process.exit(1);
});

const UA = 'AUTONEX/1.0 (https://gnuino.com.ar/AUTONEX; proyecto universitario, logos de marcas)';
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const todas = process.argv.includes('--todas');
const soloAplicar = process.argv.includes('--aplicar');
// --repuestos: marcas de repuestos para motos (Brembo, NGK, Michelin…) en vez de marcas de vehículos
const REPUESTOS = process.argv.includes('--repuestos');
const TABLA = REPUESTOS ? LOGOS_REPUESTOS.tabla : 'marcas_vehiculo';
const CARPETA_LOGOS = REPUESTOS ? LOGOS_REPUESTOS.carpeta : CARPETA_VEHICULOS;
const CARPETA = path.join(config.clientePublic, CARPETA_LOGOS);
const MANIFIESTO = path.join(CARPETA, 'logos.json');

// Otros nombres con los que la marca figura en Wikidata (además del nombre del registro)
const OTROS_NOMBRES = {
  ram: ['Ram Trucks'], ds: ['DS Automobiles'], mg: ['MG Motor', 'MG Cars'], ika: ['Industrias Kaiser Argentina'],
  international: ['International Trucks', 'Navistar International'], asia: ['Asia Motors'],
  dfm: ['Dongfeng Motor Corporation'], dongfeng: ['Dongfeng Motor Corporation'], tata: ['Tata Motors'],
  hino: ['Hino Motors'], isuzu: ['Isuzu Motors'], mitsubishi: ['Mitsubishi Motors'], geely: ['Geely Auto'],
  chery: ['Chery Automobile'], jac: ['JAC Motors', 'Jianghuai Automobile'], baic: ['BAIC Group', 'BAIC Motor'],
  gac: ['GAC Group', 'GAC Motor'], jmc: ['Jiangling Motors'], foton: ['Foton Motor'], daewoo: ['Daewoo Motors'],
  shacman: ['Shaanxi Automobile Group'], changan: ['Changan Automobile'], 'great-wall': ['Great Wall Motor'],
  hyundai: ['Hyundai Motor Company'], kia: ['Kia Motors'], nissan: ['Nissan Motor'], honda: ['Honda Motor Company'],
  toyota: ['Toyota Motor Corporation'], ford: ['Ford Motor Company'], suzuki: ['Suzuki Motor'], subaru: ['Subaru Corporation'],
  mazda: ['Mazda Motor Corporation'], lifan: ['Lifan Group'], byd: ['BYD Auto'], scania: ['Scania AB'],
  dfsk: ['Dongfeng Sokon'], smart: ['Smart (marque)'], 'volvo': ['Volvo Cars'], daihatsu: ['Daihatsu Motor'],
  'king-long': ['King Long'], 'mercedes-benz': ['Mercedes-Benz'], lada: ['Lada'],
  man: ['MAN Truck & Bus', 'MAN SE'], mack: ['Mack Trucks'], freightliner: ['Freightliner Trucks'], kenworth: ['Kenworth'],
  'western-star': ['Western Star Trucks'], sterling: ['Sterling Trucks'], lincoln: ['Lincoln Motor Company'],
  rover: ['Rover Company', 'Rover (marque)'], maruti: ['Maruti Suzuki'], faw: ['FAW Group', 'First Automobile Works'],
  gaz: ['GAZ', 'GAZ Group'], uaz: ['UAZ'], yutong: ['Yutong Bus', 'Yutong'], lifan: ['Lifan Group', 'Lifan'],
  mahindra: ['Mahindra & Mahindra', 'Mahindra Automotive'], saturn: ['Saturn Corporation'],
  triumph: ['Triumph Motorcycles Ltd', 'Triumph Motor Company', 'Triumph Motorcycles'], morris: ['Morris Motors'],
  // Motos: nombre de la empresa en Wikidata
  bajaj: ['Bajaj Auto'], hero: ['Hero MotoCorp'], husqvarna: ['Husqvarna Motorcycles'], zero: ['Zero Motorcycles'],
  cz: ['Česká zbrojovka Strakonice'], zundapp: ['Zündapp'], ajs: ['AJS'], matchless: ['Matchless'], tvs: ['TVS Motor Company'], austin: ['Austin Motor Company'],
  morgan: ['Morgan Motor Company'], delorean: ['DeLorean Motor Company'], kaiyi: ['Kaiyi Auto'],
  forthing: ['Dongfeng Forthing'], exeed: ['Exeed'], sany: ['Sany', 'Sany Group'], xcmg: ['XCMG'],
  zoomlion: ['Zoomlion'], caterpillar: ['Caterpillar Inc.'], 'beiben-truck': ['Beiben Trucks', 'Beiben'],
  'steyr-daimler-puch': ['Steyr-Daimler-Puch'], 'pegaso-ipv': ['Pegaso'], messerschmit: ['Messerschmitt'],
  'jowett-javelin': ['Jowett Cars'], heinekel: ['Heinkel'], 'ac-bristol': ['AC Cars'], samsung: ['Renault Samsung Motors'],
  white: ['White Motor Company'], fargo: ['Fargo Trucks'], sitrak: ['Sitrak'], howo: ['Sinotruk'], hongyan: ['SAIC-Iveco Hongyan'],
  jiefang: ['FAW Jiefang'], doosan: ['Doosan Infracore', 'Doosan'], liebherr: ['Liebherr'], terex: ['Terex'],
  'nissan-diesel': ['UD Trucks'], 'austin-healey': ['Austin-Healey'], 'american-lafrance': ['American LaFrance'],
  pierce: ['Pierce Manufacturing'], winnebago: ['Winnebago Industries'], 'forest-river': ['Forest River'],
  'thor-motor-coach': ['Thor Industries'], izh: ['Izhevsk Mechanical Plant'], tavria: ['ZAZ'], oltcit: ['Oltcit'],
  skywell: ['Skywell'], aeolus: ['Dongfeng Aeolus'], jmev: ['JMEV'], shineray: ['Shineray'], 'zhong-tong': ['Zhongtong Bus'],
  krupp: ['Krupp'], kalmar: ['Kalmar'], grove: ['Grove (cranes)', 'Manitowoc Company'], 'armstrong-siddeley': ['Armstrong Siddeley'],
  'arctic-cat': ['Arctic Cat'], segway: ['Segway Inc.'], mudan: ['Mudan'], 'han-jiang': ['Hanjiang'], camc: ['CAMC'],
};

// Marcas de repuestos: nombre de la empresa en Wikidata (slug de AUTONEX -> nombres). No se usan los logos del grupo
// dueño de la marca (Mann+Hummel para Mann-Filter, JTEKT para Koyo): se busca el de la marca.
const OTROS_NOMBRES_REPUESTOS = {
  'k-n': ['K&N Engineering'], bmc: ['BMC Air Filter', 'BMC Filters'], 'uni-filter': ['UNI Filter', 'Uni Filter Inc.'],
  mahle: ['Mahle GmbH', 'MAHLE'], bosch: ['Robert Bosch GmbH'], brembo: ['Brembo S.p.A.'], ebc: ['EBC Brakes'],
  trw: ['TRW Automotive'], regina: ['Regina Catene Calibrate'], sunstar: ['Sunstar Engineering'],
  ohlins: ['Öhlins Racing', 'Öhlins Racing AB'], kyb: ['KYB Corporation', 'Kayaba Industry'], showa: ['Showa Corporation'],
  wp: ['WP Suspension', 'WP Performance Systems'], marzocchi: ['Marzocchi (company)'], ntn: ['NTN Corporation'],
  nsk: ['NSK Ltd.', 'NSK'], fag: ['FAG Kugelfischer'], ngk: ['NGK Spark Plug', 'Niterra'], denso: ['Denso Corporation'],
  champion: ['Champion (spark plugs)', 'Champion Spark Plug'], mitsuba: ['Mitsuba Corporation'],
  shindengen: ['Shindengen Electric Manufacturing'], kokusan: ['Kokusan Denki'], gates: ['Gates Corporation'],
  bando: ['Bando Chemical Industries'], dunlop: ['Dunlop Tyres'], metzeler: ['Metzeler (tire)', 'Metzeler'],
  mitas: ['Mitas (company)', 'Mitas'], maxxis: ['Maxxis International', 'Cheng Shin Rubber'], kenda: ['Kenda Rubber Industrial Company'],
  shinko: ['Shinko Tire'], irc: ['IRC Tire', 'Inoue Rubber'], continental: ['Continental AG'], 'magneti-marelli': ['Magneti Marelli'],
  hella: ['Hella (company)', 'Hella GmbH & Co. KGaA'], sachs: ['Sachs (company)', 'ZF Sachs'], timken: ['Timken Company'],
  ufi: ['UFI Filters'], nissin: ['Nissin Kogyo'], exedy: ['Exedy Corporation'], mitsuboshi: ['Mitsuboshi Belting'],
  hiflofiltro: ['HifloFiltro'], ferodo: ['Ferodo'], galfer: ['Galfer'], renthal: ['Renthal'], rekluse: ['Rekluse'],
  michelin: ['Michelin'], pirelli: ['Pirelli'], bridgestone: ['Bridgestone'], heidenau: ['Reifenwerk Heidenau'],
};
// Una empresa de repuestos se acepta si su descripción habla de piezas, neumáticos, frenos, filtros, etc.
const DE_REPUESTOS = /\b(tyres?|tires?|bearings?|automotive|auto ?parts|car parts|motorcycles?|brakes?|braking|filters?|filtration|spark plugs?|chains?|suspensions?|shock absorbers?|components?|clutch(es)?|belts?|sprockets?|batter(y|ies)|ignition|lubricants?|rubber|motorsport|vehicles?)\b/i;

// Beepaway: logos publicados en beepaway.com/es/logos (slug de AUTONEX -> archivo del sitio)
const BEEPAWAY = new Set(['volkswagen', 'toyota', 'bmw', 'skoda', 'renault', 'peugeot', 'mercedes-benz', 'audi', 'dacia',
  'hyundai', 'kia', 'opel', 'ford', 'citroen', 'volvo', 'tesla', 'fiat', 'seat', 'nissan', 'mg', 'cupra', 'suzuki', 'mazda',
  'mini', 'jeep', 'land-rover', 'porsche', 'lexus', 'honda', 'mitsubishi', 'byd', 'ds-automobiles', 'alfa-romeo', 'lancia',
  'polestar', 'jaguar', 'subaru', 'genesis', 'nio', 'cadillac', 'smart', 'lynk-co', 'xiaomi', 'abarth', 'vinfast', 'xpeng',
  'kgm', 'onvo', 'omoda', 'gwm-ora', 'maserati', 'leapmotor', 'ferrari', 'lucid', 'gwm-wey', 'alpine', 'jaecoo', 'ineos',
  'lamborghini', 'firefly', 'bentley', 'zeekr', 'mclaren', 'aston-martin', 'avatr', 'seres', 'lotus', 'hongqi', 'fisker',
  'rolls-royce', 'rimac', 'bugatti']);
const BEEPAWAY_ALIAS = { ds: 'ds-automobiles' };

// Revisión manual de la hoja de logos: en Wikidata estas marcas tienen el logo de otra empresa (la dueña o una
// marca vecina), así que no se toman de ahí; y para estas otras el logo de Beepaway es el emblema habitual.
const SIN_WIKIDATA = new Set(REPUESTOS
  // Repuestos: el logo de Wikidata es de otra empresa con el mismo nombre (un supermercado, bicicletas Sachs, la BMC
  // de autos), del
  // grupo dueño (Niterra para NGK) o de otra marca
  ? ['champion', 'sachs', 'ngk', 'barnett', 'regina', 'sbs', 'fag', 'bmc']
  : ['dfsk', 'faun', 'fso', 'willys', 'metro', 'samsung', 'suzuki-samurai',
    // Motos: en Wikidata figura el logo de otra marca del grupo (Yezdi)
    'jawa',
    // Revisión de los logos JPG: de otra empresa (Triumph TWN, la Mondial italiana) o fotos donde no se lee el logo
    'triumph', 'mondial', 'rover', 'morris', 'forthing']);
const SOLO_BEEPAWAY = REPUESTOS ? {} : { bmw: 'bmw', 'b-m-w': 'bmw', fiat: 'fiat', seat: 'seat' };
// Logos de Commons asignados a mano: marcas que no tienen el logo en Wikidata o lo tienen en una entidad con otro
// nombre (revisados uno por uno: es el logo de la marca, no el del grupo dueño)
const MANUALES = REPUESTOS
  ? {
    bosch: 'Bosch-logo.svg', bridgestone: 'Bridgestone logo.svg', ohlins: 'Oehlins logo.svg', metzeler: 'Metzeler.png',
    timken: 'Timken.svg', mahle: 'Mahle.svg', ntn: 'NTN Corporation Logo.svg', marzocchi: 'Marzocchi Motor Logo.png',
    dayco: 'Dayco-Tagline-Logo.png', sachs: 'ZF Sachs logo.svg', shindengen: 'Shindengen Electric company logo.svg',
    hitachi: 'Hitachi 2025 logo.svg',
  }
  : { 'king-long': 'Logo King Long.png', shineray: 'Shineray 250x250 Mesa de trabajo 1.jpg', triumph: 'Triumph logo-actual.jpg' };

// --rehacer bmw,fiat: borra esos logos y los vuelve a buscar
const rehacer = (process.argv.find((a) => a.startsWith('--rehacer=')) || '').replace('--rehacer=', '').split(',').filter(Boolean);

// Fabricantes de automóviles (y subclases), empresas de la industria automotriz y marcas que producen autos,
// camiones, colectivos o motos, con logo cargado. Trae el rango y la fecha de fin de cada logo.
const CONSULTA = `
SELECT ?item ?logo ?rank ?fin ?es ?en ?desc (GROUP_CONCAT(DISTINCT ?alias; separator="|") AS ?alias_lista) WHERE {
  { ?item wdt:P31/wdt:P279* wd:Q786820 . }
  UNION { ?item wdt:P31 wd:Q15081030 . }
  UNION { ?item wdt:P452 wd:Q190117 . }
  UNION { ?item wdt:P1056 ?producto . VALUES ?producto { wd:Q1420 wd:Q43193 wd:Q5638 wd:Q34493 } }
  ?item p:P154 ?st .
  ?st ps:P154 ?logo ; wikibase:rank ?rank .
  FILTER(?rank != wikibase:DeprecatedRank)
  OPTIONAL { ?st pq:P582 ?fin }
  OPTIONAL { ?item rdfs:label ?es FILTER(LANG(?es) = "es") }
  OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?item schema:description ?desc FILTER(LANG(?desc) = "en") }
  OPTIONAL { ?item skos:altLabel ?alias FILTER(LANG(?alias) IN ("es", "en")) }
}
GROUP BY ?item ?logo ?rank ?fin ?es ?en ?desc`;

// Segunda consulta, por nombre exacto, para fabricantes que no figuran como "automotrices" en Wikidata (camiones,
// maquinaria, casas rodantes, motos). Sin filtro de clase, así que se exige una descripción de vehículos.
const VEHICULAR = /\b(car|cars|automobiles?|automotive|automaker|vehicles?|trucks?|lorr(y|ies)|bus(es)?|coach(es)?|motorcycles?|motorbikes?|scooters?|two-wheelers?|three-wheelers?|tractors?|trailers?|pickups?|suvs?|marque|cranes?|construction (equipment|machinery)|heavy equipment|machinery|motorhomes?|recreational vehicles?|rvs?|fire (apparatus|engines?|trucks?)|forklifts?)\b/i;
const consultaPorNombre = (nombres) => `
SELECT ?item ?nombre ?logo ?rank ?fin ?desc ?etiqueta WHERE {
  VALUES ?nombre { ${nombres.map((n) => `${JSON.stringify(n)}@en ${JSON.stringify(n)}@es`).join(' ')} }
  { ?item rdfs:label ?nombre } UNION { ?item skos:altLabel ?nombre }
  ?item p:P154 ?st .
  ?st ps:P154 ?logo ; wikibase:rank ?rank .
  FILTER(?rank != wikibase:DeprecatedRank)
  OPTIONAL { ?st pq:P582 ?fin }
  OPTIONAL { ?item schema:description ?desc FILTER(LANG(?desc) = "en") }
  OPTIONAL { ?item rdfs:label ?etiqueta FILTER(LANG(?etiqueta) = "en") }
}`;

// Marcas del registro que son una variante o un error de tipeo de otra: usan el logo de esa marca
const VARIANTE_DE = {
  reanult: 'renault', renualt: 'renault', peugoet: 'peugeot', mesrcedez: 'mercedes-benz', internacional: 'international',
  'navistar-internacional': 'international', 'range-rover': 'land-rover', 'zheng-zhou-dong-feng': 'dongfeng',
  'suzuki-samurai': 'suzuki',
};

/** Busca por nombre exacto (y otros nombres conocidos) las marcas que no aparecieron en la primera consulta. */
async function buscarPorNombre(marcas) {
  const variantes = (m) => {
    const base = [m.nombre, ...((REPUESTOS ? OTROS_NOMBRES_REPUESTOS : OTROS_NOMBRES)[m.slug] || [])];
    return [...new Set(base.flatMap((n) => [n, n.toUpperCase(), n.replace(/\b\p{L}/gu, (l) => l.toUpperCase())]))];
  };
  const todos = [...new Set(marcas.flatMap(variantes))];
  const porItem = new Map();
  // De a 40 nombres: con más, la consulta (que también busca en los alias) puede pasar el límite de tiempo de Wikidata
  for (let i = 0; i < todos.length; i += 40) {
    const r = await pedir('https://query.wikidata.org/sparql', {
      method: 'POST',
      headers: { Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ query: consultaPorNombre(todos.slice(i, i + 40)) }),
    });
    for (const f of r?.results.bindings || []) {
      const id = f.item.value.split('/').pop();
      const e = porItem.get(id) || { id, logos: [], etiqueta: f.etiqueta?.value || id, descripcion: f.desc?.value || '', nombres: new Set() };
      e.logos.push({ archivo: decodeURIComponent(f.logo.value.split('/').pop()).replace(/_/g, ' '), preferido: f.rank.value.endsWith('PreferredRank'), fin: Boolean(f.fin) });
      e.nombres.add(f.nombre.value);
      porItem.set(id, e);
    }
    await esperar(2000);
  }
  // Nombres de cada entidad encontrada (para comparar con la marca) y solo las de vehículos
  const indice = new Map();
  for (const e of porItem.values()) {
    // Vale si la descripción o el nombre ("Zero Motorcycles") hablan de vehículos
    const filtro = REPUESTOS ? DE_REPUESTOS : VEHICULAR;
    if (!filtro.test(e.descripcion) && ![...e.nombres].some((n) => filtro.test(n))) continue;
    for (const k of [...e.nombres].map(compacto)) {
      if (!indice.has(k)) indice.set(k, []);
      indice.get(k).push(e);
    }
  }
  const resultado = [];
  for (const m of marcas) {
    const claves = [m.nombre, ...((REPUESTOS ? OTROS_NOMBRES_REPUESTOS : OTROS_NOMBRES)[m.slug] || [])].map(compacto);
    const e = claves.flatMap((k) => indice.get(k) || [])[0];
    const archivo = e && logoVigente(e.logos);
    if (archivo && !SIN_WIKIDATA.has(m.slug)) resultado.push({ marca: m, id: e.id, archivo, etiqueta: e.etiqueta, descripcion: e.descripcion });
  }
  return resultado;
}

async function pedir(url, opciones = {}, comoJson = true) {
  for (let intento = 1; intento <= 6; intento++) {
    const r = await fetch(url, { ...opciones, headers: { 'User-Agent': UA, ...(opciones.headers || {}) } }).catch(() => null);
    if (r?.ok) return comoJson ? r.json() : Buffer.from(await r.arrayBuffer());
    if (r && r.status === 404) return null;
    // Si Wikimedia pide esperar (429), se respeta Retry-After
    const espera = Number(r?.headers.get('retry-after')) * 1000 || 5000 * intento;
    await esperar(Math.min(espera, 60000));
  }
  return null;
}

const compacto = (t) => normalizarTexto(t).replace(/[^a-z0-9]/g, '');
const textoPlano = (html) => String(html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

/** Una consulta SPARQL: entidades de vehículos con logo, indexadas por nombre y alias normalizados. */
async function indiceWikidata() {
  const r = await pedir('https://query.wikidata.org/sparql', {
    method: 'POST',
    headers: { Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ query: CONSULTA }),
  });
  if (!r) throw new Error('Wikidata no respondió la consulta SPARQL');
  const porItem = new Map();
  for (const f of r.results.bindings) {
    const id = f.item.value.split('/').pop();
    const e = porItem.get(id) || {
      id, logos: [], nombres: new Set(), etiqueta: f.es?.value || f.en?.value || id, descripcion: f.desc?.value || '',
    };
    e.logos.push({
      archivo: decodeURIComponent(f.logo.value.split('/').pop()).replace(/_/g, ' '),
      preferido: f.rank.value.endsWith('PreferredRank'),
      fin: Boolean(f.fin),
    });
    for (const n of [f.es?.value, f.en?.value, ...(f.alias_lista?.value || '').split('|')]) if (n) e.nombres.add(n);
    porItem.set(id, e);
  }
  const indice = new Map();
  for (const e of porItem.values()) {
    for (const n of e.nombres) {
      const k = compacto(n);
      if (!k) continue;
      if (!indice.has(k)) indice.set(k, []);
      indice.get(k).push(e);
    }
  }
  console.log(`Wikidata: ${porItem.size} fabricantes y marcas de vehículos con logo`);
  return indice;
}

/** Logo vigente: nunca una foto (.jpg); primero los que no terminaron, después el preferido, después SVG. */
function logoVigente(logos) {
  // JPG solo si no hay otro (varias marcas de motos clásicas tienen el logo como foto del emblema: se revisa a ojo)
  const orden = (l) => (l.fin ? 4 : 0) + (l.preferido ? 0 : 2) + (/\.svg$/i.test(l.archivo) ? 0 : 1) + (/\.jpe?g$/i.test(l.archivo) ? 8 : 0);
  return logos.filter((l) => /\.(svg|png|gif|jpe?g)$/i.test(l.archivo)).sort((a, b) => orden(a) - orden(b))[0]?.archivo || null;
}

/** La entidad cuyo nombre (o alias) es exactamente el de la marca; se prefiere la que lo tiene como nombre principal. */
function elegir(marca, indice) {
  if (SIN_WIKIDATA.has(marca.slug) || SOLO_BEEPAWAY[marca.slug] || VARIANTE_DE[marca.slug]) return null;
  const claves = [marca.nombre, ...(OTROS_NOMBRES[marca.slug] || [])].map(compacto).filter(Boolean);
  const candidatos = [];
  for (const [prioridad, clave] of claves.entries()) {
    for (const e of indice.get(clave) || []) {
      const archivo = logoVigente(e.logos);
      if (!archivo) continue;
      const porEtiqueta = compacto(e.etiqueta) === clave;
      candidatos.push({ e, archivo, puntaje: (porEtiqueta ? 0 : 10) + prioridad });
    }
  }
  candidatos.sort((a, b) => a.puntaje - b.puntaje);
  const mejor = candidatos[0];
  return mejor ? { id: mejor.e.id, archivo: mejor.archivo, etiqueta: mejor.e.etiqueta, descripcion: mejor.e.descripcion } : null;
}

/** Datos de los archivos de Commons (miniatura PNG de 500 px, autor y licencia), de a 40 por consulta. */
async function datosCommons(archivos) {
  const datos = new Map();
  for (let i = 0; i < archivos.length; i += 40) {
    const lote = archivos.slice(i, i + 40);
    const r = await pedir(`https://commons.wikimedia.org/w/api.php?${new URLSearchParams({
      format: 'json', action: 'query', titles: lote.map((a) => `File:${a}`).join('|'), prop: 'imageinfo',
      iiprop: 'url|extmetadata|mime|size', iiurlwidth: '500',
    })}`);
    if (!r) continue;
    const normalizados = new Map((r.query.normalized || []).map((n) => [n.to, n.from]));
    for (const p of Object.values(r.query.pages || {})) {
      const info = p.imageinfo?.[0];
      if (!info) continue;
      const original = (normalizados.get(p.title) || p.title).replace(/^File:/, '');
      const m = info.extmetadata || {};
      datos.set(original, {
        titulo: p.title.replace(/^File:/, ''),
        url: info.thumburl || info.url,
        pagina: info.descriptionurl,
        autor: textoPlano(m.Artist?.value) || 'Desconocido',
        licencia: textoPlano(m.LicenseShortName?.value) || 'Ver en Commons',
        licencia_url: m.LicenseUrl?.value || '',
      });
    }
    await esperar(1500);
  }
  return datos;
}

/** Recorta los bordes transparentes, ajusta a 320×160 y decide si el logo necesita fondo oscuro (logos blancos). */
async function procesar(buffer, destino) {
  const { hasAlpha } = await sharp(buffer).metadata();
  const recortada = await sharp(buffer, { density: 300 }).ensureAlpha().trim({ threshold: 10 }).toBuffer()
    .catch(() => buffer);
  const salida = await sharp(recortada).ensureAlpha()
    .resize(320, 160, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 }).toBuffer();
  const { data, info } = await sharp(salida).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let peso = 0;
  let luz = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const a = data[i + 3] / 255;
    if (a < 0.1) continue;
    peso += a;
    luz += a * ((0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255);
  }
  fs.writeFileSync(destino, salida);
  // Sin transparencia (JPG con fondo blanco) se muestra siempre sobre fondo claro
  return hasAlpha && peso && luz / peso > 0.85 ? 'oscuro' : 'claro';
}

async function main() {
  fs.mkdirSync(CARPETA, { recursive: true });
  const manifiesto = fs.existsSync(MANIFIESTO) ? JSON.parse(fs.readFileSync(MANIFIESTO, 'utf8')) : [];
  const porSlug = new Map(manifiesto.map((x) => [x.slug, x]));
  for (const slug of rehacer) {
    const previo = porSlug.get(slug);
    if (previo) fs.rmSync(path.join(config.clientePublic, previo.archivo), { force: true });
    porSlug.delete(slug);
  }
  if (rehacer.length) await pool.query(`UPDATE ${TABLA} SET logo = NULL, logo_fondo = 'claro' WHERE slug = ANY($1)`, [rehacer]);

  if (!soloAplicar) {
    const { rows: marcas } = await pool.query(REPUESTOS
      ? 'SELECT slug, nombre FROM marcas_repuesto WHERE para_motos ORDER BY nombre'
      : `SELECT ma.slug, ma.nombre FROM marcas_vehiculo ma
          WHERE EXISTS (SELECT 1 FROM modelos_vehiculo mo WHERE mo.marca_id = ma.id)
          ORDER BY ma.popularidad DESC NULLS LAST`);
    const pendientes = marcas.filter((m) => todas || !porSlug.has(m.slug));
    console.log(`${marcas.length} marcas · ${pendientes.length} sin logo para buscar`);

    // 1) Wikidata + Commons
    // Las marcas de repuestos no son "fabricantes de vehículos": se buscan solo por nombre
    const indice = REPUESTOS ? new Map() : await indiceWikidata();
    const encontrados = pendientes.map((marca) => ({ marca, ...elegir(marca, indice) })).filter((x) => x.archivo);
    console.log(`Coinciden en Wikidata: ${encontrados.length}`);
    const sinCoincidencia = pendientes.filter((m) => !encontrados.some((e) => e.marca.slug === m.slug)
      && !SOLO_BEEPAWAY[m.slug] && !VARIANTE_DE[m.slug]);
    const porNombre = sinCoincidencia.length ? await buscarPorNombre(sinCoincidencia) : [];
    console.log(`Coinciden por nombre exacto (camiones, maquinaria, motos…): ${porNombre.length}`);
    encontrados.push(...porNombre);
    for (const m of pendientes.filter((x) => MANUALES[x.slug] && !encontrados.some((e) => e.marca.slug === x.slug))) {
      encontrados.push({ marca: m, id: null, archivo: MANUALES[m.slug], etiqueta: m.nombre, descripcion: 'asignado a mano' });
    }
    const info = await datosCommons([...new Set(encontrados.map((e) => e.archivo))]);
    for (const e of encontrados) {
      const d = info.get(e.archivo);
      if (!d) continue;
      const buffer = await pedir(d.url, {}, false);
      await esperar(2000);
      if (!buffer) {
        console.log(`  ✗ ${e.marca.nombre}: no se pudo bajar ${d.titulo}`);
        continue;
      }
      const archivo = `${CARPETA_LOGOS}/${e.marca.slug}.png`;
      try {
        const fondo = await procesar(buffer, path.join(config.clientePublic, archivo));
        porSlug.set(e.marca.slug, {
          slug: e.marca.slug, marca: e.marca.nombre, archivo, fondo, fuente: 'wikimedia',
          titulo: d.titulo, origen: d.pagina, autor: d.autor, licencia: d.licencia, licencia_url: d.licencia_url,
          wikidata: e.id ? `https://www.wikidata.org/wiki/${e.id}` : null, entidad: `${e.etiqueta} — ${e.descripcion}`,
        });
        console.log(`  ✓ ${e.marca.nombre} ← ${e.etiqueta} · ${d.titulo} (${d.licencia})`);
      } catch (err) {
        console.log(`  ✗ ${e.marca.nombre}: no se pudo procesar ${d.titulo} (${err.message})`);
      }
    }

    // 2) Beepaway, solo para las que siguen sin logo (solo marcas de vehículos)
    for (const marca of marcas.filter((m) => !REPUESTOS && !porSlug.has(m.slug))) {
      const clave = SOLO_BEEPAWAY[marca.slug] || BEEPAWAY_ALIAS[marca.slug] || marca.slug;
      if (!BEEPAWAY.has(clave)) continue;
      const buffer = await pedir(`https://beepaway.com/images/manufacturers/${clave}.png`, {}, false);
      await esperar(2000);
      if (!buffer) continue;
      const archivo = `${CARPETA_LOGOS}/${marca.slug}.png`;
      const fondo = await procesar(buffer, path.join(config.clientePublic, archivo));
      porSlug.set(marca.slug, {
        slug: marca.slug, marca: marca.nombre, archivo, fondo, fuente: 'beepaway', titulo: `${marca.nombre} logo`,
        origen: 'https://beepaway.com/es/logos', autor: 'Beepaway (logo propiedad de la marca)',
        licencia: 'Uso educativo o no comercial', licencia_url: 'https://beepaway.com/es/logos',
      });
      console.log(`  ✓ ${marca.nombre} ← Beepaway`);
    }

    // 3) Marcas del registro que son una variante de otra ("Ford F 150", "Ika Jeep", "Reanult"): logo de esa marca
    const conLogoPropio = [...porSlug.values()].filter((l) => !l.heredado_de);
    for (const marca of marcas.filter((m) => !REPUESTOS && !porSlug.has(m.slug) && (!SIN_WIKIDATA.has(m.slug) || VARIANTE_DE[m.slug]))) {
      const nombre = normalizarTexto(marca.nombre);
      const padre = VARIANTE_DE[marca.slug]
        ? porSlug.get(VARIANTE_DE[marca.slug])
        : conLogoPropio
          .filter((l) => compacto(l.marca).length >= 3 && new RegExp(`^${normalizarTexto(l.marca).replace(/[^a-z0-9]/g, '\\W?')}[\\s(-]`).test(nombre))
          .sort((a, b) => b.marca.length - a.marca.length)[0];
      if (!padre) continue;
      const archivo = `${CARPETA_LOGOS}/${marca.slug}.png`;
      fs.copyFileSync(path.join(config.clientePublic, padre.archivo), path.join(config.clientePublic, archivo));
      porSlug.set(marca.slug, { ...padre, slug: marca.slug, marca: marca.nombre, archivo, heredado_de: padre.marca });
      console.log(`  ✓ ${marca.nombre} ← logo de ${padre.marca}`);
    }

    const lista = [...porSlug.values()].sort((a, b) => a.marca.localeCompare(b.marca));
    fs.writeFileSync(MANIFIESTO, `${JSON.stringify(lista, null, 2)}\n`);
    const sinLogo = marcas.filter((m) => !porSlug.has(m.slug));
    console.log(`\nCon logo: ${lista.length} de ${marcas.length} · Wikimedia ${lista.filter((x) => x.fuente === 'wikimedia').length} · Beepaway ${lista.filter((x) => x.fuente === 'beepaway').length}`);
    console.log(`Sin logo (siguen con iniciales): ${sinLogo.map((m) => m.nombre).join(', ')}`);
  }

  // --limpiar: saca del listado (y del disco) los logos de marcas que ya no están en el catálogo
  if (process.argv.includes('--limpiar')) {
    const { rows } = await pool.query(`SELECT slug FROM ${TABLA}`);
    const vigentes = new Set(rows.map((r) => r.slug));
    const actual = fs.existsSync(MANIFIESTO) ? JSON.parse(fs.readFileSync(MANIFIESTO, 'utf8')) : [];
    const quedan = actual.filter((l) => vigentes.has(l.slug));
    for (const l of actual.filter((x) => !vigentes.has(x.slug))) fs.rmSync(path.join(config.clientePublic, l.archivo), { force: true });
    fs.writeFileSync(MANIFIESTO, `${JSON.stringify(quedan, null, 2)}\n`);
    console.log(`Logos de marcas que ya no están en el catálogo: ${actual.length - quedan.length} borrados`);
  }

  const aplicados = await aplicarLogos(pool, { tabla: TABLA, carpeta: CARPETA_LOGOS });
  console.log(`Logos guardados en la base: ${aplicados}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

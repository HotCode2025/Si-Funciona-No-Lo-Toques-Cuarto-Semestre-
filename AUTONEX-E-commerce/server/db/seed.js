// Seed reproducible de AUTONEX v2: borra la base, aplica las migraciones y carga todo.
//   npm run db:seed                (completo: ~18.000 versiones del DNRPA)
//   npm run db:seed -- --muestra   (solo las marcas del demo; lo usan los tests)
//
// Qué carga y con qué fuente:
//   · Taxonomía de autopartes ........................ fuente "autonex" (estructura propia)
//   · Marcas, modelos y versiones de vehículos ....... fuente "dnrpa" (datos oficiales CC BY 4.0, vía el importador)
//   · Repuestos, compatibilidades, vendedores, precios  fuente "demo" (INVENTADOS para el proyecto; quedan NEEDS_REVIEW)
// Todo el catálogo entra por el mismo importador que usa el panel de administración.
// El azar tiene semilla fija: cada corrida produce exactamente los mismos datos.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcrypt';
import { pool } from '../src/db.js';
import { config } from '../src/config.js';
import { aplicarMigraciones, vaciarBase } from './migraciones.js';
import { importar } from '../src/importacion/importador.js';
import { leerCsv } from '../src/importacion/csv.js';
import { escanearDuplicados } from '../src/catalogo/duplicados.js';
import { claveNombre, normalizarTexto } from '../src/catalogo/normalizacion.js';
import { leerHorarioTexto } from '../src/horarios.js';

/** Horario por día leído del texto de cada local (para la columna JSONB). */
const horariosDe = (texto) => { const h = leerHorarioTexto(texto); return h ? JSON.stringify(h) : null; };
import { MARCAS } from './data/vehiculos.js';
import { CATEGORIAS } from './data/categorias.js';
import { TIPOS, PRODUCTOS } from './data/catalogo.js';
import { VENDEDORES, COMPRADOR_PRUEBA, VENDEDOR_PRUEBA, ADMIN_PRUEBA } from './data/vendedores.js';
import { aplicarLogos } from '../src/catalogo/logos.js';
import { sembrarMotos } from './seed-motos.js';
import { VENDEDORES_REGIONALES } from './data/vendedores-regionales.js';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const IMG_DIR = path.join(config.clientePublic, 'img');
const ARCHIVO_DNRPA = path.join(aqui, 'datos', 'dnrpa', 'vehiculos.csv');
const MUESTRA = process.argv.includes('--muestra') || process.env.AUTONEX_SEED_MUESTRA === '1';
const log = (...a) => { if (!process.env.AUTONEX_SEED_SILENCIO) console.log(...a); };

// ------------------------------------------------------------ azar con semilla
function mulberry32(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const azar = mulberry32(20261002);
const entre = (min, max) => min + azar() * (max - min);
const enteroEntre = (min, max) => Math.floor(entre(min, max + 1));
const redondear = (valor, paso = 100) => Math.max(paso, Math.round(valor / paso) * paso);

function elegirPonderado(opciones) {
  const total = opciones.reduce((s, o) => s + o.peso, 0);
  let r = azar() * total;
  for (const o of opciones) {
    r -= o.peso;
    if (r <= 0) return o;
  }
  return opciones[opciones.length - 1];
}

// ------------------------------------------------------------ imágenes locales
function imagenesDe(carpeta) {
  const dir = path.join(IMG_DIR, carpeta);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /\.(jpe?g|png|webp|svg)$/i.test(f)).sort();
}
const IMG_PRODUCTOS = imagenesDe('productos');
const IMG_CATEGORIAS = new Set(imagenesDe('categorias'));
const IMG_MARCAS = new Set(imagenesDe('marcas'));

function rutaImagen(carpeta, base, disponibles) {
  for (const ext of ['jpg', 'jpeg', 'png', 'webp', 'svg']) {
    if (disponibles.has(`${base}.${ext}`)) return `/img/${carpeta}/${base}.${ext}`;
  }
  return null;
}

/** Variantes de foto de un tipo: filtro-aceite.jpg, filtro-aceite-2.jpg, ... */
function fotosDelTipo(tipo) {
  const patron = new RegExp(`^${tipo}(-\\d+)?\\.(jpe?g|png|webp)$`, 'i');
  return IMG_PRODUCTOS.filter((f) => patron.test(f)).map((f) => `/img/productos/${f}`);
}

// ------------------------------------------------------------ códigos de pieza de demostración (inventados)
const PREFIJOS = {
  Wega: 'WG', Fram: 'FR', 'Mann-Filter': 'MF', Bosch: 'BO', NGK: 'NGK', Dayco: 'DY', Gates: 'GT',
  SKF: 'SKF', 'Fras-le': 'FL', Fremax: 'FX', Corven: 'CV', 'Fric-Rot': 'FRR', Monroe: 'MO', Sachs: 'SA',
  Valeo: 'VA', Moura: 'MR', Willard: 'WI', YPF: 'YPF', Shell: 'SH', Castrol: 'CA',
};
const contadoresCodigo = new Map();
function codigoPieza(marca, abr) {
  const clave = `${marca}|${abr}`;
  if (!contadoresCodigo.has(clave)) {
    let h = 0;
    for (const c of clave) h = (h * 31 + c.charCodeAt(0)) % 9973;
    contadoresCodigo.set(clave, 100 + (h % 700));
  }
  const n = contadoresCodigo.get(clave);
  contadoresCodigo.set(clave, n + 17);
  return `${PREFIJOS[marca] || marca.slice(0, 3).toUpperCase()}-${abr}-${n}`;
}

// ------------------------------------------------------------ vehículos de referencia del demo
// Los 80 vehículos de data/vehiculos.js ya no se cargan como tales: describen a qué familia de motor y plataforma
// pertenece cada versión, y sirven para asignar las compatibilidades DEMO a las versiones reales del DNRPA.
const VEHICULOS_DEMO = [];
for (const marca of MARCAS) {
  for (const modelo of marca.modelos) {
    for (const [version, motor, familia, combustible, desde, hasta, plataforma, faro, bateria] of modelo.versiones) {
      VEHICULOS_DEMO.push({
        clave: `${marca.nombre}|${modelo.nombre}|${version}`, marca: marca.nombre, modelo: modelo.nombre, tipo: modelo.tipo,
        version, familia, combustible, desde, hasta, plataforma, faro, bateria,
        cilindradas: [...motor.matchAll(/(\d)\.(\d)/g)].map((m) => Number(`${m[1]}${m[2]}00`)),
      });
    }
  }
}

function resolverCompat(compat, vehiculos) {
  if (compat === 'U') return [];
  return vehiculos.filter((v) =>
    (!compat.f || compat.f.includes(v.familia)) &&
    (!compat.p || compat.p.includes(v.plataforma)) &&
    (!compat.m || compat.m.includes(v.modelo)) &&
    (!compat.faro || compat.faro === v.faro) &&
    (!compat.bat || compat.bat === v.bateria) &&
    (!compat.comb || compat.comb === v.combustible));
}

// Modelos del registro que corresponden a un modelo del demo además del mismo nombre (prefijo).
const ALIAS_MODELO_DEMO = { Siena: ['Grand Siena'], Uno: ['Nuevo Uno'] };
// Sufijos que indican otro vehículo aunque empiece igual (Hilux SW4, Corolla Cross...)
const SUFIJOS_DISTINTOS = new Set(['sw4', 'cross', 'aircross', 'picasso', 'cactus']);

function modeloCoincide(modeloDnrpa, modeloDemo) {
  const a = claveNombre(modeloDnrpa);
  const b = claveNombre(modeloDemo);
  if (a === b || (ALIAS_MODELO_DEMO[modeloDemo] || []).some((alias) => claveNombre(alias) === a)) return true;
  if (!a.startsWith(`${b} `)) return false;
  return !a.slice(b.length + 1).split(' ').some((t) => SUFIJOS_DISTINTOS.has(t));
}

/** Para cada versión real (DNRPA) busca el vehículo de referencia del demo que corresponde. */
async function puenteDemo(db) {
  const marcas = [...new Set(VEHICULOS_DEMO.map((d) => normalizarTexto(d.marca)))];
  const { rows } = await db.query(`
    SELECT v.codigo, ma.nombre AS marca, mo.nombre AS modelo, v.version, v.anio_desde,
           coalesce(v.anio_hasta, v.anio_desde) AS anio_hasta, m.cilindrada_cc, coalesce(v.combustible, m.combustible) AS combustible
      FROM vehiculos v
      JOIN modelos_vehiculo mo ON mo.id = v.modelo_id
      JOIN marcas_vehiculo ma ON ma.id = mo.marca_id
      LEFT JOIN motores m ON m.id = v.motor_id
     WHERE normalizar(ma.nombre) = ANY($1::text[])`, [marcas]);

  const codigosPorDemo = new Map(VEHICULOS_DEMO.map((d) => [d.clave, []]));
  let asignadas = 0;
  for (const v of rows) {
    const candidatos = VEHICULOS_DEMO.filter((d) => normalizarTexto(d.marca) === normalizarTexto(v.marca)
      && modeloCoincide(v.modelo, d.modelo)
      && v.anio_desde <= d.hasta && v.anio_hasta >= d.desde
      && (!v.combustible || !['nafta', 'diesel'].includes(v.combustible) || v.combustible === d.combustible)
      && (!v.cilindrada_cc || d.cilindradas.some((c) => Math.abs(c - v.cilindrada_cc) <= 60)));
    if (!candidatos.length) continue;
    // Sin cilindrada en la descripción solo se asigna si todos los candidatos son del mismo motor y plataforma
    if (!v.cilindrada_cc && new Set(candidatos.map((d) => `${d.familia}|${d.plataforma}`)).size > 1) continue;
    const solape = (d) => Math.min(d.hasta, v.anio_hasta) - Math.max(d.desde, v.anio_desde);
    const mejor = candidatos.sort((x, y) => solape(y) - solape(x))[0];
    codigosPorDemo.get(mejor.clave).push(v.codigo);
    asignadas++;
  }
  return { codigosPorDemo, asignadas, total: rows.length };
}

// ------------------------------------------------------------ seed
async function main() {
  const inicio = Date.now();
  log(`AUTONEX · seed v2${MUESTRA ? ' (muestra)' : ''}`);
  // Contraseña de las cuentas de demo (administrador, comprador y vendedores): no se escribe en el código, se toma de
  // SEED_PASSWORD en server/.env. Se controla antes de borrar nada.
  const passwordDemo = process.env.SEED_PASSWORD || '';
  if (passwordDemo.length < 8) {
    throw new Error('Definí SEED_PASSWORD en server/.env (mínimo 8 caracteres): es la contraseña de las cuentas de demo que crea el seed.');
  }
  if (!fs.existsSync(ARCHIVO_DNRPA)) {
    throw new Error(`Falta ${path.relative(process.cwd(), ARCHIVO_DNRPA)}. Generalo con: npm run dnrpa -w autonex-server`);
  }

  try {
    const db = await pool.connect();
    try {
      await vaciarBase(db);
      await aplicarMigraciones(db, { log });
    } finally {
      db.release();
    }

    // ---------------------------------------------------------- fuentes
    const metadatosDnrpa = JSON.parse(fs.readFileSync(path.join(aqui, 'datos', 'dnrpa', 'metadatos.json'), 'utf8'));
    await pool.query(`
      INSERT INTO fuentes (slug, nombre, tipo, url, licencia, licencia_url, terminos_url, terminos_revisados, licencia_verificada,
                           api_disponible, permite_uso_comercial, permite_redistribucion, nivel_confianza, atribucion, notas) VALUES
      ('autonex', 'AUTONEX (estructura propia y carga manual)', 'manual', NULL, NULL, NULL, NULL, true, true, false, true, true, 'media',
       NULL, 'Taxonomía de categorías y datos cargados a mano por un administrador.'),
      ('dnrpa', 'DNRPA · Registro Nacional de la Propiedad del Automotor (datos abiertos)', 'oficial',
       'https://datos.jus.gob.ar/dataset/inscripciones-iniciales-de-autos', 'Creative Commons Atribución 4.0',
       'https://creativecommons.org/licenses/by/4.0/', 'https://datos.jus.gob.ar/', true, true, true, true, true, 'alta', $1,
       $2),
      ('wikimedia-commons', 'Wikimedia Commons', 'datos_abiertos', 'https://commons.wikimedia.org', 'CC0 / CC BY / CC BY-SA (según cada imagen)',
       NULL, 'https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use', true, true, true, true, true, 'alta',
       'Ver CREDITOS-IMAGENES.md', 'Fotos de categorías, marcas y repuestos con licencia libre.'),
      ('demo', 'Datos de demostración AUTONEX', 'demo', NULL, NULL, NULL, NULL, true, true, false, false, false, 'baja', NULL,
       'Repuestos, códigos de pieza, compatibilidades, vendedores, precios y stock INVENTADOS para el proyecto universitario. No son datos reales.')`,
    [metadatosDnrpa.atribucion,
      `Patentamientos 0 km y transferencias ${metadatosDnrpa.anios.join(', ')} (datos hasta ${metadatosDnrpa.datos_hasta}). Solo columnas del vehículo; no se importan datos de titulares.`]);

    // ---------------------------------------------------------- taxonomía de categorías
    const filasCategorias = CATEGORIAS.map(([slug, nombre, padre, extra = {}], i) => ({
      slug, nombre, padre: padre || '', orden: i + 1, destacada: extra.destacada ? 'si' : 'no',
      prefijo_sku: extra.prefijo || '', descripcion: extra.descripcion || '',
      imagen: rutaImagen('categorias', slug, IMG_CATEGORIAS) || '',
    }));
    const rCat = await importar(pool, { entidad: 'categorias', filas: filasCategorias, fuente: 'autonex', formato: 'json', archivo: 'db/data/categorias.js' });
    log(`  categorías: ${rCat.creado} (errores ${rCat.error})`);
    if (rCat.error) throw new Error(`Errores en categorías: ${JSON.stringify(rCat.primeros_errores)}`);
    // Imagen de las subcategorías: la de su tipo de repuesto o la de la categoría más cercana hacia arriba
    for (const [tipo, info] of Object.entries(TIPOS)) {
      const foto = fotosDelTipo(tipo)[0];
      if (foto) await pool.query('UPDATE categorias SET imagen = $2 WHERE slug = $1 AND imagen IS NULL', [info.cat, foto]);
    }
    await pool.query(`
      WITH RECURSIVE arbol AS (
        SELECT id, imagen AS heredada FROM categorias WHERE padre_id IS NULL
        UNION ALL
        SELECT c.id, coalesce(c.imagen, a.heredada) FROM categorias c JOIN arbol a ON c.padre_id = a.id
      )
      UPDATE categorias c SET imagen = a.heredada FROM arbol a WHERE a.id = c.id AND c.imagen IS NULL`);

    // ---------------------------------------------------------- vehículos reales (DNRPA) vía importador
    let filasVehiculos = leerCsv(fs.readFileSync(ARCHIVO_DNRPA));
    if (MUESTRA) {
      // Solo los modelos que usa la demo (tests y pruebas rápidas): el seed completo tarda varios minutos
      const modelosDemo = new Map(MARCAS.map((m) => [normalizarTexto(m.nombre), m.modelos.map((mo) => mo.nombre)]));
      filasVehiculos = filasVehiculos.filter((f) => (modelosDemo.get(normalizarTexto(f.marca)) || [])
        .some((modelo) => modeloCoincide(f.modelo, modelo)));
    }
    log(`  importando ${filasVehiculos.length} versiones del DNRPA…`);
    const rVeh = await importar(pool, {
      entidad: 'vehiculos', filas: filasVehiculos, fuente: 'dnrpa', formato: 'csv', archivo: 'db/datos/dnrpa/vehiculos.csv',
      // Fuente oficial: lo parecido se crea igual y queda marcado para que un administrador decida si fusionar
      opciones: { marcarDuplicados: true },
      log: MUESTRA ? null : log,
    });
    const marcados = Object.entries(rVeh.notas || {}).filter(([n]) => n.startsWith('creado y marcado')).reduce((s, [, n]) => s + n, 0);
    log(`  vehículos: ${rVeh.creado} creados · ${marcados} marcados como posibles duplicados · ${rVeh.duplicado} retenidos · ${rVeh.error} con error`);
    log(`    altas: ${JSON.stringify(rVeh.creados_por_entidad)}`);
    for (const m of IMG_MARCAS) {
      await pool.query('UPDATE marcas_vehiculo SET imagen = $2 WHERE slug = $1', [m.replace(/\.(jpe?g|png|webp|svg)$/i, ''), `/img/marcas/${m}`]);
    }
    // ---------------------------------------------------------- motos (marcas, modelos, categorías, fotos, repuestos)
    await sembrarMotos(pool, { log, muestra: MUESTRA });
    log(`  logos de marcas: ${await aplicarLogos(pool)}`);

    // ---------------------------------------------------------- usuarios y vendedores (demo)
    const hash = await bcrypt.hash(passwordDemo, 10);
    const crearUsuario = async (u, rol) => (await pool.query(
      // Las cuentas de prueba nacen con el email confirmado (si no, no podrían ingresar)
      `INSERT INTO usuarios (email, password_hash, nombre, apellido, telefono, dni, rol, email_verificado_en)
       VALUES ($1,$2,$3,$4,$5,$6,$7, now()) RETURNING id`,
      [u.email, hash, u.nombre, u.apellido, u.telefono ?? null, u.dni ?? null, rol])).rows[0].id;
    await crearUsuario(ADMIN_PRUEBA, 'admin');
    const compradorId = await crearUsuario(COMPRADOR_PRUEBA, 'comprador');
    const vendedores = [];
    for (const v of VENDEDORES) {
      const esPrincipal = v.slug === VENDEDOR_PRUEBA.vendedor;
      const usuarioId = await crearUsuario(esPrincipal ? VENDEDOR_PRUEBA
        : { email: `${v.slug}@autonex.com.ar`, nombre: 'Encargado', apellido: v.nombre_comercial, telefono: v.telefono }, 'vendedor');
      const logo = fs.existsSync(path.join(IMG_DIR, 'vendedores', `${v.slug}.svg`)) ? `/img/vendedores/${v.slug}.svg` : null;
      const { rows: [fila] } = await pool.query(
        `INSERT INTO vendedores (usuario_id, slug, nombre_comercial, descripcion, direccion, ciudad, provincia,
                                 telefono, whatsapp, horario, logo, es_desarmadero)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
        [usuarioId, v.slug, v.nombre_comercial, v.descripcion, v.direccion, v.ciudad, v.provincia,
          v.telefono, v.whatsapp, v.horario, logo, Boolean(v.desarmadero)]);
      await pool.query('UPDATE vendedores SET horarios = $2 WHERE id = $1', [fila.id, horariosDe(v.horario)]);
      vendedores.push({ ...v, id: fila.id });
    }
    await pool.query(`INSERT INTO proveedores (nombre, pais, catalogo_disponible, formato_catalogo, fuente_id, vendedor_id, notas)
      SELECT v.nombre_comercial, 'Argentina', true, 'CSV', f.id, v.id, 'Proveedor ficticio del demo: carga sus precios y stock con el importador.'
        FROM vendedores v, fuentes f WHERE f.slug = 'demo'`);

    // ---------------------------------------------------------- repuestos demo vía importador
    const usosPorTipo = {};
    const productosDemo = PRODUCTOS.map(([tipo, nombre, marca, precioBase, compat]) => {
      const info = TIPOS[tipo];
      if (!info) throw new Error(`Tipo de repuesto desconocido: ${tipo}`);
      const fotos = fotosDelTipo(tipo);
      usosPorTipo[tipo] = (usosPorTipo[tipo] || 0) + 1;
      return {
        tipo, info, nombre, marca, precioBase, compat, numero: codigoPieza(marca, info.abr),
        imagen: fotos.length ? fotos[(usosPorTipo[tipo] - 1) % fotos.length] : '',
        compatiblesDemo: resolverCompat(compat, VEHICULOS_DEMO),
      };
    });
    const rRep = await importar(pool, {
      entidad: 'repuestos', fuente: 'demo', formato: 'json', archivo: 'db/data/catalogo.js',
      opciones: { estadoPorDefecto: 'NEEDS_REVIEW', confianzaPorDefecto: 'baja' },
      filas: productosDemo.map((p) => ({
        marca: p.marca, numero_pieza: p.numero, nombre: p.nombre, categoria: p.info.cat, descripcion: p.info.desc,
        tipo_pieza: 'aftermarket', universal: p.compat === 'U' ? 'si' : 'no', imagen: p.imagen,
      })),
    });
    log(`  repuestos demo: ${rRep.creado} (errores ${rRep.error})`);
    if (rRep.error) throw new Error(`Errores en repuestos: ${JSON.stringify(rRep.primeros_errores)}`);
    // Las marcas de la lista de motos que también tienen repuestos de autos (Bosch, NGK…) sirven para los dos
    await pool.query(`
      UPDATE marcas_repuesto mr SET para_autos = true
       WHERE NOT mr.para_autos AND EXISTS (SELECT 1 FROM productos p JOIN categorias c ON c.id = p.categoria_id
                                            WHERE p.marca_repuesto_id = mr.id AND c.rubro <> 'motos')`);

    // ---------------------------------------------------------- compatibilidades demo -> versiones reales
    const { codigosPorDemo, asignadas, total } = await puenteDemo(pool);
    const filasCompat = [];
    for (const p of productosDemo) {
      const codigos = new Set(p.compatiblesDemo.flatMap((d) => codigosPorDemo.get(d.clave)));
      for (const codigo of codigos) filasCompat.push({ marca: p.marca, numero_pieza: p.numero, vehiculo: codigo });
    }
    const rCompat = await importar(pool, {
      entidad: 'compatibilidades', fuente: 'demo', formato: 'json', filas: filasCompat,
      opciones: { estadoPorDefecto: 'NEEDS_REVIEW', confianzaPorDefecto: 'baja' },
    });
    log(`  compatibilidades demo: ${rCompat.creado} (versiones reales asignadas a la referencia del demo: ${asignadas} de ${total})`);

    // ---------------------------------------------------------- publicaciones demo (mismo azar que la v1)
    const { rows: idsProductos } = await pool.query(`
      SELECT p.id, p.numero_pieza, mr.nombre AS marca FROM productos p JOIN marcas_repuesto mr ON mr.id = p.marca_repuesto_id`);
    const idPorCodigo = new Map(idsProductos.map((r) => [`${r.marca}|${r.numero_pieza}`, r.id]));
    const desarmadero = vendedores.find((v) => v.desarmadero);
    const comerciales = vendedores.filter((v) => !v.desarmadero);
    const ESCASOS = new Set(['kit-embrague', 'radiador', 'bateria', 'optica', 'electroventilador', 'kit-cadena']);
    const categoriaDemo = (tipo) => {
      const cat = TIPOS[tipo].cat;
      const raiz = CATEGORIAS.find(([slug]) => slug === cat);
      // Los "rubros" de los vendedores siguen usando las 10 categorías del demo original
      const RUBRO = { filtros: 'filtros', encendido: 'encendido', distribucion: 'distribucion', frenos: 'frenos', suspension: 'suspension',
        embrague: 'embrague', refrigeracion: 'refrigeracion', iluminacion: 'iluminacion', baterias: 'baterias', lubricantes: 'lubricantes' };
      let actual = raiz;
      while (actual && !RUBRO[actual[0]]) actual = CATEGORIAS.find(([slug]) => slug === actual[2]);
      if (!actual && cat === 'extremos-de-direccion') return 'suspension';
      return actual ? actual[0] : 'filtros';
    };
    let totalPublicaciones = 0;
    for (const p of productosDemo) {
      const productoId = idPorCodigo.get(`${p.marca}|${p.numero}`);
      const universal = p.compat === 'U';
      const compatibles = p.compatiblesDemo;
      const deCamioneta = !universal && compatibles.some((v) => v.tipo === 'camioneta');
      const soloCamioneta = !universal && compatibles.every((v) => v.tipo === 'camioneta');
      const deGolTrend = compatibles.some((v) => v.modelo === 'Gol Trend');
      const rubro = categoriaDemo(p.tipo);

      let cantidad = elegirPonderado([
        { n: 1, peso: 20 }, { n: 2, peso: 36 }, { n: 3, peso: 30 }, { n: 4, peso: 14 },
      ]).n;
      if (deGolTrend) cantidad = Math.max(cantidad, 3);
      const usaDesarmadero = Boolean(p.info.usado) && !soloCamioneta && azar() < 0.55;
      const nuevos = usaDesarmadero ? Math.max(1, Math.min(cantidad, 4) - 1) : Math.min(cantidad, 4);
      const candidatos = comerciales
        .map((v) => {
          let peso = v.rubros[rubro] ?? 1;
          if (v.soloCamionetas && !deCamioneta && !universal) peso = 0;
          if (v.camionetas && deCamioneta) peso *= 3;
          return { v, peso };
        })
        .filter((c) => c.peso > 0);
      const elegidos = [];
      while (elegidos.length < nuevos && candidatos.length) {
        const c = elegirPonderado(candidatos);
        elegidos.push(c.v);
        candidatos.splice(candidatos.indexOf(c), 1);
      }
      for (const v of elegidos) {
        const precio = redondear(p.precioBase * v.factor * entre(0.93, 1.08));
        const stock = ESCASOS.has(p.tipo) ? enteroEntre(1, 8) : enteroEntre(3, 40);
        await pool.query(`INSERT INTO publicaciones (producto_id, vendedor_id, precio, stock, condicion) VALUES ($1,$2,$3,$4,'nuevo')`,
          [productoId, v.id, precio, stock]);
        totalPublicaciones++;
      }
      if (usaDesarmadero) {
        const precio = redondear(p.precioBase * entre(0.42, 0.6));
        await pool.query(`INSERT INTO publicaciones (producto_id, vendedor_id, precio, stock, condicion) VALUES ($1,$2,$3,$4,'usado')`,
          [productoId, desarmadero.id, precio, enteroEntre(1, 3)]);
        totalPublicaciones++;
      }
    }
    log(`  publicaciones demo: ${totalPublicaciones}`);

    await crearCompraHistorica(pool, compradorId, vendedores);

    // ---------------------------------------------------------- casas de repuestos regionales (todas las provincias)
    // Van después de todo lo anterior y con su propio azar: los precios de los 8 vendedores originales no cambian.
    const azarRegional = mulberry32(20261004);
    const entreRegional = (min, max) => min + azarRegional() * (max - min);
    const ponderadoRegional = (opciones) => {
      let r = azarRegional() * opciones.reduce((s, o) => s + o.peso, 0);
      for (const o of opciones) {
        r -= o.peso;
        if (r <= 0) return o;
      }
      return opciones[opciones.length - 1];
    };
    const regionales = [];
    for (const v of VENDEDORES_REGIONALES) {
      const usuarioId = await crearUsuario({ email: `${v.slug}@autonex.com.ar`, nombre: 'Encargado', apellido: v.nombre_comercial, telefono: v.telefono }, 'vendedor');
      const logo = fs.existsSync(path.join(IMG_DIR, 'vendedores', `${v.slug}.svg`)) ? `/img/vendedores/${v.slug}.svg` : null;
      const { rows: [fila] } = await pool.query(
        `INSERT INTO vendedores (usuario_id, slug, nombre_comercial, descripcion, direccion, ciudad, provincia, telefono, whatsapp, horario, logo)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [usuarioId, v.slug, v.nombre_comercial, v.descripcion, v.direccion, v.ciudad, v.provincia, v.telefono, v.whatsapp, v.horario, logo]);
      await pool.query('UPDATE vendedores SET horarios = $2 WHERE id = $1', [fila.id, horariosDe(v.horario)]);
      regionales.push({ ...v, id: fila.id });
    }
    await pool.query(`INSERT INTO proveedores (nombre, pais, catalogo_disponible, formato_catalogo, fuente_id, vendedor_id, notas)
      SELECT v.nombre_comercial, 'Argentina', true, 'CSV', f.id, v.id, 'Proveedor ficticio del demo: carga sus precios y stock con el importador.'
        FROM vendedores v, fuentes f WHERE f.slug = 'demo' AND v.slug = ANY($1)`, [regionales.map((v) => v.slug)]);
    let publicacionesRegionales = 0;
    // Las casas regionales no le ganan el mejor precio a las ofertas originales (el guion de la demo usa esos precios)
    const { rows: minimos } = await pool.query('SELECT producto_id, min(precio) AS minimo FROM publicaciones GROUP BY producto_id');
    const precioMinimo = new Map(minimos.map((r) => [r.producto_id, Number(r.minimo)]));
    for (const p of productosDemo) {
      const productoId = idPorCodigo.get(`${p.marca}|${p.numero}`);
      const universal = p.compat === 'U';
      const deCamioneta = !universal && p.compatiblesDemo.some((v) => v.tipo === 'camioneta');
      const rubro = categoriaDemo(p.tipo);
      const cantidad = ponderadoRegional([{ n: 0, peso: 12 }, { n: 1, peso: 34 }, { n: 2, peso: 34 }, { n: 3, peso: 20 }]).n;
      const candidatos = regionales.map((v) => ({ v, peso: (v.rubros[rubro] ?? 1) * (v.camionetas && deCamioneta ? 3 : 1) }));
      for (let i = 0; i < cantidad && candidatos.length; i++) {
        const c = ponderadoRegional(candidatos);
        candidatos.splice(candidatos.indexOf(c), 1);
        const minimo = precioMinimo.get(productoId);
        const precio = Math.max(redondear(p.precioBase * c.v.factor * entreRegional(0.93, 1.09)), minimo ? Math.ceil((minimo * 1.02 + 1) / 100) * 100 : 0);
        const stock = ESCASOS.has(p.tipo) ? Math.floor(entreRegional(1, 9)) : Math.floor(entreRegional(2, 36));
        await pool.query(`INSERT INTO publicaciones (producto_id, vendedor_id, precio, stock, condicion) VALUES ($1,$2,$3,$4,'nuevo')`,
          [productoId, c.v.id, precio, stock]);
        publicacionesRegionales++;
      }
    }
    log(`  casas de repuestos regionales: ${regionales.length} (publicaciones ${publicacionesRegionales})`);

    // ---------------------------------------------------------- posibles duplicados entre los datos ya cargados
    const duplicados = await escanearDuplicados(pool);

    const { rows: [c] } = await pool.query(`
      SELECT (SELECT count(*) FROM marcas_vehiculo) AS marcas, (SELECT count(*) FROM modelos_vehiculo) AS modelos,
             (SELECT count(*) FROM vehiculos) AS versiones, (SELECT count(*) FROM motores) AS motores,
             (SELECT count(*) FROM categorias) AS categorias, (SELECT count(*) FROM productos) AS productos,
             (SELECT count(*) FROM compatibilidades) AS compat,
             (SELECT count(*) FROM posibles_duplicados WHERE estado = 'pendiente') AS duplicados`);
    log(`  Marcas ${c.marcas} · Modelos ${c.modelos} · Versiones ${c.versiones} · Motores ${c.motores}`);
    log(`  Categorías ${c.categorias} · Repuestos ${c.productos} · Compatibilidades ${c.compat} · Posibles duplicados pendientes ${c.duplicados} (${duplicados} del escaneo)`);
    log(`  Cuentas de demo: ${ADMIN_PRUEBA.email} · ${COMPRADOR_PRUEBA.email} · ${VENDEDOR_PRUEBA.email} (contraseña: la de SEED_PASSWORD)`);
    log(`Listo en ${((Date.now() - inicio) / 1000).toFixed(1)} s.`);
  } finally {
    await pool.end();
  }
}

async function crearCompraHistorica(db, usuarioId, vendedores) {
  const centro = vendedores.find((v) => v.slug === 'repuestos-del-centro');
  const rosario = vendedores.find((v) => v.slug === 'autopartes-rosario-norte');
  const pubDe = async (vendedorId) => (await db.query(
    `SELECT pu.id, pu.precio, pr.id AS producto_id, pr.nombre, pr.numero_pieza
       FROM publicaciones pu JOIN productos pr ON pr.id = pu.producto_id
      WHERE pu.vendedor_id = $1 AND pu.condicion = 'nuevo'
      ORDER BY pu.id LIMIT 1`, [vendedorId])).rows[0];

  const p1 = await pubDe(centro.id);
  const p2 = await pubDe(rosario.id);
  if (!p1 || !p2) return;

  const envioRosario = 11500;
  const subtotal = p1.precio * 2 + p2.precio;
  const total = subtotal + envioRosario;
  const { rows: [compra] } = await db.query(
    `INSERT INTO compras (usuario_id, estado, comprador_nombre, comprador_apellido, comprador_email,
                          comprador_telefono, comprador_dni, subtotal_productos, total_envios, total,
                          pagada_en, creado_en, actualizado_en)
     VALUES ($1,'pagada',$2,$3,$4,$5,$6,$7,$8,$9, now() - interval '12 days', now() - interval '12 days', now() - interval '5 days')
     RETURNING id`,
    [usuarioId, COMPRADOR_PRUEBA.nombre, COMPRADOR_PRUEBA.apellido, COMPRADOR_PRUEBA.email,
      COMPRADOR_PRUEBA.telefono, COMPRADOR_PRUEBA.dni, subtotal, envioRosario, total]);

  const crearPedido = async (vendedorId, pub, cantidad, estado, envio) => {
    const sub = pub.precio * cantidad;
    const { rows: [pedido] } = await db.query(
      `INSERT INTO pedidos (compra_id, vendedor_id, estado, subtotal, costo_envio, total, creado_en, actualizado_en)
       VALUES ($1,$2,$3,$4,$5,$6, now() - interval '12 days', now() - interval '5 days') RETURNING id`,
      [compra.id, vendedorId, estado, sub, envio.costo, sub + envio.costo]);
    await db.query(
      `INSERT INTO pedido_items (pedido_id, publicacion_id, producto_id, nombre_producto, codigo_pieza,
                                 condicion, precio_unitario, cantidad, subtotal)
       VALUES ($1,$2,$3,$4,$5,'nuevo',$6,$7,$8)`,
      [pedido.id, pub.id, pub.producto_id, pub.nombre, pub.numero_pieza, pub.precio, cantidad, sub]);
    await db.query(
      `INSERT INTO envios (pedido_id, metodo, transportista, costo, demora_estimada, calle, numero, piso_depto,
                           codigo_postal, localidad, provincia, observaciones)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [pedido.id, envio.metodo, envio.transportista || null, envio.costo, envio.demora || null,
        envio.calle || null, envio.numero || null, envio.piso || null, envio.cp || null,
        envio.localidad || null, envio.provincia || null, envio.obs || null]);
  };

  await crearPedido(centro.id, p1, 2, 'entregado', { metodo: 'retiro', costo: 0 });
  await crearPedido(rosario.id, p2, 1, 'enviado', {
    metodo: 'domicilio', transportista: 'andreani', costo: envioRosario, demora: '4 a 6 días hábiles',
    calle: 'Av. Corrientes', numero: '3247', piso: '5° B', cp: 'C1193', localidad: 'Ciudad Autónoma de Buenos Aires',
    provincia: 'Ciudad Autónoma de Buenos Aires', obs: 'Timbre B. Si no hay nadie, dejar en portería.',
  });
  await db.query(
    `INSERT INTO pagos (compra_id, preferencia_id, mp_pago_id, estado, estado_detalle, monto, medio_pago, creado_en, actualizado_en)
     VALUES ($1, 'seed-historico', 'SEED-0001', 'approved', 'accredited', $2, 'master', now() - interval '12 days', now() - interval '12 days')`,
    [compra.id, total]);
}

main().catch(async (error) => {
  console.error('Error en el seed:', error.message);
  process.exitCode = 1;
  await pool.end().catch(() => {});
});

// Entidades que acepta el importador (CSV, Excel o JSON): columnas, alias y cómo se guarda cada fila.
//
// Reglas comunes:
//   · Cada dato creado o actualizado guarda la fuente, la importación, la fecha y su estado de verificación.
//   · Un dato VERIFIED nunca se pisa con uno que no lo está.
//   · Si un registro nuevo se parece a uno existente, NO se crea: queda como "posible duplicado" para revisión.

import { CAMPOS_TRAZABILIDAD, ErrorCampo } from './campos.js';
import { Duplicado, buscarNombreSimilar, buscarVehiculoEquivalente, registrarDuplicado } from '../catalogo/duplicados.js';
import { claveNombre, claveVehiculo, normalizarCodigo, normalizarTexto, slugificar } from '../catalogo/normalizacion.js';

export class ErrorFila extends Error {
  constructor(mensaje, campo = null) {
    super(mensaje);
    this.campo = campo;
  }
}

// ---------------------------------------------------------------- helpers de contexto

/** Columnas de trazabilidad para una fila. */
export function traza(ctx, fila) {
  const estado = fila.estado_verificacion || ctx.opciones.estadoPorDefecto || 'UNVERIFIED';
  if (estado === 'VERIFIED' && ctx.fuente.tipo === 'demo') {
    throw new ErrorFila('Un dato de una fuente de demostración no puede quedar como VERIFIED.', 'estado_verificacion');
  }
  return {
    fuente_id: ctx.fuente.id,
    fuente_url: fila.fuente_url ?? ctx.fuente.url ?? null,
    importacion_id: ctx.importacionId,
    importado_en: ctx.ahora,
    estado_verificacion: estado,
    confianza: fila.confianza || ctx.opciones.confianzaPorDefecto || ctx.fuente.nivel_confianza,
    verificado_en: estado === 'VERIFIED' ? (fila.verificado_en || ctx.ahora) : null,
  };
}

/**
 * Inserta o actualiza por clave. Solo escribe los campos informados (no undefined).
 * No pisa un registro VERIFIED con datos sin verificar.
 */
/** WHERE por claves que usa índices: "col = $n" (o "col IS NULL"). IS NOT DISTINCT FROM no usa índices. */
function condicionClaves(claves, desde = 1) {
  const params = [];
  const partes = Object.entries(claves).map(([c, v]) => {
    if (v === null || v === undefined) return `${c} IS NULL`;
    params.push(v);
    return `${c} = $${desde + params.length - 1}`;
  });
  return { sql: partes.join(' AND '), params };
}

export async function guardar(ctx, tabla, claves, datos, conTraza = null, { soloBusqueda = [] } = {}) {
  const busqueda = condicionClaves(claves);
  const { rows: [actual] } = await ctx.db.query(`SELECT ctid, * FROM ${tabla} WHERE ${busqueda.sql} LIMIT 1`, busqueda.params);
  const valores = Object.fromEntries(Object.entries({ ...datos, ...(conTraza || {}) }).filter(([, v]) => v !== undefined));

  if (!actual) {
    // Las claves "soloBusqueda" (columnas generadas) sirven para encontrar el registro pero no se insertan.
    const clavesInsert = Object.fromEntries(Object.entries(claves).filter(([c]) => !soloBusqueda.includes(c)));
    const columnas = Object.keys({ ...clavesInsert, ...valores });
    const params = Object.values({ ...clavesInsert, ...valores });
    const { rows: [nuevo] } = await ctx.db.query(
      `INSERT INTO ${tabla} (${columnas.join(', ')}) VALUES (${columnas.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`, params);
    return { accion: 'creado', registro: nuevo };
  }

  if (conTraza && actual.estado_verificacion === 'VERIFIED' && conTraza.estado_verificacion !== 'VERIFIED') {
    return { accion: 'sin_cambios', registro: actual, nota: 'no se pisa un dato verificado con uno sin verificar' };
  }
  const cambios = Object.entries(datos).filter(([c, v]) => v !== undefined && JSON.stringify(actual[c]) !== JSON.stringify(v));
  const cambiaEstado = conTraza && actual.estado_verificacion !== conTraza.estado_verificacion;
  if (!cambios.length && !cambiaEstado) return { accion: 'sin_cambios', registro: actual };

  const sets = { ...Object.fromEntries(cambios), ...(conTraza ? { ...conTraza, actualizado_en: ctx.ahora } : {}) };
  const columnas = Object.keys(sets).filter((c) => sets[c] !== undefined);
  const { rows: [actualizado] } = await ctx.db.query(
    `UPDATE ${tabla} SET ${columnas.map((c, i) => `${c} = $${i + 1}`).join(', ')} WHERE ctid = $${columnas.length + 1} RETURNING *`,
    [...columnas.map((c) => sets[c]), actual.ctid]);
  return { accion: 'actualizado', registro: actualizado };
}

/** Caché por importación. Lo creado en una fila que falla se descarta (la fila se deshace con un SAVEPOINT). */
function cache(ctx, espacio, clave) {
  return ctx.cache.get(`${espacio}|${clave}`) ?? ctx.cachePendiente.get(`${espacio}|${clave}`);
}
function cachear(ctx, espacio, clave, valor) {
  ctx.cachePendiente.set(`${espacio}|${clave}`, valor);
}

async function tipoVehiculoId(ctx, valor) {
  if (!valor) return undefined;
  const clave = slugificar(valor).replace(/-/g, '_');
  const hit = cache(ctx, 'tipo', clave);
  if (hit) return hit;
  const { rows: [t] } = await ctx.db.query(
    `SELECT id FROM tipos_vehiculo WHERE slug = $1 OR normalizar(nombre) = normalizar($2)
        OR ($1 IN ('camioneta','pick_up','pick-up') AND slug = 'pickup')
        OR ($1 IN ('omnibus','colectivo') AND slug = 'bus')
        OR ($1 IN ('sedan_4_puertas','berlina') AND slug = 'sedan') LIMIT 1`, [clave, valor]);
  if (!t) throw new ErrorFila(`El tipo de vehículo "${valor}" no existe.`, 'tipo_vehiculo');
  cachear(ctx, 'tipo', clave, t.id);
  return t.id;
}

// ---------------------------------------------------------------- posibles duplicados
// Por defecto la fila parecida a un registro existente se retiene (no se crea) hasta que un administrador decide.
// Con opciones.marcarDuplicados (fuentes oficiales, donde perder el dato es peor) se crea y queda marcada para revisión.
function posibleDuplicado(ctx, datos) {
  if (!ctx.opciones.marcarDuplicados) throw new Duplicado(datos);
  return datos;
}

async function marcarDuplicado(ctx, dup, nuevoId) {
  if (!dup || !nuevoId || dup.registroId === nuevoId) return;
  await registrarDuplicado(ctx.db, {
    entidad: dup.entidad, registroId: dup.registroId, duplicadoId: nuevoId, importacionId: ctx.importacionId,
    similitud: dup.similitud, motivo: dup.motivo,
  });
  ctx.nota?.(`creado y marcado como posible duplicado (${dup.entidad})`);
}

// ---------------------------------------------------------------- resolución con alta implícita

export async function resolverMarca(ctx, nombre, fila, { crear = true } = {}) {
  const clave = claveNombre(nombre);
  const hit = cache(ctx, 'marca', clave);
  if (hit) return hit;
  const { rows: [existe] } = await ctx.db.query(
    'SELECT id FROM marcas_vehiculo WHERE clave_normalizada = $1 OR normalizar(nombre) = normalizar($2) OR slug = $3 LIMIT 1', [clave, nombre, slugificar(nombre)]);
  if (existe) {
    cachear(ctx, 'marca', clave, existe.id);
    return existe.id;
  }
  if (!crear) throw new ErrorFila(`La marca de vehículo "${nombre}" no existe en el catálogo.`, 'marca');
  let dup = null;
  if (!ctx.opciones.crearDuplicados) {
    const similar = await buscarNombreSimilar(ctx.db, 'marcas', nombre);
    if (similar) dup = posibleDuplicado(ctx, { entidad: 'marcas', registroId: similar.id, nombreExistente: similar.nombre, similitud: similar.similitud, motivo: `marca "${nombre}" parecida` });
  }
  const { registro } = await guardar(ctx, 'marcas_vehiculo', { clave_normalizada: clave },
    { nombre, slug: slugificar(nombre) }, traza(ctx, fila));
  await marcarDuplicado(ctx, dup, registro.id);
  ctx.contar('marcas', 'creado');
  cachear(ctx, 'marca', clave, registro.id);
  ctx.marcasTocadas.add(registro.id);
  return registro.id;
}

export async function resolverModelo(ctx, marcaId, nombre, fila, extras = {}) {
  const clave = claveNombre(nombre);
  const hit = cache(ctx, 'modelo', `${marcaId}|${clave}`);
  if (hit) return hit;
  const { rows: [existe] } = await ctx.db.query(
    'SELECT id FROM modelos_vehiculo WHERE marca_id = $1 AND (clave_normalizada = $2 OR normalizar(nombre) = normalizar($3)) LIMIT 1',
    [marcaId, clave, nombre]);
  if (existe) {
    cachear(ctx, 'modelo', `${marcaId}|${clave}`, existe.id);
    return existe.id;
  }
  let dup = null;
  if (!ctx.opciones.crearDuplicados) {
    const similar = await buscarNombreSimilar(ctx.db, 'modelos', nombre, marcaId);
    if (similar) dup = posibleDuplicado(ctx, { entidad: 'modelos', registroId: similar.id, nombreExistente: similar.nombre, similitud: similar.similitud, motivo: `modelo "${nombre}" parecido` });
  }
  const { registro } = await guardar(ctx, 'modelos_vehiculo', { marca_id: marcaId, clave_normalizada: clave },
    { nombre, ...extras }, traza(ctx, fila));
  await marcarDuplicado(ctx, dup, registro.id);
  ctx.contar('modelos', 'creado');
  cachear(ctx, 'modelo', `${marcaId}|${clave}`, registro.id);
  return registro.id;
}

async function resolverMotor(ctx, marcaId, datos, fila) {
  // Autos: "1.6"; motos: "293 cc 2T" (en motos 0.25 y 0.3 litros son motores distintos: no se agrupan)
  const cilindrada = !datos.cilindrada_cc ? null
    : datos.moto ? [`${datos.cilindrada_cc} cc`, datos.tiempos === 'electrico' ? null : datos.tiempos].filter(Boolean).join(' ')
      : (datos.cilindrada_cc / 1000).toFixed(1);
  const nombre = datos.nombre || cilindrada || (datos.combustible === 'electrico' || datos.tiempos === 'electrico' ? 'Eléctrico' : null);
  if (!nombre) return undefined;
  const clave = claveNombre(`${nombre} ${datos.combustible || ''}`);
  const hit = cache(ctx, 'motor', `${marcaId}|${clave}`);
  if (hit) return hit;
  const { registro, accion } = await guardar(ctx, 'motores', { marca_id: marcaId, nombre }, {
    codigo: datos.codigo, cilindrada_cc: datos.cilindrada_cc, cilindros: datos.cilindros, combustible: datos.combustible,
    potencia_cv: datos.potencia_cv, torque_nm: datos.torque_nm, aspiracion: datos.aspiracion, clave_normalizada: clave,
    tiempos: datos.tiempos, alimentacion: datos.alimentacion,
  }, traza(ctx, fila));
  if (accion === 'creado') ctx.contar('motores', 'creado');
  cachear(ctx, 'motor', `${marcaId}|${clave}`, registro.id);
  return registro.id;
}

async function resolverGeneracion(ctx, modeloId, nombre, fila) {
  const hit = cache(ctx, 'generacion', `${modeloId}|${normalizarTexto(nombre)}`);
  if (hit) return hit;
  const { rows: [g] } = await ctx.db.query(
    'SELECT id FROM generaciones WHERE modelo_id = $1 AND normalizar(nombre) = normalizar($2)', [modeloId, nombre]);
  if (g) {
    cachear(ctx, 'generacion', `${modeloId}|${normalizarTexto(nombre)}`, g.id);
    return g.id;
  }
  if (!fila.anio_desde) throw new ErrorFila(`La generación "${nombre}" no existe; importala primero o indicá anio_desde.`, 'generacion');
  const { registro } = await guardar(ctx, 'generaciones', { modelo_id: modeloId, nombre },
    { anio_desde: fila.anio_desde, anio_hasta: fila.anio_hasta }, traza(ctx, fila));
  ctx.contar('generaciones', 'creado');
  cachear(ctx, 'generacion', `${modeloId}|${normalizarTexto(nombre)}`, registro.id);
  return registro.id;
}

export async function resolverMarcaRepuesto(ctx, nombre, fila) {
  const clave = claveNombre(nombre);
  const hit = cache(ctx, 'marca_rep', clave);
  if (hit) return hit;
  const { rows: [existe] } = await ctx.db.query(
    'SELECT id FROM marcas_repuesto WHERE clave_normalizada = $1 OR normalizar(nombre) = normalizar($2) OR slug = $3 LIMIT 1', [clave, nombre, slugificar(nombre)]);
  if (existe) {
    cachear(ctx, 'marca_rep', clave, existe.id);
    return existe.id;
  }
  let dup = null;
  if (!ctx.opciones.crearDuplicados) {
    const similar = await buscarNombreSimilar(ctx.db, 'marcas_repuesto', nombre);
    if (similar) dup = posibleDuplicado(ctx, { entidad: 'marcas_repuesto', registroId: similar.id, nombreExistente: similar.nombre, similitud: similar.similitud, motivo: `marca de repuesto "${nombre}" parecida` });
  }
  const { registro } = await guardar(ctx, 'marcas_repuesto', { clave_normalizada: clave },
    { nombre, slug: slugificar(nombre) }, traza(ctx, fila));
  await marcarDuplicado(ctx, dup, registro.id);
  ctx.contar('marcas_repuesto', 'creado');
  cachear(ctx, 'marca_rep', clave, registro.id);
  return registro.id;
}

async function resolverCategoria(ctx, valor) {
  const hit = cache(ctx, 'categoria', normalizarTexto(valor));
  if (hit) return hit;
  const ruta = valor.split(/\s*[>/]\s*/).filter(Boolean);
  let fila;
  if (ruta.length > 1) {
    let padre = null;
    for (const parte of ruta) {
      const { rows: [c] } = await ctx.db.query(
        'SELECT id, imagen, rubro FROM categorias WHERE padre_id IS NOT DISTINCT FROM $1 AND normalizar(nombre) = normalizar($2)', [padre, parte]);
      if (!c) throw new ErrorFila(`No existe la categoría "${parte}" dentro de la ruta "${valor}".`, 'categoria');
      padre = c.id;
      fila = c;
    }
  } else {
    const { rows: encontradas } = await ctx.db.query(
      'SELECT id, imagen, rubro, slug FROM categorias WHERE slug = $1 OR normalizar(nombre) = normalizar($2)', [slugificar(valor), valor]);
    // Con el mismo nombre en autos y motos ("Bujías") gana la de slug exacto (la original); la de motos se pide
    // con su ruta ("Motos > Motor > Bujías") o su slug
    const porSlug = encontradas.filter((c) => c.slug === slugificar(valor));
    const rows = encontradas.length > 1 && porSlug.length === 1 ? porSlug : encontradas;
    if (!rows.length) throw new ErrorFila(`La categoría "${valor}" no existe.`, 'categoria');
    if (rows.length > 1) throw new ErrorFila(`La categoría "${valor}" es ambigua: indicá la ruta completa (ej: "Suspensión > Parrillas").`, 'categoria');
    [fila] = rows;
  }
  cachear(ctx, 'categoria', normalizarTexto(valor), fila);
  return fila;
}

/** Busca un producto por SKU o por marca + número de pieza. */
async function buscarProducto(ctx, fila) {
  if (fila.sku) {
    const { rows: [p] } = await ctx.db.query('SELECT id FROM productos WHERE sku = $1', [fila.sku]);
    if (!p) throw new ErrorFila(`No existe un producto con SKU ${fila.sku}.`, 'sku');
    return p.id;
  }
  if (!fila.marca || !fila.numero_pieza) throw new ErrorFila('Indicá el SKU o la marca y el número de pieza del producto.', 'numero_pieza');
  const clave = `${claveNombre(fila.marca)}|${normalizarCodigo(fila.numero_pieza)}`;
  const hit = cache(ctx, 'producto', clave);
  if (hit) return hit;
  const { rows: [p] } = await ctx.db.query(`
    SELECT p.id FROM productos p JOIN marcas_repuesto m ON m.id = p.marca_repuesto_id
     WHERE (m.clave_normalizada = $1 OR normalizar(m.nombre) = normalizar($3)) AND p.numero_normalizado = $2`,
  [claveNombre(fila.marca), normalizarCodigo(fila.numero_pieza), fila.marca]);
  if (!p) throw new ErrorFila(`No existe el producto ${fila.marca} ${fila.numero_pieza}. Importalo primero como repuesto.`, 'numero_pieza');
  cachear(ctx, 'producto', clave, p.id);
  return p.id;
}

/** Categorías de moto de un modelo ("MOTOCROSS;COMPETITION"). Un código desconocido es un error de la fila. */
async function guardarCategoriasMoto(ctx, modeloId, texto, fila) {
  const codigos = [...new Set(texto.split(/[;,|]/).map((c) => c.trim().toUpperCase().replace(/[\s-]+/g, '_')).filter(Boolean))];
  for (const codigo of codigos) {
    let id = cache(ctx, 'catmoto', codigo);
    if (!id) {
      const { rows: [c] } = await ctx.db.query('SELECT id FROM categorias_moto WHERE codigo = $1', [codigo]);
      if (!c) throw new ErrorFila(`La categoría de moto "${codigo}" no existe.`, 'categorias');
      id = c.id;
      cachear(ctx, 'catmoto', codigo, id);
    }
    const { estado_verificacion: estado } = traza(ctx, fila);
    await ctx.db.query(`
      INSERT INTO modelo_categorias_moto (modelo_id, categoria_id, fuente_id, importacion_id, estado_verificacion)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (modelo_id, categoria_id) DO UPDATE SET fuente_id = EXCLUDED.fuente_id, importacion_id = EXCLUDED.importacion_id,
        estado_verificacion = CASE WHEN modelo_categorias_moto.estado_verificacion = 'VERIFIED' THEN 'VERIFIED' ELSE EXCLUDED.estado_verificacion END`,
    [modeloId, id, ctx.fuente.id, ctx.importacionId, estado]);
  }
}

/** Registro al que se asocia una imagen importada. */
async function registroDeImagen(ctx, fila) {
  if (fila.entidad === 'producto') return buscarProducto(ctx, fila);
  if (fila.entidad === 'marca') return resolverMarca(ctx, fila.marca_vehiculo, fila, { crear: false });
  if (fila.entidad === 'marca_repuesto') return resolverMarcaRepuesto(ctx, fila.marca, fila);
  if (fila.entidad === 'vehiculo') {
    const { rows: [v] } = await ctx.db.query('SELECT id FROM vehiculos WHERE codigo = $1', [String(fila.vehiculo || '').toUpperCase()]);
    if (!v) throw new ErrorFila(`No existe el vehículo con código ${fila.vehiculo}.`, 'vehiculo');
    return v.id;
  }
  const marcaId = await resolverMarca(ctx, fila.marca_vehiculo, fila, { crear: false });
  const { rows: [m] } = await ctx.db.query(
    'SELECT id FROM modelos_vehiculo WHERE marca_id = $1 AND (clave_normalizada = $2 OR normalizar(nombre) = normalizar($3))',
    [marcaId, claveNombre(fila.modelo || ''), fila.modelo || '']);
  if (!m) throw new ErrorFila(`No existe el modelo ${fila.marca_vehiculo} ${fila.modelo}.`, 'modelo');
  return m.id;
}

// ---------------------------------------------------------------- definiciones

const t = (nombre, etiqueta, extra = {}) => ({ nombre, etiqueta, tipo: 'texto', max: 300, ...extra });

export const ENTIDADES = {
  marcas: {
    titulo: 'Marcas de vehículos',
    campos: [
      t('nombre', 'Marca', { requerido: true, max: 80, alias: ['brand', 'marca'] }),
      t('pais_origen', 'País de origen', { alias: ['country', 'pais'] }),
      { nombre: 'segmento', etiqueta: 'Segmento', tipo: 'lista', lista: 'segmento_marca' },
      { nombre: 'disponible_argentina', etiqueta: 'Disponible en Argentina', tipo: 'booleano', alias: ['available_in_argentina'] },
      { nombre: 'oficial_argentina', etiqueta: 'Oficial en Argentina', tipo: 'booleano', alias: ['official_argentina'] },
      { nombre: 'importado', etiqueta: 'Importado', tipo: 'booleano', alias: ['imported'] },
      { nombre: 'historico_argentina', etiqueta: 'Vendido históricamente en Argentina', tipo: 'booleano', alias: ['historical_argentina'] },
      { nombre: 'internacional', etiqueta: 'Internacional', tipo: 'booleano', alias: ['international'] },
      t('wikidata', 'Wikidata (Q...)', { max: 20 }),
      { nombre: 'estado_mercado', etiqueta: 'Estado de mercado', tipo: 'lista', lista: 'estado_mercado', alias: ['market_status'] },
      { nombre: 'sitio_web', etiqueta: 'Sitio web', tipo: 'url', alias: ['website'] },
      t('imagen', 'Imagen (ruta local)', { alias: ['image'] }),
    ],
    async procesar(ctx, fila) {
      const antes = ctx.contados('marcas');
      const marcaId = await resolverMarca(ctx, fila.nombre, fila);
      const { accion } = await guardar(ctx, 'marcas_vehiculo', { id: marcaId }, {
        pais_origen: fila.pais_origen, segmento: fila.segmento, estado_mercado: fila.estado_mercado,
        sitio_web: fila.sitio_web, imagen: fila.imagen,
        disponible_argentina: fila.disponible_argentina, oficial_argentina: fila.oficial_argentina, importado: fila.importado,
        historico_argentina: fila.historico_argentina, internacional: fila.internacional, wikidata: fila.wikidata,
      }, traza(ctx, fila));
      return { accion: ctx.contados('marcas') > antes ? 'creado' : accion, id: marcaId };
    },
  },

  modelos: {
    titulo: 'Modelos',
    campos: [
      t('marca', 'Marca', { requerido: true, alias: ['brand'] }),
      t('nombre', 'Modelo', { requerido: true, max: 80, alias: ['model', 'modelo'] }),
      t('tipo_vehiculo', 'Tipo de vehículo', { alias: ['vehicle_type', 'type', 'tipo'] }),
      { nombre: 'estado_mercado', etiqueta: 'Estado de mercado', tipo: 'lista', lista: 'estado_mercado', alias: ['market_status'] },
      { nombre: 'segmento', etiqueta: 'Segmento', tipo: 'lista', lista: 'segmento' },
      { nombre: 'anio_desde', etiqueta: 'Producido desde', tipo: 'anio', alias: ['year_from'] },
      { nombre: 'anio_hasta', etiqueta: 'Producido hasta', tipo: 'anio', alias: ['year_to'] },
      t('categorias', 'Categorías de moto (MOTOCROSS;ENDURO...)', { max: 300, alias: ['categories', 'categorias_moto'] }),
      { nombre: 'disponible_argentina', etiqueta: 'Disponible en Argentina', tipo: 'booleano', alias: ['available_in_argentina'] },
      { nombre: 'oficial_argentina', etiqueta: 'Oficial en Argentina', tipo: 'booleano', alias: ['official_argentina'] },
      { nombre: 'importado', etiqueta: 'Importado', tipo: 'booleano', alias: ['imported'] },
      { nombre: 'historico_argentina', etiqueta: 'Vendido históricamente en Argentina', tipo: 'booleano', alias: ['historical_argentina'] },
      { nombre: 'internacional', etiqueta: 'Internacional', tipo: 'booleano', alias: ['international'] },
      t('wikidata', 'Wikidata (Q...)', { max: 20 }),
    ],
    async procesar(ctx, fila) {
      const marcaId = await resolverMarca(ctx, fila.marca, fila);
      const tipoId = await tipoVehiculoId(ctx, fila.tipo_vehiculo);
      const antes = ctx.contados('modelos');
      const modeloId = await resolverModelo(ctx, marcaId, fila.nombre, fila, { tipo_vehiculo_id: tipoId });
      const { accion } = await guardar(ctx, 'modelos_vehiculo', { id: modeloId },
        {
          tipo_vehiculo_id: tipoId, estado_mercado: fila.estado_mercado, segmento: fila.segmento,
          anio_desde: fila.anio_desde, anio_hasta: fila.anio_hasta,
          disponible_argentina: fila.disponible_argentina, oficial_argentina: fila.oficial_argentina, importado: fila.importado,
        historico_argentina: fila.historico_argentina, internacional: fila.internacional, wikidata: fila.wikidata,
        }, traza(ctx, fila));
      if (fila.categorias) await guardarCategoriasMoto(ctx, modeloId, fila.categorias, fila);
      return { accion: ctx.contados('modelos') > antes ? 'creado' : accion, id: modeloId };
    },
  },

  generaciones: {
    titulo: 'Generaciones',
    campos: [
      t('marca', 'Marca', { requerido: true, alias: ['brand'] }),
      t('modelo', 'Modelo', { requerido: true, alias: ['model'] }),
      t('nombre', 'Generación', { requerido: true, max: 80, alias: ['generation', 'generacion'] }),
      { nombre: 'numero', etiqueta: 'Número de generación', tipo: 'entero', min: 1, max: 30, alias: ['generation_number'] },
      t('codigo', 'Código de chasis', { alias: ['chassis_code', 'code'] }),
      { nombre: 'anio_desde', etiqueta: 'Año desde', tipo: 'anio', requerido: true, alias: ['year_from', 'desde'] },
      { nombre: 'anio_hasta', etiqueta: 'Año hasta', tipo: 'anio', alias: ['year_to', 'hasta'] },
    ],
    async procesar(ctx, fila) {
      const marcaId = await resolverMarca(ctx, fila.marca, fila, { crear: false });
      const modeloId = await resolverModelo(ctx, marcaId, fila.modelo, fila);
      if (fila.anio_hasta && fila.anio_hasta < fila.anio_desde) throw new ErrorFila('El año hasta es anterior al año desde.', 'anio_hasta');
      const { rows: [igual] } = await ctx.db.query(
        'SELECT id FROM generaciones WHERE modelo_id = $1 AND normalizar(nombre) = normalizar($2)', [modeloId, fila.nombre]);
      let dup = null;
      if (!igual && !ctx.opciones.crearDuplicados) {
        const similar = await buscarNombreSimilar(ctx.db, 'generaciones', fila.nombre, modeloId);
        if (similar) dup = posibleDuplicado(ctx, { entidad: 'generaciones', registroId: similar.id, nombreExistente: similar.nombre, similitud: similar.similitud, motivo: 'generación parecida' });
      }
      const { accion, registro } = await guardar(ctx, 'generaciones', igual ? { id: igual.id } : { modelo_id: modeloId, nombre: fila.nombre },
        { numero: fila.numero, codigo: fila.codigo, anio_desde: fila.anio_desde, anio_hasta: fila.anio_hasta }, traza(ctx, fila));
      await marcarDuplicado(ctx, dup, registro.id);
      return { accion, id: registro.id };
    },
  },

  motores: {
    titulo: 'Motores',
    campos: [
      t('marca', 'Marca (fabricante del vehículo)', { alias: ['brand'] }),
      t('nombre', 'Motor', { requerido: true, max: 80, alias: ['engine', 'motor'] }),
      t('codigo', 'Código de motor', { alias: ['engine_code', 'code'] }),
      { nombre: 'cilindrada_cc', etiqueta: 'Cilindrada (cc)', tipo: 'entero', min: 20, max: 30000, alias: ['displacement', 'displacement_cc', 'cc'] },
      { nombre: 'cilindros', etiqueta: 'Cilindros', tipo: 'entero', min: 1, max: 16, alias: ['cylinders'] },
      { nombre: 'combustible', etiqueta: 'Combustible', tipo: 'lista', lista: 'combustible', alias: ['fuel'] },
      { nombre: 'potencia_cv', etiqueta: 'Potencia (CV)', tipo: 'entero', min: 1, max: 3000, alias: ['power', 'power_hp', 'hp', 'cv'] },
      { nombre: 'torque_nm', etiqueta: 'Torque (Nm)', tipo: 'entero', min: 1, max: 5000, alias: ['torque', 'torque_nm'] },
      { nombre: 'aspiracion', etiqueta: 'Aspiración', tipo: 'lista', lista: 'aspiracion', alias: ['aspiration'] },
      { nombre: 'tiempos', etiqueta: '2T / 4T', tipo: 'lista', lista: 'tiempos', alias: ['stroke', 'strokes'] },
      { nombre: 'alimentacion', etiqueta: 'Carburador / inyección', tipo: 'lista', lista: 'alimentacion', alias: ['fuel_system', 'fuel_delivery'] },
    ],
    async procesar(ctx, fila) {
      const marcaId = fila.marca ? await resolverMarca(ctx, fila.marca, fila, { crear: false }) : null;
      const antes = ctx.contados('motores');
      const id = await resolverMotor(ctx, marcaId, fila, fila);
      const { accion } = await guardar(ctx, 'motores', { id }, {
        codigo: fila.codigo, cilindrada_cc: fila.cilindrada_cc, cilindros: fila.cilindros, combustible: fila.combustible,
        potencia_cv: fila.potencia_cv, torque_nm: fila.torque_nm, aspiracion: fila.aspiracion,
        tiempos: fila.tiempos, alimentacion: fila.alimentacion,
      }, traza(ctx, fila));
      return { accion: ctx.contados('motores') > antes ? 'creado' : accion, id };
    },
  },

  vehiculos: {
    titulo: 'Vehículos (versiones)',
    columnasExtra: 'datos_fuente',
    campos: [
      t('codigo', 'Código interno', { max: 80, alias: ['code', 'vehicle_id', 'codigo_interno', 'id'] }),
      t('marca', 'Marca', { requerido: true, alias: ['brand'] }),
      t('modelo', 'Modelo', { requerido: true, alias: ['model'] }),
      t('generacion', 'Generación', { alias: ['generation'] }),
      { nombre: 'anio_desde', etiqueta: 'Año desde', tipo: 'anio', requerido: true, alias: ['year_from', 'desde', 'year'] },
      { nombre: 'anio_hasta', etiqueta: 'Año hasta', tipo: 'anio', alias: ['year_to', 'hasta'] },
      t('version', 'Versión', { requerido: true, alias: ['trim', 'version_name'] }),
      t('tipo_vehiculo', 'Tipo de vehículo', { alias: ['vehicle_type', 'type', 'tipo'] }),
      t('carroceria', 'Carrocería', { alias: ['body', 'body_type'] }),
      t('motor', 'Motor', { alias: ['engine'] }),
      t('motor_codigo', 'Código de motor', { alias: ['engine_code'] }),
      { nombre: 'cilindrada_cc', etiqueta: 'Cilindrada (cc)', tipo: 'entero', min: 20, max: 30000, alias: ['displacement', 'displacement_cc', 'cc'] },
      { nombre: 'cilindros', etiqueta: 'Cilindros', tipo: 'entero', min: 1, max: 16, alias: ['cylinders'] },
      { nombre: 'combustible', etiqueta: 'Combustible', tipo: 'lista', lista: 'combustible', alias: ['fuel'] },
      { nombre: 'potencia_cv', etiqueta: 'Potencia (CV)', tipo: 'entero', min: 1, max: 3000, alias: ['power', 'power_hp', 'hp'] },
      { nombre: 'torque_nm', etiqueta: 'Torque (Nm)', tipo: 'entero', min: 1, max: 5000, alias: ['torque'] },
      { nombre: 'aspiracion', etiqueta: 'Aspiración', tipo: 'lista', lista: 'aspiracion', alias: ['aspiration'] },
      { nombre: 'tiempos', etiqueta: '2T / 4T', tipo: 'lista', lista: 'tiempos', alias: ['stroke', 'strokes'] },
      { nombre: 'alimentacion', etiqueta: 'Carburador / inyección', tipo: 'lista', lista: 'alimentacion', alias: ['fuel_system', 'fuel_delivery'] },
      { nombre: 'transmision', etiqueta: 'Transmisión', tipo: 'lista', lista: 'transmision', alias: ['transmission', 'gearbox'] },
      { nombre: 'velocidades', etiqueta: 'Velocidades', tipo: 'entero', min: 1, max: 18, alias: ['speeds', 'gears'] },
      { nombre: 'traccion', etiqueta: 'Tracción', tipo: 'lista', lista: 'traccion', alias: ['drive', 'drivetrain'] },
      t('pais_fabricacion', 'País de fabricación', { alias: ['country', 'manufacturing_country'] }),
      t('mercado', 'Mercado', { alias: ['market'] }),
      { nombre: 'estado_mercado', etiqueta: 'Estado de mercado', tipo: 'lista', lista: 'estado_mercado', alias: ['market_status'] },
      { nombre: 'segmento', etiqueta: 'Segmento', tipo: 'lista', lista: 'segmento' },
      t('carrocero', 'Carrocero', { alias: ['bodybuilder'] }),
      { nombre: 'registros', etiqueta: 'Registros en la fuente', tipo: 'entero', min: 0, alias: ['popularidad', 'count'] },
    ],
    async procesar(ctx, fila) {
      if (fila.anio_hasta && fila.anio_hasta < fila.anio_desde) throw new ErrorFila('El año hasta es anterior al año desde.', 'anio_hasta');
      const marcaId = await resolverMarca(ctx, fila.marca, fila);
      const tipoId = await tipoVehiculoId(ctx, fila.tipo_vehiculo);
      const modeloId = await resolverModelo(ctx, marcaId, fila.modelo, fila, { tipo_vehiculo_id: tipoId });
      const generacionId = fila.generacion ? await resolverGeneracion(ctx, modeloId, fila.generacion, fila) : undefined;
      const motorId = await resolverMotor(ctx, marcaId, {
        nombre: fila.motor, codigo: fila.motor_codigo, cilindrada_cc: fila.cilindrada_cc, cilindros: fila.cilindros,
        combustible: fila.combustible, potencia_cv: fila.potencia_cv, torque_nm: fila.torque_nm, aspiracion: fila.aspiracion,
        tiempos: fila.tiempos, alimentacion: fila.alimentacion, moto: fila.segmento === 'moto' || Boolean(fila.tiempos),
      }, fila);
      const codigo = (fila.codigo || [fila.marca, fila.modelo, fila.anio_desde, fila.motor, fila.version].filter(Boolean).join('-'))
        .toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
      const clave = claveVehiculo(fila.modelo, fila.version, fila.motor);

      const { rows: [existe] } = await ctx.db.query('SELECT id FROM vehiculos WHERE codigo = $1', [codigo]);
      let dup = null;
      if (!existe && !ctx.opciones.crearDuplicados) {
        const igual = await buscarVehiculoEquivalente(ctx.db, { modeloId, clave, anioDesde: fila.anio_desde, anioHasta: fila.anio_hasta, excluirCodigo: codigo });
        if (igual) {
          dup = posibleDuplicado(ctx, { entidad: 'vehiculos', registroId: igual.id, nombreExistente: `${fila.modelo} ${igual.version} (${igual.codigo})`, similitud: 1, motivo: 'misma versión escrita distinto' });
        }
      }
      const res = await guardar(ctx, 'vehiculos', { codigo }, {
        modelo_id: modeloId, generacion_id: generacionId, motor_id: motorId, version: fila.version,
        anio_desde: fila.anio_desde, anio_hasta: fila.anio_hasta, tipo_vehiculo_id: tipoId, carroceria: fila.carroceria,
        combustible: fila.combustible, transmision: fila.transmision, velocidades: fila.velocidades, traccion: fila.traccion,
        pais_fabricacion: fila.pais_fabricacion, mercado: fila.mercado, estado_mercado: fila.estado_mercado,
        segmento: fila.segmento, carrocero: fila.carrocero, popularidad: fila.registros,
        datos_fuente: Object.keys(fila.datos_fuente || {}).length ? fila.datos_fuente : undefined,
        clave_normalizada: clave,
      }, traza(ctx, fila));
      await marcarDuplicado(ctx, dup, res.registro.id);
      ctx.modelosTocados.add(modeloId);
      ctx.marcasTocadas.add(marcaId);
      return { accion: res.accion, id: res.registro.id, nota: res.nota };
    },
    async alFinalizar(ctx, { recalcularModelos, recalcularMarcas }) {
      if (ctx.modelosTocados.size) await recalcularModelos(ctx.db, [...ctx.modelosTocados]);
      if (ctx.marcasTocadas.size) await recalcularMarcas(ctx.db, [...ctx.marcasTocadas]);
    },
  },

  categorias: {
    titulo: 'Categorías de repuestos',
    campos: [
      t('nombre', 'Categoría', { requerido: true, max: 80, alias: ['category', 'name'] }),
      t('padre', 'Categoría padre (nombre, slug o ruta)', { alias: ['parent'] }),
      t('slug', 'Slug', { max: 80 }),
      t('descripcion', 'Descripción', { alias: ['description'] }),
      { nombre: 'destacada', etiqueta: 'Destacada en el inicio', tipo: 'booleano', alias: ['featured'] },
      t('prefijo_sku', 'Prefijo de SKU', { max: 5, alias: ['sku_prefix'] }),
      { nombre: 'orden', etiqueta: 'Orden', tipo: 'entero', min: 0, max: 999 },
      t('imagen', 'Imagen (ruta local)', { alias: ['image'] }),
      { nombre: 'rubro', etiqueta: 'Rubro (autos, motos o general)', tipo: 'lista', lista: 'rubro', alias: ['segment'] },
    ],
    async procesar(ctx, fila) {
      const padre = fila.padre ? await resolverCategoria(ctx, fila.padre) : null;
      const { rows: [padreInfo] } = padre
        ? await ctx.db.query('SELECT nivel, nombre FROM categorias WHERE id = $1', [padre.id]) : { rows: [{ nivel: 0 }] };
      let slug = fila.slug || slugificar(fila.nombre);
      const { rows: [ocupado] } = await ctx.db.query(
        'SELECT id FROM categorias WHERE slug = $1 AND NOT (padre_id IS NOT DISTINCT FROM $2 AND nombre = $3)', [slug, padre?.id ?? null, fila.nombre]);
      if (ocupado) slug = slugificar(`${padreInfo.nombre || ''} ${fila.nombre}`);
      const { accion, registro } = await guardar(ctx, 'categorias', { padre_id: padre?.id ?? null, nombre: fila.nombre }, {
        slug, descripcion: fila.descripcion,
        destacada: fila.destacada, prefijo_sku: fila.prefijo_sku?.toUpperCase(), orden: fila.orden, imagen: fila.imagen,
        nivel: padreInfo.nivel + 1, rubro: fila.rubro,
      });
      return { accion, id: registro.id };
    },
  },

  repuestos: {
    titulo: 'Repuestos (productos)',
    campos: [
      t('sku', 'SKU AUTONEX', { max: 40 }),
      t('marca', 'Marca del repuesto', { requerido: true, max: 80, alias: ['brand', 'part_brand', 'marca_repuesto'] }),
      t('numero_pieza', 'Número de pieza del fabricante', { requerido: true, max: 60, alias: ['part_number', 'numero', 'codigo_pieza', 'codigo'] }),
      t('nombre', 'Nombre', { requerido: true, max: 200, alias: ['name'] }),
      t('categoria', 'Categoría (nombre, slug o ruta)', { requerido: true, alias: ['category'] }),
      t('descripcion', 'Descripción', { max: 3000, alias: ['description'] }),
      { nombre: 'tipo_pieza', etiqueta: 'Tipo de pieza', tipo: 'lista', lista: 'tipo_pieza', alias: ['part_type'] },
      t('ean', 'EAN', { max: 14, alias: ['gtin', 'ean13', 'codigo_barras', 'barcode'] }),
      t('upc', 'UPC', { max: 12, alias: ['upc_a'] }),
      t('codigo_aftermarket', 'Código aftermarket', { max: 60, alias: ['aftermarket_code'] }),
      t('codigo_proveedor', 'Código del proveedor', { max: 60, alias: ['supplier_code'] }),
      t('oem', 'Números OEM (MARCA:NUMERO; separados por ;)', { max: 1000 }),
      t('marca_oem', 'Marca del vehículo para los OEM', { alias: ['oem_brand'] }),
      { nombre: 'universal', etiqueta: 'Universal', tipo: 'booleano' },
      t('imagen', 'Imagen (ruta local)', { alias: ['image'] }),
      { nombre: 'especificaciones', etiqueta: 'Especificaciones (JSON)', tipo: 'json', alias: ['specs'] },
    ],
    async procesar(ctx, fila) {
      if (fila.ean && !/^\d{8}(\d{4,6})?$/.test(fila.ean)) throw new ErrorFila('El EAN tiene que tener 8, 12, 13 o 14 dígitos.', 'ean');
      if (fila.upc && !/^\d{12}$/.test(fila.upc)) throw new ErrorFila('El UPC tiene que tener 12 dígitos.', 'upc');
      const marcaId = await resolverMarcaRepuesto(ctx, fila.marca, fila);
      const categoria = await resolverCategoria(ctx, fila.categoria);
      const res = await guardar(ctx, 'productos', { marca_repuesto_id: marcaId, numero_normalizado: normalizarCodigo(fila.numero_pieza) }, {
        numero_pieza: fila.numero_pieza, sku: fila.sku, nombre: fila.nombre, categoria_id: categoria.id,
        descripcion: fila.descripcion, tipo_pieza: fila.tipo_pieza, ean: fila.ean, upc: fila.upc, codigo_aftermarket: fila.codigo_aftermarket,
        universal: fila.universal, imagen: fila.imagen, especificaciones: fila.especificaciones,
      }, traza(ctx, fila), { soloBusqueda: ['numero_normalizado'] });
      const productoId = res.registro.id;
      if (res.accion === 'creado' && !fila.imagen && categoria.imagen && categoria.rubro !== 'motos') {
        await ctx.db.query('UPDATE productos SET imagen = $2 WHERE id = $1 AND imagen IS NULL', [productoId, categoria.imagen]);
      }
      if (fila.oem) {
        for (const parte of fila.oem.split(/\s*[;|]\s*/).filter(Boolean)) {
          const [marcaOem, numero] = parte.includes(':') ? parte.split(':').map((s) => s.trim()) : [fila.marca_oem, parte];
          if (!marcaOem) throw new ErrorFila(`Indicá la marca del OEM "${parte}" (MARCA:NUMERO o columna marca_oem).`, 'oem');
          const marcaVehId = await resolverMarca(ctx, marcaOem, fila, { crear: false });
          await guardar(ctx, 'oem_productos', { producto_id: productoId, marca_vehiculo_id: marcaVehId, numero_oem: numero }, {}, traza(ctx, fila));
        }
      }
      if (fila.codigo_proveedor && ctx.proveedor) {
        await guardar(ctx, 'productos_proveedor', { proveedor_id: ctx.proveedor.id, codigo_proveedor: fila.codigo_proveedor }, { producto_id: productoId });
      }
      return { accion: res.accion, id: productoId, nota: res.nota };
    },
  },

  oem: {
    titulo: 'Números OEM',
    campos: [
      t('sku', 'SKU AUTONEX'),
      t('marca', 'Marca del repuesto', { alias: ['brand', 'part_brand'] }),
      t('numero_pieza', 'Número de pieza', { alias: ['part_number'] }),
      t('marca_vehiculo', 'Marca del vehículo (OEM)', { requerido: true, alias: ['oem_brand', 'vehicle_brand'] }),
      t('numero_oem', 'Número OEM', { requerido: true, max: 60, alias: ['oem', 'oem_number'] }),
    ],
    async procesar(ctx, fila) {
      const productoId = await buscarProducto(ctx, fila);
      const marcaId = await resolverMarca(ctx, fila.marca_vehiculo, fila, { crear: false });
      const { accion, registro } = await guardar(ctx, 'oem_productos', { producto_id: productoId, marca_vehiculo_id: marcaId, numero_oem: fila.numero_oem }, {}, traza(ctx, fila));
      return { accion, id: registro.id };
    },
  },

  equivalencias: {
    titulo: 'Equivalencias',
    campos: [
      t('sku', 'SKU AUTONEX'),
      t('marca', 'Marca del repuesto', { alias: ['brand', 'part_brand'] }),
      t('numero_pieza', 'Número de pieza', { alias: ['part_number'] }),
      t('marca_equivalente', 'Marca equivalente', { requerido: true, alias: ['equivalent_brand'] }),
      t('numero_equivalente', 'Número equivalente', { requerido: true, max: 60, alias: ['equivalent_number', 'equivalent_part_number'] }),
      { nombre: 'tipo', etiqueta: 'Tipo', tipo: 'lista', lista: 'tipo_equivalencia', alias: ['relation', 'type'] },
    ],
    async procesar(ctx, fila) {
      const productoId = await buscarProducto(ctx, fila);
      const marcaEqId = await resolverMarcaRepuesto(ctx, fila.marca_equivalente, fila);
      const { rows: [enCatalogo] } = await ctx.db.query(
        'SELECT id FROM productos WHERE marca_repuesto_id = $1 AND numero_normalizado = $2', [marcaEqId, normalizarCodigo(fila.numero_equivalente)]);
      const { accion, registro } = await guardar(ctx, 'equivalencias',
        { producto_id: productoId, marca_repuesto_id: marcaEqId, numero_pieza: fila.numero_equivalente },
        { tipo: fila.tipo, producto_equivalente_id: enCatalogo?.id ?? undefined }, traza(ctx, fila));
      return { accion, id: registro.id };
    },
  },

  compatibilidades: {
    titulo: 'Compatibilidades (repuesto ↔ vehículo)',
    campos: [
      t('sku', 'SKU AUTONEX'),
      t('marca', 'Marca del repuesto', { alias: ['part_brand'] }),
      t('numero_pieza', 'Número de pieza', { alias: ['part_number'] }),
      t('vehiculo', 'Código del vehículo', { alias: ['vehicle_id', 'vehiculo_codigo', 'codigo_vehiculo'] }),
      t('marca_vehiculo', 'Marca del vehículo', { alias: ['vehicle_brand', 'brand'] }),
      t('modelo', 'Modelo', { alias: ['model'] }),
      { nombre: 'anio_desde', etiqueta: 'Año desde', tipo: 'anio', alias: ['year_from'] },
      { nombre: 'anio_hasta', etiqueta: 'Año hasta', tipo: 'anio', alias: ['year_to'] },
      t('motor', 'Motor (contiene)', { alias: ['engine'] }),
      t('version', 'Versión (contiene)', { alias: ['trim'] }),
      t('posicion', 'Posición', { alias: ['position'] }),
      t('notas', 'Notas', { alias: ['notes'] }),
    ],
    async procesar(ctx, fila) {
      const productoId = await buscarProducto(ctx, fila);
      let vehiculos;
      if (fila.vehiculo) {
        const { rows } = await ctx.db.query('SELECT id FROM vehiculos WHERE codigo = $1', [fila.vehiculo.toUpperCase()]);
        if (!rows.length) throw new ErrorFila(`No existe el vehículo con código ${fila.vehiculo}.`, 'vehiculo');
        vehiculos = rows;
      } else {
        if (!fila.marca_vehiculo || !fila.modelo) throw new ErrorFila('Indicá el código del vehículo o la marca y el modelo.', 'vehiculo');
        const { rows } = await ctx.db.query(`
          SELECT v.id FROM vehiculos v
            JOIN modelos_vehiculo mo ON mo.id = v.modelo_id
            JOIN marcas_vehiculo ma ON ma.id = mo.marca_id
            LEFT JOIN motores m ON m.id = v.motor_id
           WHERE normalizar(ma.nombre) = normalizar($1) AND normalizar(mo.nombre) = normalizar($2)
             AND ($3::int IS NULL OR coalesce(v.anio_hasta, 9999) >= $3)
             AND ($4::int IS NULL OR v.anio_desde <= $4)
             AND ($5::text IS NULL OR normalizar(coalesce(m.nombre, '') || ' ' || v.version) LIKE '%' || normalizar($5) || '%')
             AND ($6::text IS NULL OR normalizar(v.version) LIKE '%' || normalizar($6) || '%')`,
        [fila.marca_vehiculo, fila.modelo, fila.anio_desde ?? null, fila.anio_hasta ?? null, fila.motor ?? null, fila.version ?? null]);
        if (!rows.length) throw new ErrorFila(`No hay versiones de ${fila.marca_vehiculo} ${fila.modelo} que coincidan con los filtros.`, 'modelo');
        vehiculos = rows;
      }
      let accion = 'sin_cambios';
      for (const v of vehiculos) {
        const r = await guardar(ctx, 'compatibilidades', { producto_id: productoId, vehiculo_id: v.id },
          { posicion: fila.posicion, notas: fila.notas, anio_desde: fila.anio_desde, anio_hasta: fila.anio_hasta }, traza(ctx, fila));
        if (r.accion === 'creado') accion = 'creado';
        else if (r.accion === 'actualizado' && accion !== 'creado') accion = 'actualizado';
      }
      return { accion, id: productoId, filas: vehiculos.length };
    },
  },

  categorias_moto: {
    titulo: 'Categorías de modelos de moto',
    descripcion: 'Asigna una o más categorías (MOTOCROSS, ENDURO, SCOOTER...) a modelos que ya existen.',
    campos: [
      t('marca', 'Marca', { requerido: true, alias: ['brand'] }),
      t('modelo', 'Modelo', { requerido: true, alias: ['model'] }),
      t('categorias', 'Categorías (MOTOCROSS;ENDURO...)', { requerido: true, alias: ['categories'] }),
      ...CAMPOS_TRAZABILIDAD,
    ],
    async procesar(ctx, fila) {
      const marcaId = await resolverMarca(ctx, fila.marca, fila, { crear: false });
      const { rows: [m] } = await ctx.db.query(
        'SELECT id FROM modelos_vehiculo WHERE marca_id = $1 AND (clave_normalizada = $2 OR normalizar(nombre) = normalizar($3))',
        [marcaId, claveNombre(fila.modelo), fila.modelo]);
      if (!m) throw new ErrorFila(`No existe el modelo ${fila.marca} ${fila.modelo}.`, 'modelo');
      await guardarCategoriasMoto(ctx, m.id, fila.categorias, fila);
      return { accion: 'actualizado', id: m.id };
    },
  },

  imagenes: {
    titulo: 'Imágenes (motos, versiones, repuestos, marcas)',
    descripcion: 'Registra imágenes reales con su origen y permiso. Solo se usan las de fuentes con licencia o autorización; la descarga y el hash se hacen después.',
    campos: [
      { nombre: 'entidad', etiqueta: 'A qué pertenece (modelo, vehiculo, producto, marca, marca_repuesto)', tipo: 'texto', requerido: true, max: 20, alias: ['entity'] },
      t('marca_vehiculo', 'Marca del vehículo', { alias: ['vehicle_brand'] }),
      t('modelo', 'Modelo', { alias: ['model'] }),
      t('vehiculo', 'Código del vehículo', { alias: ['vehicle_code'] }),
      t('sku', 'SKU AUTONEX'),
      t('marca', 'Marca del repuesto', { alias: ['part_brand'] }),
      t('numero_pieza', 'Número de pieza', { alias: ['part_number'] }),
      { nombre: 'tipo', etiqueta: 'Tipo de imagen', tipo: 'lista', lista: 'tipo_imagen', alias: ['image_type', 'vista'] },
      { nombre: 'principal', etiqueta: 'Imagen principal', tipo: 'booleano', alias: ['main'] },
      t('archivo', 'Archivo local (img/...)', { alias: ['file', 'ruta'] }),
      { nombre: 'url_imagen', etiqueta: 'URL de la imagen', tipo: 'url', alias: ['image_url', 'url'] },
      { nombre: 'url_origen', etiqueta: 'Página de origen', tipo: 'url', alias: ['source_url', 'origen'] },
      t('autor', 'Autor', { alias: ['author', 'artist'] }),
      t('licencia', 'Licencia', { alias: ['license'] }),
      { nombre: 'licencia_url', etiqueta: 'URL de la licencia', tipo: 'url', alias: ['license_url'] },
      { nombre: 'permiso', etiqueta: 'Permiso de uso', tipo: 'lista', lista: 'permiso_imagen', alias: ['permission'] },
      t('hash_sha256', 'Hash SHA-256', { max: 64, alias: ['sha256', 'hash'] }),
      { nombre: 'ancho', etiqueta: 'Ancho', tipo: 'entero', min: 1, max: 20000 },
      { nombre: 'alto', etiqueta: 'Alto', tipo: 'entero', min: 1, max: 20000 },
      t('descargado_en', 'Fecha de descarga', { alias: ['downloaded_at'] }),
      { nombre: 'estado_verificacion', etiqueta: 'Estado', tipo: 'lista', lista: 'estado_verificacion', alias: ['estado', 'status'] },
    ],
    async procesar(ctx, fila) {
      const entidad = String(fila.entidad).toLowerCase();
      if (!['modelo', 'vehiculo', 'producto', 'marca', 'marca_repuesto'].includes(entidad)) {
        throw new ErrorFila('entidad tiene que ser modelo, vehiculo, producto, marca o marca_repuesto.', 'entidad');
      }
      if (!fila.archivo && !fila.url_imagen) throw new ErrorFila('Falta el archivo o la URL de la imagen.', 'url_imagen');
      if (ctx.fuente.tipo === 'demo') throw new ErrorFila('Una fuente de demostración no puede cargar imágenes: tienen que ser reales.', 'url_imagen');
      const registroId = await registroDeImagen(ctx, { ...fila, entidad });
      const principal = Boolean(fila.principal);
      if (principal) await ctx.db.query('UPDATE imagenes SET principal = false WHERE entidad = $1 AND registro_id = $2', [entidad, registroId]);
      const { accion } = await guardar(ctx, 'imagenes', { entidad, registro_id: registroId, url_imagen: fila.url_imagen ?? fila.archivo }, {
        tipo: fila.tipo || 'principal', principal, archivo: fila.archivo, url_origen: fila.url_origen, fuente_id: ctx.fuente.id,
        autor: fila.autor, licencia: fila.licencia, licencia_url: fila.licencia_url, permiso: fila.permiso || 'pendiente',
        hash_sha256: fila.hash_sha256, ancho: fila.ancho, alto: fila.alto, descargado_en: fila.descargado_en,
        estado: fila.estado_verificacion || (fila.permiso === 'libre' || fila.permiso === 'autorizado' ? 'UNVERIFIED' : 'NEEDS_REVIEW'),
        importacion_id: ctx.importacionId,
      });
      return { accion, id: registroId };
    },
  },

  marcas_repuesto: {
    titulo: 'Marcas de repuestos',
    campos: [
      t('nombre', 'Marca', { requerido: true, max: 80, alias: ['brand', 'marca'] }),
      t('pais', 'País', { alias: ['country'] }),
      { nombre: 'sitio_web', etiqueta: 'Sitio web', tipo: 'url', alias: ['website'] },
      { nombre: 'para_autos', etiqueta: 'Repuestos para autos', tipo: 'booleano', alias: ['cars'] },
      { nombre: 'para_motos', etiqueta: 'Repuestos para motos', tipo: 'booleano', alias: ['motorcycles'] },
      ...CAMPOS_TRAZABILIDAD,
    ],
    async procesar(ctx, fila) {
      const antes = ctx.contados('marcas_repuesto');
      const id = await resolverMarcaRepuesto(ctx, fila.nombre, fila);
      const { accion } = await guardar(ctx, 'marcas_repuesto', { id }, {
        pais: fila.pais, sitio_web: fila.sitio_web, para_autos: fila.para_autos, para_motos: fila.para_motos,
      });
      return { accion: ctx.contados('marcas_repuesto') > antes ? 'creado' : accion, id };
    },
  },

  lineas_marca_repuesto: {
    titulo: 'Líneas de producto de una marca de repuestos',
    descripcion: 'Qué fabrica cada marca ("Brembo: pastillas, discos…"), relacionado con una categoría. No crea productos.',
    trazable: false,
    campos: [
      t('marca', 'Marca de repuestos', { requerido: true, max: 80, alias: ['brand', 'part_brand'] }),
      t('linea', 'Línea de producto', { requerido: true, max: 120, alias: ['line', 'product_line'] }),
      t('categoria', 'Categoría (ruta, ej: "Motos > Frenos > Pastillas"; vacía si no hay una)', { alias: ['category'] }),
      { nombre: 'orden', etiqueta: 'Orden', tipo: 'entero', min: 0, max: 999 },
      { nombre: 'estado_verificacion', etiqueta: 'Estado', tipo: 'lista', lista: 'estado_verificacion', alias: ['estado', 'status'] },
    ],
    async procesar(ctx, fila) {
      const marcaId = await resolverMarcaRepuesto(ctx, fila.marca, fila);
      const categoria = fila.categoria ? await resolverCategoria(ctx, fila.categoria) : null;
      // Una línea de una categoría de motos marca a la marca como "repuestos para motos"
      if (categoria?.rubro === 'motos') await ctx.db.query('UPDATE marcas_repuesto SET para_motos = true WHERE id = $1 AND NOT para_motos', [marcaId]);
      const estado = traza(ctx, fila).estado_verificacion;
      const { rows: [actual] } = await ctx.db.query(
        'SELECT estado_verificacion FROM marca_repuesto_lineas WHERE marca_repuesto_id = $1 AND nombre = $2', [marcaId, fila.linea]);
      const { accion, registro } = await guardar(ctx, 'marca_repuesto_lineas', { marca_repuesto_id: marcaId, nombre: fila.linea }, {
        categoria_id: categoria?.id ?? null, orden: fila.orden, fuente_id: ctx.fuente.id, importacion_id: ctx.importacionId,
        // Un dato verificado no se pisa con uno sin verificar
        estado_verificacion: actual?.estado_verificacion === 'VERIFIED' && estado !== 'VERIFIED' ? 'VERIFIED' : estado,
      });
      return { accion, id: registro.id };
    },
  },

  publicaciones: {
    titulo: 'Precios y stock de un vendedor',
    trazable: false,
    campos: [
      t('vendedor', 'Vendedor (slug o nombre)', { requerido: true, alias: ['seller', 'supplier', 'proveedor'] }),
      t('sku', 'SKU AUTONEX'),
      t('marca', 'Marca del repuesto', { alias: ['brand', 'part_brand'] }),
      t('numero_pieza', 'Número de pieza', { alias: ['part_number'] }),
      { nombre: 'precio', etiqueta: 'Precio (ARS)', tipo: 'decimal', requerido: true, min: 0.01, alias: ['price'] },
      { nombre: 'stock', etiqueta: 'Stock', tipo: 'entero', requerido: true, min: 0, alias: ['quantity', 'cantidad'] },
      { nombre: 'condicion', etiqueta: 'Condición', tipo: 'lista', lista: 'condicion', alias: ['condition'] },
      { nombre: 'pausada', etiqueta: 'Pausada', tipo: 'booleano', alias: ['paused'] },
    ],
    async procesar(ctx, fila) {
      const productoId = await buscarProducto(ctx, fila);
      const { rows: [vendedor] } = await ctx.db.query(
        'SELECT id FROM vendedores WHERE slug = $1 OR normalizar(nombre_comercial) = normalizar($2)', [slugificar(fila.vendedor), fila.vendedor]);
      if (!vendedor) throw new ErrorFila(`No existe el vendedor "${fila.vendedor}".`, 'vendedor');
      const { accion, registro } = await guardar(ctx, 'publicaciones',
        { producto_id: productoId, vendedor_id: vendedor.id, condicion: fila.condicion || 'nuevo' },
        { precio: fila.precio, stock: fila.stock, estado: fila.pausada === undefined ? undefined : (fila.pausada ? 'pausada' : 'activa') });
      return { accion, id: registro.id };
    },
  },
};

// Las entidades del catálogo aceptan además las columnas de trazabilidad
for (const def of Object.values(ENTIDADES)) {
  if (def.trazable !== false && def !== ENTIDADES.categorias) def.campos.push(...CAMPOS_TRAZABILIDAD);
}

/** Mapa cabecera normalizada -> campo, para aceptar nombres en castellano o inglés. */
export function indiceCabeceras(def) {
  const indice = new Map();
  const clave = (s) => normalizarTexto(s).replace(/ /g, '_');
  for (const c of def.campos) {
    indice.set(clave(c.nombre), c);
    for (const a of c.alias || []) if (!indice.has(clave(a))) indice.set(clave(a), c);
  }
  return { indice, clave };
}

export { ErrorCampo };

// Lógica del panel de administración: listado, alta, edición y baja genéricos con trazabilidad,
// cambios de estado de verificación (con historial) y validaciones de cada entidad.

import { ENTIDADES_ADMIN } from './entidades.js';
import { ErrorCampo, VALORES, convertir } from '../importacion/campos.js';
import { claveNombre, claveVehiculo, slugificar } from '../catalogo/normalizacion.js';
import { buscarNombreSimilar } from '../catalogo/duplicados.js';
import { recalcularMarcas, recalcularModelos } from '../catalogo/agregados.js';
import { ErrorApi } from '../errores.js';

export const POR_PAGINA = 50;
export const ESTADOS = Object.keys(VALORES.estado_verificacion);

export function definicion(entidad, { escritura = false } = {}) {
  const def = ENTIDADES_ADMIN[entidad];
  if (!def) throw new ErrorApi(404, `No existe la sección "${entidad}" en el panel.`);
  if (escritura && def.soloLectura) throw new ErrorApi(400, `"${entidad}" es de solo lectura.`);
  return def;
}

/** Esquema para que el frontend arme tablas y formularios. */
export function esquema() {
  const entidades = {};
  for (const [clave, def] of Object.entries(ENTIDADES_ADMIN)) {
    if (def.soloLectura) continue;
    entidades[clave] = {
      titulo: def.titulo, singular: def.singular, trazable: def.trazable, columnas: def.columnas,
      campos: def.campos, padre: def.padre || null, admite_fusion: Boolean(def.duplicados) || ['vehiculos', 'motores', 'productos'].includes(clave),
    };
  }
  const listas = Object.fromEntries(Object.entries(VALORES).map(([k, v]) => [k, Object.keys(v)]));
  return { entidades, listas };
}

// ---------------------------------------------------------------- listado

/**
 * Listado paginado con búsqueda y filtros de trazabilidad.
 * filtros: { q, pagina, estado, fuente, padre, sin_fuente }
 */
export async function listar(db, entidad, filtros = {}) {
  const def = definicion(entidad);
  const params = [];
  const where = [];
  if (filtros.q) {
    params.push(`%${filtros.q}%`);
    where.push(`${def.busqueda} LIKE normalizar($${params.length})`);
  }
  if (filtros.estado && def.trazable) {
    params.push(filtros.estado);
    where.push(`t.estado_verificacion = $${params.length}`);
  }
  if (filtros.fuente && def.trazable) {
    params.push(Number(filtros.fuente));
    where.push(`t.fuente_id = $${params.length}`);
  }
  if (filtros.padre && def.padre) {
    params.push(Number(filtros.padre));
    where.push(`t.${def.padre} = $${params.length}`);
  }
  if (filtros.ids?.length) {
    params.push(filtros.ids.map(Number));
    where.push(`t.id = ANY($${params.length}::int[])`);
  }
  const condicion = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const pagina = Math.max(1, Number(filtros.pagina) || 1);
  const limite = Math.min(Number(filtros.limite) || POR_PAGINA, 200);

  const traza = def.trazable
    ? `, t.estado_verificacion, t.confianza, t.fuente_id, t.actualizado_en, t.verificado_en, f.nombre AS fuente`
    : '';
  const joinFuente = def.trazable ? 'LEFT JOIN fuentes f ON f.id = t.fuente_id' : '';
  const [{ rows }, { rows: [{ total }] }] = await Promise.all([
    db.query(`
      SELECT t.*${def.seleccion ? `, ${def.seleccion}` : ''}, ${def.etiqueta} AS etiqueta${traza}
        FROM ${def.desde} ${joinFuente} ${condicion}
       ORDER BY ${def.orden} LIMIT ${limite} OFFSET ${(pagina - 1) * limite}`, params),
    db.query(`SELECT count(*) AS total FROM ${def.desde} ${condicion}`, params),
  ]);
  // Columnas internas que no aportan en el listado
  for (const r of rows) {
    delete r.clave_normalizada;
    delete r.datos_fuente;
  }
  return { entidad, registros: rows, total, pagina, paginas: Math.max(1, Math.ceil(total / limite)) };
}

/** Opciones para un campo de referencia (autocompletar en formularios). */
export async function opciones(db, entidad, { q, padre, limite = 30 }) {
  const def = definicion(entidad);
  const params = [];
  const where = [];
  if (q) {
    params.push(`%${q}%`);
    where.push(`${def.busqueda} LIKE normalizar($${params.length})`);
  }
  if (padre && def.padre) {
    params.push(Number(padre));
    where.push(`t.${def.padre} = $${params.length}`);
  }
  const { rows } = await db.query(`
    SELECT t.id, ${def.etiqueta} AS etiqueta FROM ${def.desde}
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY ${def.orden} LIMIT ${Math.min(limite, 100)}`, params);
  return rows;
}

// ---------------------------------------------------------------- detalle

export async function obtener(db, entidad, id) {
  const def = definicion(entidad);
  const { rows: [registro] } = await db.query(`
    SELECT t.*${def.seleccion ? `, ${def.seleccion}` : ''}, ${def.etiqueta} AS etiqueta
      FROM ${def.desde} WHERE t.id = $1`, [id]);
  if (!registro) throw new ErrorApi(404, `No existe ${def.singular?.toLowerCase() || 'el registro'} #${id}.`);
  delete registro.clave_normalizada;

  // Etiquetas de las referencias, para mostrarlas en el formulario sin otra consulta
  const referencias = {};
  for (const campo of def.campos.filter((c) => c.tipo === 'ref' && registro[c.nombre])) {
    const destino = ENTIDADES_ADMIN[campo.ref];
    const { rows: [r] } = await db.query(`SELECT ${destino.etiqueta} AS etiqueta FROM ${destino.desde} WHERE t.id = $1`, [registro[campo.nombre]]);
    referencias[campo.nombre] = r?.etiqueta ?? null;
  }

  const extra = {};
  if (def.trazable) {
    const [{ rows: [fuente] }, { rows: historial }] = await Promise.all([
      db.query('SELECT id, slug, nombre, tipo, licencia, url FROM fuentes WHERE id = $1', [registro.fuente_id]),
      db.query(`
        SELECT v.estado_anterior, v.estado_nuevo, v.nota, v.creado_en, f.nombre AS fuente,
               u.nombre || ' ' || u.apellido AS usuario
          FROM verificaciones v LEFT JOIN fuentes f ON f.id = v.fuente_id LEFT JOIN usuarios u ON u.id = v.usuario_id
         WHERE v.entidad = $1 AND v.registro_id = $2 ORDER BY v.creado_en DESC LIMIT 50`, [entidad, String(id)]),
    ]);
    extra.fuente = fuente || null;
    extra.historial_verificacion = historial;
    if (registro.importacion_id) {
      const { rows: [imp] } = await db.query(
        'SELECT id, archivo, formato, iniciada_en FROM importaciones WHERE id = $1', [registro.importacion_id]);
      extra.importacion = imp || null;
    }
  }
  if (entidad === 'productos') Object.assign(extra, await detalleProducto(db, id));
  return { entidad, registro, referencias, ...extra };
}

async function detalleProducto(db, id) {
  const [oem, equivalencias, compat, proveedores, publicaciones] = await Promise.all([
    db.query(`
      SELECT o.id, o.numero_oem, ma.id AS marca_vehiculo_id, ma.nombre AS marca, o.estado_verificacion, f.nombre AS fuente
        FROM oem_productos o JOIN marcas_vehiculo ma ON ma.id = o.marca_vehiculo_id LEFT JOIN fuentes f ON f.id = o.fuente_id
       WHERE o.producto_id = $1 ORDER BY ma.nombre, o.numero_oem`, [id]),
    db.query(`
      SELECT e.id, e.numero_pieza, e.tipo, mr.nombre AS marca, e.producto_equivalente_id, pe.sku AS sku_equivalente,
             e.estado_verificacion, f.nombre AS fuente
        FROM equivalencias e JOIN marcas_repuesto mr ON mr.id = e.marca_repuesto_id
        LEFT JOIN productos pe ON pe.id = e.producto_equivalente_id LEFT JOIN fuentes f ON f.id = e.fuente_id
       WHERE e.producto_id = $1 ORDER BY mr.nombre, e.numero_pieza`, [id]),
    db.query(`SELECT estado_verificacion AS estado, count(*) AS cantidad FROM compatibilidades WHERE producto_id = $1 GROUP BY 1`, [id]),
    db.query(`
      SELECT pp.id, pp.codigo_proveedor, pr.nombre AS proveedor FROM productos_proveedor pp
        JOIN proveedores pr ON pr.id = pp.proveedor_id WHERE pp.producto_id = $1`, [id]),
    db.query(`
      SELECT pu.id, pu.precio, pu.stock, pu.condicion, pu.estado, ve.nombre_comercial AS vendedor
        FROM publicaciones pu JOIN vendedores ve ON ve.id = pu.vendedor_id WHERE pu.producto_id = $1 ORDER BY pu.precio`, [id]),
  ]);
  return {
    oem: oem.rows, equivalencias: equivalencias.rows, proveedores: proveedores.rows, publicaciones: publicaciones.rows,
    compatibilidades_por_estado: Object.fromEntries(compat.rows.map((r) => [r.estado, r.cantidad])),
  };
}

// ---------------------------------------------------------------- alta y edición

/** Convierte y valida los datos de un formulario según los campos de la entidad. */
function validar(def, datos, { parcial }) {
  const limpio = {};
  const errores = [];
  for (const campo of def.campos) {
    if (parcial && !(campo.nombre in datos)) continue;
    try {
      if (campo.tipo === 'ref') {
        const valor = datos[campo.nombre];
        if (valor === undefined || valor === null || valor === '') {
          if (campo.requerido) throw new ErrorCampo(campo.nombre, `Falta completar "${campo.etiqueta}".`);
          continue;
        }
        const n = Number(valor);
        if (!Number.isInteger(n) || n < 1) throw new ErrorCampo(campo.nombre, `"${campo.etiqueta}" no es válido.`);
        limpio[campo.nombre] = n;
      } else {
        const v = convertir(campo, datos[campo.nombre]);
        if (v !== undefined) limpio[campo.nombre] = v;
      }
    } catch (e) {
      if (!(e instanceof ErrorCampo)) throw e;
      errores.push({ campo: e.campo, mensaje: e.message });
    }
  }
  if (errores.length) throw new ErrorApi(400, errores[0].mensaje, { detalles: errores.map((e) => e.mensaje), campos: errores });
  return limpio;
}

/** Campos derivados (clave normalizada, slug, código) y reglas propias de cada entidad. */
async function completar(db, entidad, datos, actual = null) {
  const valor = (c) => (c in datos ? datos[c] : actual?.[c]);
  switch (entidad) {
    case 'marcas':
    case 'marcas_repuesto':
      if ('nombre' in datos) {
        datos.clave_normalizada = claveNombre(datos.nombre);
        if (!actual) datos.slug = slugificar(datos.nombre);
      }
      break;
    case 'modelos':
      if ('nombre' in datos) datos.clave_normalizada = claveNombre(datos.nombre);
      break;
    case 'motores':
      if ('nombre' in datos || 'combustible' in datos) datos.clave_normalizada = claveNombre(`${valor('nombre')} ${valor('combustible') || ''}`);
      break;
    case 'generaciones':
    case 'vehiculos':
      if (valor('anio_hasta') && valor('anio_hasta') < valor('anio_desde')) {
        throw new ErrorApi(400, 'El año hasta no puede ser anterior al año desde.');
      }
      if (entidad === 'vehiculos') {
        if (valor('generacion_id')) {
          const { rows: [g] } = await db.query('SELECT modelo_id FROM generaciones WHERE id = $1', [valor('generacion_id')]);
          if (g && g.modelo_id !== valor('modelo_id')) throw new ErrorApi(400, 'La generación elegida es de otro modelo.');
        }
        const { rows: [m] } = await db.query(`
          SELECT mo.nombre AS modelo, ma.nombre AS marca, mo.marca_id FROM modelos_vehiculo mo
            JOIN marcas_vehiculo ma ON ma.id = mo.marca_id WHERE mo.id = $1`, [valor('modelo_id')]);
        if (!m) throw new ErrorApi(400, 'El modelo elegido no existe.');
        let motor = null;
        if (valor('motor_id')) {
          ({ rows: [motor] } = await db.query('SELECT nombre, marca_id FROM motores WHERE id = $1', [valor('motor_id')]));
          if (motor?.marca_id && motor.marca_id !== m.marca_id) throw new ErrorApi(400, 'El motor elegido es de otra marca.');
        }
        datos.clave_normalizada = claveVehiculo(m.modelo, valor('version'), motor?.nombre);
        if (!actual && !datos.codigo) {
          datos.codigo = `MAN-${[m.marca, m.modelo, valor('anio_desde'), valor('version')].join('-')}`
            .toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]+/g, '-').replace(/-$/, '').slice(0, 80);
        }
      }
      break;
    case 'categorias':
      if ('nombre' in datos && !actual) {
        let slug = slugificar(datos.nombre);
        const { rows: [existe] } = await db.query('SELECT 1 FROM categorias WHERE slug = $1', [slug]);
        if (existe && datos.padre_id) {
          const { rows: [p] } = await db.query('SELECT slug FROM categorias WHERE id = $1', [datos.padre_id]);
          slug = `${p?.slug || 'cat'}-${slug}`;
        }
        datos.slug = slug;
      }
      if ('padre_id' in datos || !actual) {
        const padre = valor('padre_id');
        if (padre && actual && padre === actual.id) throw new ErrorApi(400, 'Una categoría no puede ser su propia madre.');
        if (padre && actual) {
          const { rows: [ciclo] } = await db.query(`
            WITH RECURSIVE d AS (SELECT id FROM categorias WHERE padre_id = $1 UNION ALL
                                 SELECT c.id FROM categorias c JOIN d ON c.padre_id = d.id)
            SELECT 1 FROM d WHERE id = $2`, [actual.id, padre]);
          if (ciclo) throw new ErrorApi(400, 'No se puede mover una categoría dentro de una de sus subcategorías.');
        }
        const { rows: [p] } = padre ? await db.query('SELECT nivel FROM categorias WHERE id = $1', [padre]) : { rows: [null] };
        datos.nivel = p ? p.nivel + 1 : 1;
      }
      if (datos.prefijo_sku) datos.prefijo_sku = datos.prefijo_sku.toUpperCase();
      break;
    case 'productos':
      if (datos.sku === undefined && !actual) delete datos.sku;
      break;
    case 'fuentes':
      if ('nombre' in datos && !actual) datos.slug = slugificar(datos.nombre);
      break;
    default:
  }
  return datos;
}

async function fuenteManual(db) {
  const { rows: [f] } = await db.query(`
    INSERT INTO fuentes (slug, nombre, tipo, nivel_confianza, notas)
    VALUES ('manual', 'Carga manual (panel de administración)', 'manual', 'media',
            'Datos cargados a mano por un administrador. Indicá la URL de respaldo en cada registro cuando exista.')
    ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug RETURNING *`);
  return f;
}

/** Trazabilidad de un alta o edición manual. */
async function trazaManual(db, def, cuerpo, actual) {
  if (!def.trazable) return {};
  const traza = {};
  let fuente = null;
  if (cuerpo.fuente_id) {
    ({ rows: [fuente] } = await db.query('SELECT * FROM fuentes WHERE id = $1', [cuerpo.fuente_id]));
    if (!fuente) throw new ErrorApi(400, 'La fuente indicada no existe.');
  } else if (!actual) {
    fuente = await fuenteManual(db);
  }
  if (fuente) traza.fuente_id = fuente.id;
  if (cuerpo.fuente_url !== undefined) traza.fuente_url = cuerpo.fuente_url;
  if (cuerpo.confianza) traza.confianza = cuerpo.confianza;
  // El estado solo cambia por la acción de verificación (deja historial). Un alta manual nace sin verificar.
  if (!actual) traza.estado_verificacion = 'UNVERIFIED';
  traza.actualizado_en = new Date();
  return traza;
}

async function verificarDuplicado(db, entidad, def, datos, excluirId) {
  if (!def.duplicados || !datos.nombre) return;
  const padre = def.padre ? datos[def.padre] : null;
  const { rows: [igual] } = await db.query(
    `SELECT id, nombre FROM ${def.tabla} WHERE clave_normalizada = $1 ${def.padre ? `AND ${def.padre} = $3` : ''} AND id <> $2 LIMIT 1`,
    def.padre ? [claveNombre(datos.nombre), excluirId || 0, padre] : [claveNombre(datos.nombre), excluirId || 0]);
  if (igual) throw new ErrorApi(409, `Ya existe "${igual.nombre}" (#${igual.id}).`, { existente: igual });
  const similar = await buscarNombreSimilar(db, def.duplicados, datos.nombre, padre, excluirId);
  if (similar) {
    throw new ErrorApi(409, `Posible duplicado de "${similar.nombre}" (#${similar.id}). Si es otro registro, confirmá para crearlo igual.`,
      { posible_duplicado: similar, requiere_confirmacion: true });
  }
}

async function recalcular(db, entidad, registro) {
  if (entidad === 'vehiculos') {
    await recalcularModelos(db, [registro.modelo_id]);
    const { rows: [m] } = await db.query('SELECT marca_id FROM modelos_vehiculo WHERE id = $1', [registro.modelo_id]);
    if (m) await recalcularMarcas(db, [m.marca_id]);
  }
}

/**
 * Alta manual. cuerpo = { datos, fuente_id?, fuente_url?, confianza?, confirmar_duplicado? }
 */
export async function crear(db, entidad, cuerpo, usuarioId) {
  const def = definicion(entidad, { escritura: true });
  const datos = await completar(db, entidad, validar(def, cuerpo.datos || {}, { parcial: false }));
  if (!cuerpo.confirmar_duplicado) await verificarDuplicado(db, entidad, def, datos, null);
  Object.assign(datos, await trazaManual(db, def, cuerpo, null));
  const columnas = Object.keys(datos);
  const { rows: [registro] } = await db.query(
    `INSERT INTO ${def.tabla} (${columnas.join(', ')}) VALUES (${columnas.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
    columnas.map((c) => datos[c]));
  if (def.trazable) {
    await db.query(`INSERT INTO verificaciones (entidad, registro_id, estado_anterior, estado_nuevo, fuente_id, nota, usuario_id)
                    VALUES ($1, $2, NULL, $3, $4, 'alta manual', $5)`,
    [entidad, String(registro.id), registro.estado_verificacion, registro.fuente_id, usuarioId]);
  }
  await recalcular(db, entidad, registro);
  return registro;
}

/**
 * Edición. cuerpo = { datos, limpiar?: [campos que pasan a vacío], fuente_id?, fuente_url?, confianza? }
 * Si se cambian datos de un registro VERIFIED, vuelve a UNVERIFIED (el dato nuevo no está confirmado).
 */
export async function actualizar(db, entidad, id, cuerpo, usuarioId) {
  const def = definicion(entidad, { escritura: true });
  const { rows: [actual] } = await db.query(`SELECT * FROM ${def.tabla} WHERE id = $1 FOR UPDATE`, [id]);
  if (!actual) throw new ErrorApi(404, `No existe ${def.singular.toLowerCase()} #${id}.`);

  const datos = validar(def, cuerpo.datos || {}, { parcial: true });
  for (const campo of cuerpo.limpiar || []) {
    const c = def.campos.find((x) => x.nombre === campo);
    if (!c) continue;
    if (c.requerido) throw new ErrorApi(400, `"${c.etiqueta}" es obligatorio: no se puede dejar vacío.`);
    datos[campo] = c.tipo === 'booleano' && !c.triestado ? false : null;
  }
  await completar(db, entidad, datos, actual);
  if (datos.nombre && datos.nombre !== actual.nombre && !cuerpo.confirmar_duplicado) {
    await verificarDuplicado(db, entidad, def, { ...actual, ...datos }, actual.id);
  }
  const cambiados = Object.keys(datos).filter((c) => JSON.stringify(datos[c]) !== JSON.stringify(actual[c]) && c !== 'clave_normalizada' && c !== 'nivel');
  const traza = await trazaManual(db, def, cuerpo, actual);
  const cambiaFuente = traza.fuente_id && traza.fuente_id !== actual.fuente_id;
  if (!cambiados.length && !cambiaFuente && traza.fuente_url === undefined && !traza.confianza) return { registro: actual, cambios: [] };

  if (def.trazable && actual.estado_verificacion === 'VERIFIED' && cambiados.length) {
    traza.estado_verificacion = 'UNVERIFIED';
    traza.verificado_en = null;
  }
  const sets = { ...datos, ...traza };
  const columnas = Object.keys(sets);
  const { rows: [registro] } = await db.query(
    `UPDATE ${def.tabla} SET ${columnas.map((c, i) => `${c} = $${i + 1}`).join(', ')} WHERE id = $${columnas.length + 1} RETURNING *`,
    [...columnas.map((c) => sets[c]), id]);
  if (def.trazable && registro.estado_verificacion !== actual.estado_verificacion) {
    await db.query(`INSERT INTO verificaciones (entidad, registro_id, estado_anterior, estado_nuevo, fuente_id, nota, usuario_id)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [entidad, String(id), actual.estado_verificacion, registro.estado_verificacion, registro.fuente_id,
      `edición manual (${cambiados.join(', ')}): vuelve a revisión`, usuarioId]);
  }
  await recalcular(db, entidad, registro);
  if (entidad === 'vehiculos' && actual.modelo_id !== registro.modelo_id) await recalcular(db, entidad, actual);
  return { registro, cambios: cambiados };
}

// ---------------------------------------------------------------- baja

// Qué impide borrar un registro (nunca se borra en cascada desde el panel: se marca DISCONTINUED)
const DEPENDENCIAS = {
  marcas: [['modelos_vehiculo', 'marca_id', 'modelos'], ['motores', 'marca_id', 'motores'], ['oem_productos', 'marca_vehiculo_id', 'números OEM']],
  modelos: [['vehiculos', 'modelo_id', 'versiones'], ['generaciones', 'modelo_id', 'generaciones']],
  generaciones: [['vehiculos', 'generacion_id', 'versiones']],
  motores: [['vehiculos', 'motor_id', 'versiones']],
  vehiculos: [['compatibilidades', 'vehiculo_id', 'compatibilidades']],
  categorias: [['categorias', 'padre_id', 'subcategorías'], ['productos', 'categoria_id', 'productos']],
  marcas_repuesto: [['productos', 'marca_repuesto_id', 'productos'], ['equivalencias', 'marca_repuesto_id', 'equivalencias']],
  productos: [['publicaciones', 'producto_id', 'publicaciones'], ['pedido_items', 'producto_id', 'compras']],
  fuentes: [],
  proveedores: [['productos_proveedor', 'proveedor_id', 'códigos de proveedor']],
};

export async function eliminar(db, entidad, id) {
  const def = definicion(entidad, { escritura: true });
  const { rows: [actual] } = await db.query(`SELECT * FROM ${def.tabla} WHERE id = $1`, [id]);
  if (!actual) throw new ErrorApi(404, `No existe ${def.singular.toLowerCase()} #${id}.`);
  const bloqueos = [];
  for (const [tabla, columna, nombre] of DEPENDENCIAS[entidad] || []) {
    const { rows: [{ n }] } = await db.query(`SELECT count(*)::int AS n FROM ${tabla} WHERE ${columna} = $1`, [id]);
    if (n) bloqueos.push(`${n} ${nombre}`);
  }
  if (bloqueos.length) {
    throw new ErrorApi(409, `No se puede eliminar: tiene ${bloqueos.join(', ')}. ${def.trazable ? 'Marcalo como DISCONTINUED o fusionalo con otro registro.' : 'Reasigná esos datos primero.'}`,
      { dependencias: bloqueos });
  }
  if (entidad === 'productos') await db.query('DELETE FROM compatibilidades WHERE producto_id = $1', [id]);
  await db.query(`DELETE FROM ${def.tabla} WHERE id = $1`, [id]);
  await recalcular(db, entidad, actual);
  return actual;
}

// ---------------------------------------------------------------- verificación

const TABLAS_VERIFICABLES = {
  marcas: 'marcas_vehiculo', modelos: 'modelos_vehiculo', generaciones: 'generaciones', motores: 'motores',
  vehiculos: 'vehiculos', marcas_repuesto: 'marcas_repuesto', productos: 'productos',
  oem: 'oem_productos', equivalencias: 'equivalencias',
};

/**
 * Cambia el estado de verificación de varios registros y deja historial.
 * Para compatibilidades los ids son "productoId:vehiculoId".
 * VERIFIED exige una fuente que no sea de demostración (la del registro o la que se indica ahora).
 */
export async function cambiarVerificacion(db, { entidad, ids, estado, fuente_id: fuenteId, fuente_url: fuenteUrl, nota }, usuarioId) {
  if (!ESTADOS.includes(estado)) throw new ErrorApi(400, `Estado inválido. Opciones: ${ESTADOS.join(', ')}.`);
  const esCompat = entidad === 'compatibilidades';
  const tabla = esCompat ? 'compatibilidades' : TABLAS_VERIFICABLES[entidad];
  if (!tabla) throw new ErrorApi(400, `"${entidad}" no tiene estado de verificación.`);
  if (!ids?.length) throw new ErrorApi(400, 'Elegí al menos un registro.');

  let fuente = null;
  if (fuenteId) {
    ({ rows: [fuente] } = await db.query('SELECT * FROM fuentes WHERE id = $1', [fuenteId]));
    if (!fuente) throw new ErrorApi(400, 'La fuente indicada no existe.');
  }
  if (estado === 'VERIFIED' && fuente?.tipo === 'demo') {
    throw new ErrorApi(400, 'Una fuente de demostración no sirve para verificar datos.');
  }
  if (estado === 'VERIFIED' && !fuente && !nota) {
    throw new ErrorApi(400, 'Para marcar como VERIFIED indicá con qué fuente lo confirmaste (o una nota con la referencia).');
  }

  const claves = esCompat
    ? ids.map((x) => {
      const [p, v] = String(x).split(':').map(Number);
      if (!p || !v) throw new ErrorApi(400, `Compatibilidad inválida: "${x}" (formato producto:vehiculo).`);
      return [p, v];
    })
    : ids.map(Number);
  const where = esCompat
    ? '(producto_id, vehiculo_id) IN (SELECT * FROM unnest($1::int[], $2::int[]))'
    : 'id = ANY($1::int[])';
  const params = esCompat ? [claves.map((c) => c[0]), claves.map((c) => c[1])] : [claves];

  const { rows: actuales } = await db.query(
    `SELECT ${esCompat ? "t.producto_id || ':' || t.vehiculo_id" : 't.id::text'} AS clave, t.estado_verificacion, t.fuente_id, f.tipo AS tipo_fuente
       FROM ${tabla} t LEFT JOIN fuentes f ON f.id = t.fuente_id WHERE ${where.replace(/\b(id|producto_id|vehiculo_id)\b/g, 't.$1')}`, params);
  if (!actuales.length) throw new ErrorApi(404, 'No se encontraron los registros indicados.');
  if (estado === 'VERIFIED' && !fuente) {
    const demo = actuales.filter((a) => !a.fuente_id || a.tipo_fuente === 'demo');
    if (demo.length) {
      throw new ErrorApi(400, `${demo.length} registro(s) vienen de datos de demostración o sin fuente: para verificarlos elegí la fuente real con la que los confirmaste.`);
    }
  }

  const sets = ['estado_verificacion = $X', 'actualizado_en = now()',
    estado === 'VERIFIED' ? 'verificado_en = now()' : null,
    fuente ? `fuente_id = ${Number(fuente.id)}` : null].filter(Boolean);
  const n = params.length + 1;
  const extraUrl = fuenteUrl ? `, fuente_url = $${n + 1}` : '';
  await db.query(`UPDATE ${tabla} SET ${sets.join(', ').replace('$X', `$${n}`)}${extraUrl} WHERE ${where}`,
    [...params, estado, ...(fuenteUrl ? [fuenteUrl] : [])]);
  await db.query(`
    INSERT INTO verificaciones (entidad, registro_id, estado_anterior, estado_nuevo, fuente_id, nota, usuario_id)
    SELECT $1, a->>'clave', a->>'estado_verificacion', $2, coalesce($3, (a->>'fuente_id')::int), $4, $5
      FROM jsonb_array_elements($6::jsonb) a WHERE a->>'estado_verificacion' IS DISTINCT FROM $2`,
  [entidad, estado, fuente?.id ?? null, nota || null, usuarioId, JSON.stringify(actuales)]);
  return { actualizados: actuales.length, sin_cambios: actuales.filter((a) => a.estado_verificacion === estado).length };
}

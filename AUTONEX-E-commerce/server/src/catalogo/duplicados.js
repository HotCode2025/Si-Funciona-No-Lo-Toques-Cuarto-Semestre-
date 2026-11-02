// Detección y resolución de posibles duplicados.
// Regla de la especificación: nunca se crea ni se fusiona automáticamente. Se sugiere "posible duplicado"
// y un administrador decide (fusionar, descartar la sugerencia o crear igual).

import { claveNombre, tokensDistintivos } from './normalizacion.js';
import { ErrorApi } from '../errores.js';

export const UMBRAL_SIMILITUD = 0.6;

export class Duplicado extends Error {
  constructor({ entidad, registroId, nombreExistente, similitud, motivo }) {
    super(`Posible duplicado de "${nombreExistente}" (${motivo}).`);
    Object.assign(this, { entidad, registroId, nombreExistente, similitud, motivo });
  }
}

// Tablas con nombre comparable por similitud y el filtro de "hermanos" (mismo padre)
const NOMBRES = {
  marcas: { tabla: 'marcas_vehiculo', padre: null },
  modelos: { tabla: 'modelos_vehiculo', padre: 'marca_id' },
  marcas_repuesto: { tabla: 'marcas_repuesto', padre: null },
  generaciones: { tabla: 'generaciones', padre: 'modelo_id' },
};

/** Busca un registro con nombre parecido (no igual) entre los hermanos. Devuelve { id, nombre, similitud } o null. */
export async function buscarNombreSimilar(db, entidad, nombre, padreId = null, excluirId = null) {
  const cfg = NOMBRES[entidad];
  const params = [nombre];
  let filtro = '';
  if (cfg.padre) {
    params.push(padreId);
    filtro += ` AND ${cfg.padre} = $${params.length}`;
  }
  if (excluirId) {
    params.push(excluirId);
    filtro += ` AND id <> $${params.length}`;
  }
  const { rows } = await db.query(
    `SELECT id, nombre, similarity(normalizar(nombre), normalizar($1)) AS similitud
       FROM ${cfg.tabla}
      WHERE normalizar(nombre) % normalizar($1) ${filtro}
      ORDER BY similitud DESC LIMIT 5`, params);
  const clave = claveNombre(nombre);
  const distintivos = tokensDistintivos(nombre);
  return rows.find((r) => claveNombre(r.nombre) !== clave
    && Number(r.similitud) >= UMBRAL_SIMILITUD
    && tokensDistintivos(r.nombre) === distintivos) || null;
}

/** Otra versión del mismo modelo con la misma descripción normalizada y años que se superponen. */
export async function buscarVehiculoEquivalente(db, { modeloId, clave, anioDesde, anioHasta, excluirCodigo }) {
  const { rows } = await db.query(`
    SELECT v.id, v.codigo, v.version, v.anio_desde, v.anio_hasta
      FROM vehiculos v
     WHERE v.modelo_id = $1 AND v.clave_normalizada = $2 AND v.codigo <> $3
       AND v.anio_desde <= coalesce($5::int, 9999) AND coalesce(v.anio_hasta, 9999) >= $4
     LIMIT 1`, [modeloId, clave, excluirCodigo, anioDesde, anioHasta ?? null]);
  return rows[0] || null;
}

export async function registrarDuplicado(db, { entidad, registroId, duplicadoId = null, datosNuevos = null, importacionId = null, similitud = null, motivo, estado = 'pendiente' }) {
  await db.query(`
    INSERT INTO posibles_duplicados (entidad, registro_id, duplicado_id, datos_nuevos, importacion_id, similitud, motivo, estado)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT DO NOTHING`, [entidad, registroId, duplicadoId, datosNuevos, importacionId, similitud, motivo, estado]);
}

// ---------------------------------------------------------------- escaneo de la base
/** Busca duplicados entre registros ya cargados y los deja pendientes de revisión. Devuelve cuántos encontró. */
export async function escanearDuplicados(db, entidades = ['marcas', 'modelos', 'vehiculos', 'motores', 'marcas_repuesto']) {
  let nuevos = 0;
  const registrar = async (entidad, a, b, similitud, motivo) => {
    const r = await db.query(`
      INSERT INTO posibles_duplicados (entidad, registro_id, duplicado_id, similitud, motivo)
      VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING id`, [entidad, a, b, similitud, motivo]);
    nuevos += r.rowCount;
  };

  for (const entidad of entidades.filter((e) => NOMBRES[e])) {
    const cfg = NOMBRES[entidad];
    const mismoPadre = cfg.padre ? `AND a.${cfg.padre} = b.${cfg.padre}` : '';
    const { rows } = await db.query(`
      SELECT a.id AS a, b.id AS b, a.nombre AS na, b.nombre AS nb, similarity(normalizar(a.nombre), normalizar(b.nombre)) AS s
        FROM ${cfg.tabla} a JOIN ${cfg.tabla} b ON a.id < b.id ${mismoPadre}
         AND normalizar(a.nombre) % normalizar(b.nombre)`);
    for (const r of rows) {
      const igual = claveNombre(r.na) === claveNombre(r.nb);
      if ((igual || Number(r.s) >= UMBRAL_SIMILITUD) && tokensDistintivos(r.na) === tokensDistintivos(r.nb)) {
        await registrar(entidad, r.a, r.b, igual ? 1 : r.s, igual ? 'mismo nombre normalizado' : `nombres parecidos (${Math.round(r.s * 100)} %)`);
      }
    }
  }
  if (entidades.includes('vehiculos')) {
    const { rows } = await db.query(`
      SELECT a.id AS a, b.id AS b FROM vehiculos a JOIN vehiculos b
        ON a.id < b.id AND a.modelo_id = b.modelo_id AND a.clave_normalizada = b.clave_normalizada
       AND a.anio_desde <= coalesce(b.anio_hasta, 9999) AND coalesce(a.anio_hasta, 9999) >= b.anio_desde`);
    for (const r of rows) await registrar('vehiculos', r.a, r.b, 1, 'misma descripción normalizada y años superpuestos');
  }
  if (entidades.includes('motores')) {
    const { rows } = await db.query(`
      SELECT a.id AS a, b.id AS b FROM motores a JOIN motores b
        ON a.id < b.id AND a.marca_id IS NOT DISTINCT FROM b.marca_id AND a.clave_normalizada = b.clave_normalizada`);
    for (const r of rows) await registrar('motores', r.a, r.b, 1, 'mismo motor escrito distinto');
  }
  return nuevos;
}

// ---------------------------------------------------------------- fusión
// Fusionar = pasar todas las relaciones del registro "eliminar" al registro "conservar" y borrar el primero.

async function fusionarVehiculos(db, conservar, eliminar) {
  await db.query(`
    INSERT INTO compatibilidades (producto_id, vehiculo_id, posicion, notas, fuente_id, fuente_url, importacion_id,
                                  importado_en, verificado_en, estado_verificacion, confianza)
    SELECT producto_id, $1, posicion, notas, fuente_id, fuente_url, importacion_id, importado_en, verificado_en,
           estado_verificacion, confianza
      FROM compatibilidades WHERE vehiculo_id = $2
    ON CONFLICT (producto_id, vehiculo_id) DO NOTHING`, [conservar, eliminar]);
  await db.query('UPDATE identificaciones_vehiculo SET vehiculo_id = $1 WHERE vehiculo_id = $2', [conservar, eliminar]);
  await db.query('DELETE FROM vehiculos WHERE id = $1', [eliminar]);
}

async function fusionarMotores(db, conservar, eliminar) {
  await db.query('UPDATE vehiculos SET motor_id = $1 WHERE motor_id = $2', [conservar, eliminar]);
  await db.query('DELETE FROM motores WHERE id = $1', [eliminar]);
}

async function fusionarModelos(db, conservar, eliminar) {
  const { rows: generaciones } = await db.query('SELECT id, nombre FROM generaciones WHERE modelo_id = $1', [eliminar]);
  for (const g of generaciones) {
    const { rows: [igual] } = await db.query('SELECT id FROM generaciones WHERE modelo_id = $1 AND nombre = $2', [conservar, g.nombre]);
    if (igual) {
      await db.query('UPDATE vehiculos SET generacion_id = $1 WHERE generacion_id = $2', [igual.id, g.id]);
      await db.query('DELETE FROM generaciones WHERE id = $1', [g.id]);
    } else {
      await db.query('UPDATE generaciones SET modelo_id = $1 WHERE id = $2', [conservar, g.id]);
    }
  }
  await db.query('UPDATE vehiculos SET modelo_id = $1 WHERE modelo_id = $2', [conservar, eliminar]);
  await db.query('DELETE FROM modelos_vehiculo WHERE id = $1', [eliminar]);
}

async function fusionarMarcas(db, conservar, eliminar) {
  const { rows: modelos } = await db.query('SELECT id, nombre FROM modelos_vehiculo WHERE marca_id = $1', [eliminar]);
  for (const m of modelos) {
    const { rows: [igual] } = await db.query(
      'SELECT id FROM modelos_vehiculo WHERE marca_id = $1 AND normalizar(nombre) = normalizar($2)', [conservar, m.nombre]);
    if (igual) await fusionarModelos(db, igual.id, m.id);
    else await db.query('UPDATE modelos_vehiculo SET marca_id = $1 WHERE id = $2', [conservar, m.id]);
  }
  const { rows: motores } = await db.query('SELECT id, nombre FROM motores WHERE marca_id = $1', [eliminar]);
  for (const m of motores) {
    const { rows: [igual] } = await db.query('SELECT id FROM motores WHERE marca_id = $1 AND nombre = $2', [conservar, m.nombre]);
    if (igual) await fusionarMotores(db, igual.id, m.id);
    else await db.query('UPDATE motores SET marca_id = $1 WHERE id = $2', [conservar, m.id]);
  }
  await db.query(`DELETE FROM oem_productos o WHERE marca_vehiculo_id = $2 AND EXISTS (
    SELECT 1 FROM oem_productos x WHERE x.producto_id = o.producto_id AND x.marca_vehiculo_id = $1 AND x.numero_oem = o.numero_oem)`,
  [conservar, eliminar]);
  await db.query('UPDATE oem_productos SET marca_vehiculo_id = $1 WHERE marca_vehiculo_id = $2', [conservar, eliminar]);
  await db.query('UPDATE vin_wmi SET marca_id = $1 WHERE marca_id = $2', [conservar, eliminar]);
  await db.query('DELETE FROM marcas_vehiculo WHERE id = $1', [eliminar]);
}

async function fusionarProductos(db, conservar, eliminar) {
  const { rowCount: ventas } = await db.query('SELECT 1 FROM pedido_items WHERE producto_id = $1 LIMIT 1', [eliminar]);
  if (ventas) {
    throw new ErrorApi(409, 'No se puede fusionar: el producto a eliminar tiene ventas registradas. Marcalo como DISCONTINUED.');
  }
  await db.query(`
    INSERT INTO compatibilidades (producto_id, vehiculo_id, posicion, notas, fuente_id, fuente_url, importacion_id,
                                  importado_en, verificado_en, estado_verificacion, confianza)
    SELECT $1, vehiculo_id, posicion, notas, fuente_id, fuente_url, importacion_id, importado_en, verificado_en,
           estado_verificacion, confianza FROM compatibilidades WHERE producto_id = $2
    ON CONFLICT (producto_id, vehiculo_id) DO NOTHING`, [conservar, eliminar]);
  await db.query(`
    INSERT INTO oem_productos (producto_id, marca_vehiculo_id, numero_oem, fuente_id, fuente_url, estado_verificacion, confianza)
    SELECT $1, marca_vehiculo_id, numero_oem, fuente_id, fuente_url, estado_verificacion, confianza
      FROM oem_productos WHERE producto_id = $2 ON CONFLICT DO NOTHING`, [conservar, eliminar]);
  await db.query(`
    INSERT INTO equivalencias (producto_id, marca_repuesto_id, numero_pieza, producto_equivalente_id, tipo, fuente_id, fuente_url, estado_verificacion, confianza)
    SELECT $1, marca_repuesto_id, numero_pieza, producto_equivalente_id, tipo, fuente_id, fuente_url, estado_verificacion, confianza
      FROM equivalencias WHERE producto_id = $2 ON CONFLICT DO NOTHING`, [conservar, eliminar]);
  await db.query('UPDATE equivalencias SET producto_equivalente_id = $1 WHERE producto_equivalente_id = $2', [conservar, eliminar]);
  await db.query(`UPDATE productos_proveedor SET producto_id = $1 WHERE producto_id = $2
                    AND NOT EXISTS (SELECT 1 FROM productos_proveedor x WHERE x.producto_id = $1 AND x.proveedor_id = productos_proveedor.proveedor_id)`,
  [conservar, eliminar]);
  await db.query(`UPDATE publicaciones SET producto_id = $1 WHERE producto_id = $2
                    AND NOT EXISTS (SELECT 1 FROM publicaciones x WHERE x.producto_id = $1 AND x.vendedor_id = publicaciones.vendedor_id
                                    AND x.condicion = publicaciones.condicion)`, [conservar, eliminar]);
  const { rowCount: quedan } = await db.query('SELECT 1 FROM publicaciones WHERE producto_id = $1', [eliminar]);
  if (quedan) {
    throw new ErrorApi(409, 'No se puede fusionar: los dos productos tienen publicaciones del mismo vendedor. Pausá una de ellas primero.');
  }
  await db.query('DELETE FROM productos WHERE id = $1', [eliminar]);
}

async function fusionarMarcasRepuesto(db, conservar, eliminar) {
  const { rows } = await db.query(`
    SELECT p.id, q.id AS existente FROM productos p
      LEFT JOIN productos q ON q.marca_repuesto_id = $1 AND q.numero_normalizado = p.numero_normalizado
     WHERE p.marca_repuesto_id = $2`, [conservar, eliminar]);
  for (const p of rows) {
    if (p.existente) await fusionarProductos(db, p.existente, p.id);
    else await db.query('UPDATE productos SET marca_repuesto_id = $1 WHERE id = $2', [conservar, p.id]);
  }
  await db.query(`DELETE FROM equivalencias e WHERE marca_repuesto_id = $2 AND EXISTS (
    SELECT 1 FROM equivalencias x WHERE x.producto_id = e.producto_id AND x.marca_repuesto_id = $1 AND x.numero_pieza = e.numero_pieza)`,
  [conservar, eliminar]);
  await db.query('UPDATE equivalencias SET marca_repuesto_id = $1 WHERE marca_repuesto_id = $2', [conservar, eliminar]);
  await db.query('DELETE FROM marcas_repuesto WHERE id = $1', [eliminar]);
}

const FUSIONES = {
  marcas: fusionarMarcas,
  modelos: fusionarModelos,
  vehiculos: fusionarVehiculos,
  motores: fusionarMotores,
  productos: fusionarProductos,
  marcas_repuesto: fusionarMarcasRepuesto,
};

export async function fusionar(db, entidad, conservarId, eliminarId) {
  const f = FUSIONES[entidad];
  if (!f) throw new ErrorApi(400, `La entidad "${entidad}" no admite fusión.`);
  if (Number(conservarId) === Number(eliminarId)) throw new ErrorApi(400, 'No se puede fusionar un registro consigo mismo.');
  await f(db, Number(conservarId), Number(eliminarId));
}

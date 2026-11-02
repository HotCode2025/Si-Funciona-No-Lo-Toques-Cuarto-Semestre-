// Panel: relaciones de cada repuesto (compatibilidades, números OEM, equivalencias y códigos de proveedor).
// Todo lo que se carga a mano nace UNVERIFIED (o el estado que se elija, nunca VERIFIED sin fuente real).

import { ErrorApi } from '../errores.js';
import { POR_PAGINA } from './servicio.js';

async function fuenteDe(db, fuenteId) {
  if (fuenteId) {
    const { rows: [f] } = await db.query('SELECT * FROM fuentes WHERE id = $1', [fuenteId]);
    if (!f) throw new ErrorApi(400, 'La fuente indicada no existe.');
    return f;
  }
  const { rows: [f] } = await db.query(`
    INSERT INTO fuentes (slug, nombre, tipo, nivel_confianza, notas)
    VALUES ('manual', 'Carga manual (panel de administración)', 'manual', 'media',
            'Datos cargados a mano por un administrador. Indicá la URL de respaldo en cada registro cuando exista.')
    ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug RETURNING *`);
  return f;
}

function estadoInicial(estado, fuente) {
  const e = estado || 'UNVERIFIED';
  if (e === 'VERIFIED' && (fuente.tipo === 'demo' || fuente.tipo === 'manual')) {
    throw new ErrorApi(400, 'Para cargar un dato como VERIFIED elegí la fuente real (catálogo del fabricante, proveedor...) con la que lo confirmaste.');
  }
  return e;
}

async function productoExiste(db, id) {
  const { rows: [p] } = await db.query('SELECT id, universal FROM productos WHERE id = $1', [id]);
  if (!p) throw new ErrorApi(404, `No existe el repuesto #${id}.`);
  return p;
}

// ---------------------------------------------------------------- compatibilidades

/** Listado de compatibilidades con filtros (cola de revisión). */
export async function listarCompatibilidades(db, { producto, vehiculo, modelo, estado, fuente, pagina = 1 }) {
  const params = [];
  const where = [];
  const agregar = (sql, valor) => { params.push(valor); where.push(sql.replace('$?', `$${params.length}`)); };
  if (producto) agregar('c.producto_id = $?', Number(producto));
  if (vehiculo) agregar('c.vehiculo_id = $?', Number(vehiculo));
  if (modelo) agregar('v.modelo_id = $?', Number(modelo));
  if (estado) agregar('c.estado_verificacion = $?', estado);
  if (fuente) agregar('c.fuente_id = $?', Number(fuente));
  const condicion = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const desde = `compatibilidades c JOIN productos p ON p.id = c.producto_id JOIN marcas_repuesto mr ON mr.id = p.marca_repuesto_id
                 JOIN vehiculos v ON v.id = c.vehiculo_id JOIN modelos_vehiculo mo ON mo.id = v.modelo_id
                 JOIN marcas_vehiculo ma ON ma.id = mo.marca_id LEFT JOIN fuentes f ON f.id = c.fuente_id`;
  const offset = (Math.max(1, Number(pagina)) - 1) * POR_PAGINA;
  const [{ rows }, { rows: [{ total }] }] = await Promise.all([
    db.query(`
      SELECT c.producto_id || ':' || c.vehiculo_id AS id, c.producto_id, c.vehiculo_id, c.posicion, c.notas,
             c.estado_verificacion, c.confianza, c.fuente_url, c.actualizado_en, f.nombre AS fuente, f.tipo AS tipo_fuente,
             p.sku, p.nombre AS producto, mr.nombre AS marca_repuesto, p.numero_pieza,
             ma.nombre AS marca, mo.nombre AS modelo, v.version, v.anio_desde, v.anio_hasta, v.codigo AS codigo_vehiculo
        FROM ${desde} ${condicion}
       ORDER BY p.nombre, ma.nombre, mo.nombre, v.anio_desde, v.version LIMIT ${POR_PAGINA} OFFSET ${offset}`, params),
    db.query(`SELECT count(*) AS total FROM ${desde} ${condicion}`, params),
  ]);
  return { registros: rows, total, pagina: Number(pagina), paginas: Math.max(1, Math.ceil(total / POR_PAGINA)) };
}

/**
 * Agrega compatibilidades a un producto: por ids de versión, o por modelo + rango de años (todas las versiones
 * del modelo que se venden en esos años, opcionalmente filtradas por motor o combustible).
 */
export async function agregarCompatibilidades(db, productoId, cuerpo) {
  const producto = await productoExiste(db, productoId);
  if (producto.universal) throw new ErrorApi(400, 'El repuesto es universal: no necesita compatibilidades por vehículo.');
  const fuente = await fuenteDe(db, cuerpo.fuente_id);
  const estado = estadoInicial(cuerpo.estado_verificacion, fuente);

  let vehiculoIds = (cuerpo.vehiculo_ids || []).map(Number).filter(Boolean);
  if (!vehiculoIds.length && cuerpo.modelo_id) {
    const params = [Number(cuerpo.modelo_id)];
    const where = ['v.modelo_id = $1'];
    if (cuerpo.anio_desde) { params.push(cuerpo.anio_desde); where.push(`coalesce(v.anio_hasta, 9999) >= $${params.length}`); }
    if (cuerpo.anio_hasta) { params.push(cuerpo.anio_hasta); where.push(`v.anio_desde <= $${params.length}`); }
    if (cuerpo.motor_id) { params.push(Number(cuerpo.motor_id)); where.push(`v.motor_id = $${params.length}`); }
    if (cuerpo.combustible) { params.push(cuerpo.combustible); where.push(`v.combustible = $${params.length}`); }
    const { rows } = await db.query(`SELECT v.id FROM vehiculos v WHERE ${where.join(' AND ')}`, params);
    vehiculoIds = rows.map((r) => r.id);
  }
  if (!vehiculoIds.length) throw new ErrorApi(400, 'No hay versiones de vehículo que coincidan: elegí versiones o un modelo con años.');
  if (vehiculoIds.length > 5000) throw new ErrorApi(400, 'Son demasiadas versiones de una vez (máximo 5000).');

  const { rows } = await db.query(`
    INSERT INTO compatibilidades (producto_id, vehiculo_id, posicion, notas, fuente_id, fuente_url, estado_verificacion,
                                  confianza, importado_en, verificado_en)
    SELECT $1, v.id, $3, $4, $5, $6, $7, $8, now(), CASE WHEN $7 = 'VERIFIED' THEN now() END
      FROM vehiculos v WHERE v.id = ANY($2::int[])
    ON CONFLICT (producto_id, vehiculo_id) DO NOTHING RETURNING vehiculo_id`,
  [productoId, vehiculoIds, cuerpo.posicion || null, cuerpo.notas || null, fuente.id, cuerpo.fuente_url || null, estado,
    cuerpo.confianza || fuente.nivel_confianza]);
  return { agregadas: rows.length, ya_existian: vehiculoIds.length - rows.length, estado, fuente: fuente.nombre };
}

export async function quitarCompatibilidades(db, productoId, vehiculoIds) {
  const { rowCount } = await db.query(
    'DELETE FROM compatibilidades WHERE producto_id = $1 AND vehiculo_id = ANY($2::int[])', [productoId, vehiculoIds.map(Number)]);
  return { quitadas: rowCount };
}

// ---------------------------------------------------------------- OEM

export async function agregarOem(db, productoId, cuerpo) {
  await productoExiste(db, productoId);
  const fuente = await fuenteDe(db, cuerpo.fuente_id);
  const estado = estadoInicial(cuerpo.estado_verificacion, fuente);
  const numero = String(cuerpo.numero_oem || '').trim();
  if (!numero) throw new ErrorApi(400, 'Falta el número OEM.');
  const { rows: [existe] } = await db.query(
    'SELECT id FROM oem_productos WHERE producto_id = $1 AND marca_vehiculo_id = $2 AND numero_normalizado = normalizar_codigo($3)',
    [productoId, cuerpo.marca_vehiculo_id, numero]);
  if (existe) throw new ErrorApi(409, 'Ese número OEM ya está cargado para este repuesto.');
  const { rows: [oem] } = await db.query(`
    INSERT INTO oem_productos (producto_id, marca_vehiculo_id, numero_oem, fuente_id, fuente_url, estado_verificacion, confianza, importado_en)
    VALUES ($1, $2, $3, $4, $5, $6, $7, now()) RETURNING *`,
  [productoId, cuerpo.marca_vehiculo_id, numero, fuente.id, cuerpo.fuente_url || null, estado, cuerpo.confianza || fuente.nivel_confianza]);
  return oem;
}

export async function quitarOem(db, productoId, oemId) {
  const { rowCount } = await db.query('DELETE FROM oem_productos WHERE id = $1 AND producto_id = $2', [oemId, productoId]);
  if (!rowCount) throw new ErrorApi(404, 'No existe ese número OEM en este repuesto.');
}

// ---------------------------------------------------------------- equivalencias

export async function agregarEquivalencia(db, productoId, cuerpo) {
  await productoExiste(db, productoId);
  const fuente = await fuenteDe(db, cuerpo.fuente_id);
  const estado = estadoInicial(cuerpo.estado_verificacion, fuente);
  const numero = String(cuerpo.numero_pieza || '').trim();
  if (!numero) throw new ErrorApi(400, 'Falta el número de pieza equivalente.');
  // Si el equivalente ya existe en el catálogo, se enlaza
  const { rows: [equivalente] } = await db.query(
    'SELECT id FROM productos WHERE marca_repuesto_id = $1 AND numero_normalizado = normalizar_codigo($2) AND id <> $3',
    [cuerpo.marca_repuesto_id, numero, productoId]);
  const { rows: [eq] } = await db.query(`
    INSERT INTO equivalencias (producto_id, marca_repuesto_id, numero_pieza, producto_equivalente_id, tipo,
                               fuente_id, fuente_url, estado_verificacion, confianza, importado_en)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
    ON CONFLICT (producto_id, marca_repuesto_id, numero_pieza) DO NOTHING RETURNING *`,
  [productoId, cuerpo.marca_repuesto_id, numero, equivalente?.id ?? null, cuerpo.tipo || 'equivalente', fuente.id,
    cuerpo.fuente_url || null, estado, cuerpo.confianza || fuente.nivel_confianza]);
  if (!eq) throw new ErrorApi(409, 'Esa equivalencia ya está cargada.');
  return eq;
}

export async function quitarEquivalencia(db, productoId, eqId) {
  const { rowCount } = await db.query('DELETE FROM equivalencias WHERE id = $1 AND producto_id = $2', [eqId, productoId]);
  if (!rowCount) throw new ErrorApi(404, 'No existe esa equivalencia en este repuesto.');
}

// ---------------------------------------------------------------- códigos de proveedor

export async function agregarCodigoProveedor(db, productoId, { proveedor_id: proveedorId, codigo_proveedor: codigo }) {
  await productoExiste(db, productoId);
  if (!codigo) throw new ErrorApi(400, 'Falta el código del proveedor.');
  const { rows: [r] } = await db.query(`
    INSERT INTO productos_proveedor (proveedor_id, producto_id, codigo_proveedor) VALUES ($1, $2, $3)
    ON CONFLICT (proveedor_id, codigo_proveedor) DO NOTHING RETURNING *`, [proveedorId, productoId, codigo]);
  if (!r) throw new ErrorApi(409, 'Ese código ya está asignado a un producto de este proveedor.');
  return r;
}

export async function quitarCodigoProveedor(db, productoId, id) {
  const { rowCount } = await db.query('DELETE FROM productos_proveedor WHERE id = $1 AND producto_id = $2', [id, productoId]);
  if (!rowCount) throw new ErrorApi(404, 'No existe ese código de proveedor en este repuesto.');
}

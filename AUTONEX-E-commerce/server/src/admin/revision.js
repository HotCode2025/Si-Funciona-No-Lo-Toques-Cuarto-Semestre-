// Panel: resumen del catálogo, historial de importaciones y revisión de posibles duplicados.

import { ENTIDADES } from '../importacion/entidades.js';
import { importar } from '../importacion/importador.js';
import { escribirCsv } from '../importacion/csv.js';
import { fusionar } from '../catalogo/duplicados.js';
import { ErrorApi } from '../errores.js';
import { POR_PAGINA } from './servicio.js';

// ---------------------------------------------------------------- resumen

const TABLAS_RESUMEN = {
  marcas: 'marcas_vehiculo', modelos: 'modelos_vehiculo', generaciones: 'generaciones', motores: 'motores',
  vehiculos: 'vehiculos', marcas_repuesto: 'marcas_repuesto', productos: 'productos',
  compatibilidades: 'compatibilidades', oem: 'oem_productos', equivalencias: 'equivalencias',
};

export async function resumen(db) {
  const porEstado = {};
  await Promise.all(Object.entries(TABLAS_RESUMEN).map(async ([entidad, tabla]) => {
    const { rows } = await db.query(`SELECT estado_verificacion AS estado, count(*) AS n FROM ${tabla} GROUP BY 1`);
    porEstado[entidad] = { total: rows.reduce((s, r) => s + r.n, 0), ...Object.fromEntries(rows.map((r) => [r.estado, r.n])) };
  }));
  const [fuentes, importaciones, duplicados, extras] = await Promise.all([
    db.query(`
      SELECT f.id, f.nombre, f.tipo, f.licencia, f.nivel_confianza,
             f.terminos_revisados AND f.licencia_verificada AS checklist_ok,
             (SELECT count(*) FROM vehiculos WHERE fuente_id = f.id) AS vehiculos,
             (SELECT count(*) FROM productos WHERE fuente_id = f.id) AS productos,
             (SELECT count(*) FROM compatibilidades WHERE fuente_id = f.id) AS compatibilidades
        FROM fuentes f ORDER BY f.nombre`),
    db.query(`
      SELECT i.id, i.entidad, i.estado, i.archivo, i.filas_total, i.filas_creadas, i.filas_actualizadas, i.filas_error,
             i.filas_duplicadas, i.iniciada_en, i.solo_validacion, f.nombre AS fuente
        FROM importaciones i LEFT JOIN fuentes f ON f.id = i.fuente_id ORDER BY i.id DESC LIMIT 5`),
    db.query(`SELECT entidad, count(*) AS n FROM posibles_duplicados WHERE estado = 'pendiente' GROUP BY 1`),
    db.query(`
      SELECT (SELECT count(*) FROM productos p WHERE NOT p.universal
                AND NOT EXISTS (SELECT 1 FROM compatibilidades c WHERE c.producto_id = p.id)) AS productos_sin_compatibilidad,
             (SELECT count(*) FROM marcas_vehiculo ma WHERE NOT EXISTS (SELECT 1 FROM modelos_vehiculo m WHERE m.marca_id = ma.id)) AS marcas_sin_modelos,
             (SELECT count(*) FROM modelos_vehiculo mo WHERE NOT EXISTS (SELECT 1 FROM vehiculos v WHERE v.modelo_id = mo.id)) AS modelos_sin_versiones,
             (SELECT count(*) FROM productos p WHERE p.fuente_id IS NULL) AS productos_sin_fuente,
             (SELECT count(*) FROM fuentes WHERE NOT (terminos_revisados AND licencia_verificada)) AS fuentes_sin_revisar`),
  ]);
  return {
    por_estado: porEstado,
    fuentes: fuentes.rows,
    ultimas_importaciones: importaciones.rows,
    duplicados_pendientes: Object.fromEntries(duplicados.rows.map((r) => [r.entidad, r.n])),
    alertas: extras.rows[0],
  };
}

// ---------------------------------------------------------------- importaciones

/** Entidades importables con sus columnas (para plantillas y ayuda en pantalla). */
export function entidadesImportables() {
  return Object.entries(ENTIDADES).map(([clave, def]) => ({
    entidad: clave,
    titulo: def.titulo,
    descripcion: def.descripcion || null,
    columnas: def.campos.map((c) => ({
      nombre: c.nombre, etiqueta: c.etiqueta, tipo: c.tipo, requerido: Boolean(c.requerido),
      lista: c.lista || null, alias: c.alias || [],
    })),
    admite_columnas_extra: Boolean(def.columnasExtra),
  }));
}

/** Plantilla CSV: solo la cabecera (los datos los aporta la fuente; no se incluyen ejemplos inventados). */
export function plantilla(entidad) {
  const def = ENTIDADES[entidad];
  if (!def) throw new ErrorApi(404, `No hay plantilla para "${entidad}".`);
  return escribirCsv([], def.campos.map((c) => c.nombre));
}

export async function listarImportaciones(db, { pagina = 1, entidad, estado }) {
  const params = [];
  const where = [];
  if (entidad) { params.push(entidad); where.push(`i.entidad = $${params.length}`); }
  if (estado) { params.push(estado); where.push(`i.estado = $${params.length}`); }
  const condicion = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (Math.max(1, Number(pagina)) - 1) * POR_PAGINA;
  const [{ rows }, { rows: [{ total }] }] = await Promise.all([
    db.query(`
      SELECT i.id, i.entidad, i.formato, i.archivo, i.estado, i.solo_validacion, i.filas_total, i.filas_creadas,
             i.filas_actualizadas, i.filas_sin_cambios, i.filas_duplicadas, i.filas_error, i.iniciada_en, i.finalizada_en,
             f.nombre AS fuente, pr.nombre AS proveedor, u.nombre || ' ' || u.apellido AS usuario
        FROM importaciones i LEFT JOIN fuentes f ON f.id = i.fuente_id LEFT JOIN proveedores pr ON pr.id = i.proveedor_id
        LEFT JOIN usuarios u ON u.id = i.usuario_id ${condicion}
       ORDER BY i.id DESC LIMIT ${POR_PAGINA} OFFSET ${offset}`, params),
    db.query(`SELECT count(*) AS total FROM importaciones i ${condicion}`, params),
  ]);
  return { registros: rows, total, pagina: Number(pagina), paginas: Math.max(1, Math.ceil(total / POR_PAGINA)) };
}

export async function obtenerImportacion(db, id, { paginaErrores = 1 } = {}) {
  const { rows: [imp] } = await db.query(`
    SELECT i.*, f.nombre AS fuente, f.slug AS fuente_slug, pr.nombre AS proveedor
      FROM importaciones i LEFT JOIN fuentes f ON f.id = i.fuente_id LEFT JOIN proveedores pr ON pr.id = i.proveedor_id
     WHERE i.id = $1`, [id]);
  if (!imp) throw new ErrorApi(404, `No existe la importación #${id}.`);
  const offset = (Math.max(1, Number(paginaErrores)) - 1) * POR_PAGINA;
  const { rows: errores } = await db.query(
    `SELECT fila, campo, mensaje, datos FROM importacion_errores WHERE importacion_id = $1 ORDER BY fila, id LIMIT ${POR_PAGINA} OFFSET ${offset}`, [id]);
  const { rows: [{ total }] } = await db.query('SELECT count(*) AS total FROM importacion_errores WHERE importacion_id = $1', [id]);
  return { importacion: imp, errores, errores_total: total, errores_paginas: Math.max(1, Math.ceil(total / POR_PAGINA)) };
}

/** CSV con las filas que fallaron + columna "error", para corregir y volver a importar. */
export async function erroresCsv(db, id) {
  const { rows } = await db.query(
    'SELECT fila, campo, mensaje, datos FROM importacion_errores WHERE importacion_id = $1 ORDER BY fila, id', [id]);
  const filas = rows.map((r) => ({ fila: r.fila, error: r.mensaje, campo_con_error: r.campo || '', ...(r.datos || {}) }));
  return escribirCsv(filas);
}

// ---------------------------------------------------------------- duplicados

const TABLAS_DUPLICADOS = {
  marcas: { tabla: 'marcas_vehiculo', etiqueta: 't.nombre', desde: 'marcas_vehiculo t' },
  modelos: {
    tabla: 'modelos_vehiculo', desde: 'modelos_vehiculo t JOIN marcas_vehiculo ma ON ma.id = t.marca_id',
    etiqueta: "ma.nombre || ' ' || t.nombre",
  },
  generaciones: {
    tabla: 'generaciones', desde: 'generaciones t JOIN modelos_vehiculo mo ON mo.id = t.modelo_id',
    etiqueta: "mo.nombre || ' · ' || t.nombre",
  },
  vehiculos: {
    tabla: 'vehiculos', desde: 'vehiculos t JOIN modelos_vehiculo mo ON mo.id = t.modelo_id JOIN marcas_vehiculo ma ON ma.id = mo.marca_id',
    etiqueta: "ma.nombre || ' ' || mo.nombre || ' ' || t.version || ' (' || t.anio_desde || coalesce('-' || t.anio_hasta, '') || ') · ' || t.codigo",
  },
  motores: { tabla: 'motores', desde: 'motores t LEFT JOIN marcas_vehiculo ma ON ma.id = t.marca_id', etiqueta: "coalesce(ma.nombre || ' ', '') || t.nombre" },
  marcas_repuesto: { tabla: 'marcas_repuesto', desde: 'marcas_repuesto t', etiqueta: 't.nombre' },
  productos: {
    tabla: 'productos', desde: 'productos t JOIN marcas_repuesto mr ON mr.id = t.marca_repuesto_id',
    etiqueta: "mr.nombre || ' ' || t.numero_pieza || ' · ' || t.nombre",
  },
};

async function describir(db, entidad, id) {
  const cfg = TABLAS_DUPLICADOS[entidad];
  if (!cfg || !id) return null;
  const { rows: [r] } = await db.query(`
    SELECT t.id, ${cfg.etiqueta} AS etiqueta, ${['marcas', 'modelos', 'vehiculos', 'motores', 'marcas_repuesto', 'productos', 'generaciones'].includes(entidad) ? 't.estado_verificacion, (SELECT nombre FROM fuentes WHERE id = t.fuente_id) AS fuente' : 'NULL AS estado_verificacion, NULL AS fuente'}
      FROM ${cfg.desde} WHERE t.id = $1`, [id]);
  return r || { id, etiqueta: `#${id} (ya no existe)`, eliminado: true };
}

export async function listarDuplicados(db, { estado = 'pendiente', entidad, pagina = 1 }) {
  const params = [estado];
  let filtro = '';
  if (entidad) { params.push(entidad); filtro = `AND d.entidad = $${params.length}`; }
  const offset = (Math.max(1, Number(pagina)) - 1) * POR_PAGINA;
  const [{ rows }, { rows: [{ total }] }] = await Promise.all([
    db.query(`
      SELECT d.*, i.archivo, f.nombre AS fuente_importacion
        FROM posibles_duplicados d LEFT JOIN importaciones i ON i.id = d.importacion_id LEFT JOIN fuentes f ON f.id = i.fuente_id
       WHERE d.estado = $1 ${filtro} ORDER BY d.similitud DESC NULLS LAST, d.id LIMIT ${POR_PAGINA} OFFSET ${offset}`, params),
    db.query(`SELECT count(*) AS total FROM posibles_duplicados d WHERE d.estado = $1 ${filtro}`, params),
  ]);
  for (const d of rows) {
    d.existente = await describir(db, d.entidad, d.registro_id);
    d.otro = d.duplicado_id ? await describir(db, d.entidad, d.duplicado_id) : null;
  }
  return { registros: rows, total, pagina: Number(pagina), paginas: Math.max(1, Math.ceil(total / POR_PAGINA)) };
}

/**
 * Resuelve un posible duplicado.
 *   accion "fusionar": son el mismo. Con dos registros existentes se conserva `conservar` (id) y se pasan todas las
 *                      relaciones del otro. Con una fila retenida de una importación, se usa el registro existente.
 *   accion "descartar": no son el mismo; se deja todo como está.
 *   accion "crear": (solo filas retenidas) no son el mismo: se importa la fila creando el registro nuevo.
 */
export async function resolverDuplicado(pool, db, id, { accion, conservar }, usuarioId) {
  const { rows: [d] } = await db.query('SELECT * FROM posibles_duplicados WHERE id = $1 FOR UPDATE', [id]);
  if (!d) throw new ErrorApi(404, `No existe el posible duplicado #${id}.`);
  if (d.estado !== 'pendiente') throw new ErrorApi(409, `Este caso ya fue resuelto (${d.estado}).`);

  let resultado = {};
  let estado;
  if (accion === 'descartar') {
    estado = 'descartado';
  } else if (accion === 'fusionar') {
    if (d.duplicado_id) {
      const conservarId = Number(conservar) || d.registro_id;
      if (![d.registro_id, d.duplicado_id].includes(conservarId)) throw new ErrorApi(400, 'El registro a conservar tiene que ser uno de los dos.');
      const eliminarId = conservarId === d.registro_id ? d.duplicado_id : d.registro_id;
      await fusionar(db, d.entidad, conservarId, eliminarId);
      // Otros casos pendientes que apuntaban al eliminado pasan al conservado
      await db.query(`UPDATE posibles_duplicados SET registro_id = $1 WHERE registro_id = $2 AND estado = 'pendiente' AND id <> $3`, [conservarId, eliminarId, id]);
      await db.query(`UPDATE posibles_duplicados SET estado = 'descartado', resuelto_en = now(), resuelto_por = $3
                       WHERE duplicado_id = $1 AND estado = 'pendiente' AND id <> $2`, [eliminarId, id, usuarioId]);
      resultado = { conservado: conservarId, eliminado: eliminarId };
    } else {
      resultado = { conservado: d.registro_id, nota: 'Se usa el registro existente; la fila importada no se crea.' };
    }
    estado = 'fusionado';
  } else if (accion === 'crear') {
    if (!d.datos_nuevos) throw new ErrorApi(400, '"Crear igual" solo aplica a filas retenidas de una importación.');
    const { rows: [imp] } = await db.query('SELECT fuente_id, proveedor_id, opciones FROM importaciones WHERE id = $1', [d.importacion_id]);
    if (!imp?.fuente_id) throw new ErrorApi(409, 'No se encontró la fuente de la importación original.');
    resultado = await importar(pool, {
      entidad: d.datos_nuevos.entidad_importada, filas: [d.datos_nuevos.datos], fuente: imp.fuente_id,
      proveedorId: imp.proveedor_id, formato: 'json', archivo: `duplicado #${id}`, usuarioId,
      opciones: { ...imp.opciones, crearDuplicados: true },
    });
    if (resultado.error) {
      throw new ErrorApi(400, `La fila no se pudo importar: ${resultado.primeros_errores[0]?.mensaje}`, { importacion: resultado });
    }
    estado = 'creado';
  } else {
    throw new ErrorApi(400, 'Acción inválida: fusionar, descartar o crear.');
  }
  await db.query('UPDATE posibles_duplicados SET estado = $2, resuelto_por = $3, resuelto_en = now() WHERE id = $1', [id, estado, usuarioId]);
  return { id, estado, ...resultado };
}

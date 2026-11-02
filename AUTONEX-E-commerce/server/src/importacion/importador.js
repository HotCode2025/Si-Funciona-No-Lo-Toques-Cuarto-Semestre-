// Orquestador de importaciones: valida, guarda con trazabilidad, registra errores por fila y posibles duplicados.
//
//   const resumen = await importar(pool, { entidad: 'vehiculos', filas, fuente: 'dnrpa', formato: 'csv' });
//
// Las filas se guardan por lotes dentro de un SAVEPOINT; si una falla, se deshace solo esa fila y el resto sigue.
// Con soloValidar: true se procesa todo igual pero al final se hace ROLLBACK (vista previa).

import { ENTIDADES, ErrorFila, indiceCabeceras } from './entidades.js';
import { ErrorCampo, convertir } from './campos.js';
import { Duplicado, registrarDuplicado } from '../catalogo/duplicados.js';
import { recalcularMarcas, recalcularModelos } from '../catalogo/agregados.js';
import { ErrorApi } from '../errores.js';

export const MAX_FILAS = 200000;

async function resolverFuente(db, fuente) {
  if (!fuente) throw new ErrorApi(400, 'Toda importación necesita una fuente (regla de trazabilidad).');
  const { rows: [f] } = await db.query(
    'SELECT * FROM fuentes WHERE id::text = $1 OR slug = $1', [String(fuente)]);
  if (!f) throw new ErrorApi(400, `No existe la fuente "${fuente}". Creala primero en el panel (Fuentes).`);
  return f;
}

function mapearFila(def, cruda, indice, clave) {
  const fila = {};
  const extra = {};
  for (const [columna, valor] of Object.entries(cruda)) {
    const campo = indice.get(clave(columna));
    if (campo) {
      if (fila[campo.nombre] === undefined || fila[campo.nombre] === '') fila[campo.nombre] = valor;
    } else if (def.columnasExtra && valor !== '' && valor !== null && valor !== undefined) {
      extra[columna] = valor;
    }
  }
  const resultado = {};
  for (const c of def.campos) resultado[c.nombre] = convertir(c, fila[c.nombre]);
  if (def.columnasExtra) resultado[def.columnasExtra] = extra;
  return resultado;
}

export function columnasIgnoradas(def, filas) {
  if (!filas.length || def.columnasExtra) return [];
  const { indice, clave } = indiceCabeceras(def);
  return Object.keys(filas[0]).filter((c) => !indice.has(clave(c)));
}

/**
 * @param {import('pg').Pool} pool
 * @param {object} p
 * @param {string} p.entidad         una de ENTIDADES
 * @param {object[]} p.filas         filas ya leídas del archivo
 * @param {string|number} p.fuente   id o slug de la fuente (obligatoria)
 * @param {number} [p.proveedorId]
 * @param {string} p.formato         csv | excel | json | api
 * @param {string} [p.archivo]
 * @param {boolean} [p.soloValidar]
 * @param {number} [p.usuarioId]
 * @param {object} [p.opciones]      { estadoPorDefecto, confianzaPorDefecto, crearDuplicados, marcarDuplicados }
 *   crearDuplicados: no busca parecidos · marcarDuplicados: crea la fila parecida y la deja pendiente de revisión
 *   (sin ninguna de las dos, la fila parecida se retiene sin crear)
 */
export async function importar(pool, { entidad, filas, fuente, proveedorId = null, formato, archivo = null, soloValidar = false, usuarioId = null, opciones = {}, log = null }) {
  const def = ENTIDADES[entidad];
  if (!def) throw new ErrorApi(400, `No se puede importar "${entidad}". Opciones: ${Object.keys(ENTIDADES).join(', ')}.`);
  if (!Array.isArray(filas) || !filas.length) throw new ErrorApi(400, 'No hay filas para importar.');
  if (filas.length > MAX_FILAS) throw new ErrorApi(400, `Se pueden importar hasta ${MAX_FILAS} filas por archivo.`);

  const fuenteRow = await resolverFuente(pool, fuente);
  const { rows: [proveedor] } = proveedorId
    ? await pool.query('SELECT * FROM proveedores WHERE id = $1', [proveedorId]) : { rows: [] };
  const { rows: [imp] } = await pool.query(`
    INSERT INTO importaciones (fuente_id, proveedor_id, entidad, formato, archivo, solo_validacion, opciones, usuario_id, filas_total)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, iniciada_en`,
  [fuenteRow.id, proveedor?.id ?? null, entidad, formato, archivo, soloValidar, opciones, usuarioId, filas.length]);

  const { indice, clave } = indiceCabeceras(def);
  const errores = [];
  const duplicados = [];
  const notas = new Map();
  const conteo = { creado: 0, actualizado: 0, sin_cambios: 0, duplicado: 0, error: 0 };
  const creadosPorEntidad = {};

  // 1) Conversión y validación de columnas (sin tocar la base)
  const items = [];
  for (const [i, cruda] of filas.entries()) {
    const numero = i + 2; // la fila 1 es la cabecera
    try {
      items.push({ numero, cruda, fila: mapearFila(def, cruda, indice, clave) });
    } catch (e) {
      if (!(e instanceof ErrorCampo)) throw e;
      errores.push({ fila: numero, campo: e.campo, mensaje: e.message, datos: cruda });
      conteo.error++;
    }
  }

  // Lo que hace una fila (o un lote) se acumula en "delta" y se confirma solo si no falló.
  let delta = { creados: {}, conteo: {}, notas: [] };
  const db = await pool.connect();
  const ctx = {
    db, fuente: fuenteRow, proveedor, importacionId: soloValidar ? null : imp.id, ahora: new Date(), opciones,
    cache: new Map(), cachePendiente: new Map(), modelosTocados: new Set(), marcasTocadas: new Set(),
    contar: (ent, accion) => { if (accion === 'creado') delta.creados[ent] = (delta.creados[ent] || 0) + 1; },
    contados: (ent) => (creadosPorEntidad[ent] || 0) + (delta.creados[ent] || 0),
    nota: (texto) => delta.notas.push(texto),
  };
  const anotar = (r) => {
    delta.conteo[r.accion] = (delta.conteo[r.accion] || 0) + 1;
    if (r.accion === 'creado') ctx.contar(entidad, 'creado');
    if (r.nota) delta.notas.push(r.nota);
  };
  const confirmar = () => {
    for (const [k, v] of Object.entries(delta.creados)) creadosPorEntidad[k] = (creadosPorEntidad[k] || 0) + v;
    for (const [k, v] of Object.entries(delta.conteo)) conteo[k] = (conteo[k] || 0) + v;
    for (const n of delta.notas) notas.set(n, (notas.get(n) || 0) + 1);
    for (const [k, v] of ctx.cachePendiente) ctx.cache.set(k, v);
    ctx.cachePendiente.clear();
    delta = { creados: {}, conteo: {}, notas: [] };
  };
  const descartar = () => {
    ctx.cachePendiente.clear();
    delta = { creados: {}, conteo: {}, notas: [] };
  };

  async function manejarError(e, item) {
    if (e instanceof Duplicado) {
      conteo.duplicado++;
      duplicados.push({ fila: item.numero, entidad: e.entidad, registro_id: e.registroId, existente: e.nombreExistente, motivo: e.motivo, similitud: e.similitud });
      if (!soloValidar) {
        await registrarDuplicado(db, {
          entidad: e.entidad, registroId: e.registroId, datosNuevos: { entidad_importada: entidad, fila: item.numero, datos: item.cruda },
          importacionId: imp.id, similitud: e.similitud, motivo: e.motivo,
        });
      }
    } else if (e instanceof ErrorFila || e instanceof ErrorCampo || ['23505', '23503', '23514', '22001', '22003'].includes(e.code)) {
      errores.push({ fila: item.numero, campo: e.campo || null, mensaje: traducirErrorBase(e), datos: item.cruda });
      conteo.error++;
    } else {
      throw e;
    }
  }

  // 2) Guardado por lotes. Un SAVEPOINT por fila haría miles de subtransacciones (PostgreSQL se vuelve muy lento
  //    pasadas las 64), así que se usa uno por lote; si algo falla, ese lote se rehace fila por fila.
  const LOTE = 250;
  try {
    await db.query('BEGIN');
    for (let i = 0; i < items.length; i += LOTE) {
      const lote = items.slice(i, i + LOTE);
      await db.query('SAVEPOINT lote');
      let fallo = false;
      try {
        for (const item of lote) anotar(await def.procesar(ctx, item.fila, item.numero));
        await db.query('RELEASE SAVEPOINT lote');
        confirmar();
      } catch {
        await db.query('ROLLBACK TO SAVEPOINT lote');
        descartar();
        fallo = true;
      }
      if (fallo) {
        for (const item of lote) {
          await db.query('SAVEPOINT fila');
          try {
            anotar(await def.procesar(ctx, item.fila, item.numero));
            await db.query('RELEASE SAVEPOINT fila');
            confirmar();
          } catch (e) {
            await db.query('ROLLBACK TO SAVEPOINT fila');
            descartar();
            await manejarError(e, item);
          }
        }
        await db.query('RELEASE SAVEPOINT lote');
      }
      if (log && Math.floor((i + LOTE) / 2000) > Math.floor(i / 2000)) log(`  ${Math.min(i + LOTE, items.length)} filas…`);
    }
    if (def.alFinalizar) await def.alFinalizar(ctx, { recalcularModelos, recalcularMarcas });
    await db.query(soloValidar ? 'ROLLBACK' : 'COMMIT');
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    await pool.query(`UPDATE importaciones SET estado = 'fallida', finalizada_en = now(), resumen = $2 WHERE id = $1`,
      [imp.id, { error: error.message }]);
    throw error;
  } finally {
    db.release();
  }

  // Los errores se guardan fuera de la transacción: quedan registrados también en la vista previa.
  for (let i = 0; i < errores.length; i += 500) {
    const lote = errores.slice(i, i + 500);
    await pool.query(`
      INSERT INTO importacion_errores (importacion_id, fila, campo, mensaje, datos)
      SELECT $1, (e->>'fila')::int, e->>'campo', e->>'mensaje', e->'datos' FROM jsonb_array_elements($2::jsonb) e`,
    [imp.id, JSON.stringify(lote)]);
  }

  const estado = soloValidar ? 'validada' : conteo.error || conteo.duplicado ? 'completada_con_errores' : 'completada';
  const resumen = {
    creados_por_entidad: creadosPorEntidad,
    columnas_ignoradas: columnasIgnoradas(def, filas),
    notas: Object.fromEntries(notas),
    duplicados: duplicados.slice(0, 200),
    primeros_errores: errores.slice(0, 50).map(({ fila, campo, mensaje }) => ({ fila, campo, mensaje })),
  };
  await pool.query(`
    UPDATE importaciones SET estado = $2, finalizada_en = now(), filas_creadas = $3, filas_actualizadas = $4,
           filas_sin_cambios = $5, filas_duplicadas = $6, filas_error = $7, resumen = $8 WHERE id = $1`,
  [imp.id, estado, conteo.creado, conteo.actualizado, conteo.sin_cambios, conteo.duplicado, conteo.error, resumen]);
  if (!soloValidar && proveedor) await pool.query('UPDATE proveedores SET ultima_importacion = now() WHERE id = $1', [proveedor.id]);

  return {
    importacion_id: imp.id, entidad, fuente: fuenteRow.nombre, solo_validacion: soloValidar, estado,
    filas: filas.length, ...conteo, ...resumen,
  };
}

function traducirErrorBase(e) {
  if (e.code === '23505') return `Dato repetido: ${e.detail || e.message}`;
  if (e.code === '23503') return `Referencia inexistente: ${e.detail || e.message}`;
  if (e.code === '23514') return `Valor fuera de lo permitido (${e.constraint || 'restricción'}).`;
  if (e.code === '22001') return 'Un texto supera el largo máximo permitido.';
  return e.message;
}

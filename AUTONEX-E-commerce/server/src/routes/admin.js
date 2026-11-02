import multipart from '@fastify/multipart';
import { pool, query, transaccion } from '../db.js';
import { ErrorApi } from '../errores.js';
import { leerArchivo } from '../importacion/lectores.js';
import { importar, MAX_FILAS } from '../importacion/importador.js';
import { ENTIDADES } from '../importacion/entidades.js';
import { escanearDuplicados } from '../catalogo/duplicados.js';
import {
  ESTADOS, actualizar, cambiarVerificacion, crear, eliminar, esquema, listar, obtener, opciones,
} from '../admin/servicio.js';
import {
  agregarCodigoProveedor, agregarCompatibilidades, agregarEquivalencia, agregarOem, listarCompatibilidades,
  quitarCodigoProveedor, quitarCompatibilidades, quitarEquivalencia, quitarOem,
} from '../admin/repuestos.js';
import {
  entidadesImportables, erroresCsv, listarDuplicados, listarImportaciones, obtenerImportacion, plantilla,
  resolverDuplicado, resumen,
} from '../admin/revision.js';

const MAX_ARCHIVO = 30 * 1024 * 1024;

const id = { type: 'integer', minimum: 1 };
const paramsId = { type: 'object', required: ['id'], properties: { id } };
const estado = { type: 'string', enum: ESTADOS };
const pagina = { type: 'integer', minimum: 1, default: 1 };
const traza = {
  fuente_id: id,
  fuente_url: { type: 'string', maxLength: 500, pattern: '^https?://' },
  estado_verificacion: estado,
  confianza: { type: 'string', enum: ['alta', 'media', 'baja'] },
};

/** Panel de administración del catálogo. Todas las rutas requieren rol admin. */
export default async function rutasAdmin(app) {
  await app.register(multipart, { limits: { fileSize: MAX_ARCHIVO, files: 1, fields: 20 } });
  app.addHook('onRequest', async (request) => {
    if (request.url.split('?')[0].includes('/admin')) await app.soloAdmin(request);
  });
  const usuario = (request) => request.user.id;

  // ---------------------------------------------------------------- resumen y esquema
  app.get('/admin/resumen', async () => resumen(pool));
  app.get('/admin/esquema', async () => ({ ...esquema(), estados: ESTADOS, importables: entidadesImportables(), max_filas: MAX_FILAS }));

  // ---------------------------------------------------------------- CRUD genérico
  const paramsEntidad = { type: 'object', required: ['entidad'], properties: { entidad: { type: 'string', maxLength: 40 } } };
  const paramsEntidadId = { type: 'object', required: ['entidad', 'id'], properties: { entidad: { type: 'string', maxLength: 40 }, id } };

  app.get('/admin/opciones/:entidad', {
    schema: { params: paramsEntidad, querystring: { type: 'object', properties: { q: { type: 'string', maxLength: 80 }, padre: id } } },
  }, async (request) => opciones(pool, request.params.entidad, request.query));

  app.get('/admin/datos/:entidad', {
    schema: {
      params: paramsEntidad,
      querystring: {
        type: 'object',
        properties: { q: { type: 'string', maxLength: 80 }, pagina, estado, fuente: id, padre: id, limite: { type: 'integer', minimum: 1, maximum: 200 } },
      },
    },
  }, async (request) => listar(pool, request.params.entidad, request.query));

  app.get('/admin/datos/:entidad/:id', { schema: { params: paramsEntidadId } },
    async (request) => obtener(pool, request.params.entidad, request.params.id));

  const cuerpoEdicion = {
    type: 'object',
    required: ['datos'],
    properties: {
      datos: { type: 'object' },
      limpiar: { type: 'array', items: { type: 'string', maxLength: 40 }, maxItems: 40 },
      confirmar_duplicado: { type: 'boolean' },
      ...traza,
    },
  };
  app.post('/admin/datos/:entidad', { schema: { params: paramsEntidad, body: cuerpoEdicion } }, async (request, reply) => {
    const registro = await transaccion((db) => crear(db, request.params.entidad, request.body, usuario(request)));
    return reply.status(201).send({ registro });
  });
  app.patch('/admin/datos/:entidad/:id', { schema: { params: paramsEntidadId, body: cuerpoEdicion } },
    async (request) => transaccion((db) => actualizar(db, request.params.entidad, request.params.id, request.body, usuario(request))));
  app.delete('/admin/datos/:entidad/:id', { schema: { params: paramsEntidadId } }, async (request) => {
    await transaccion((db) => eliminar(db, request.params.entidad, request.params.id));
    return { ok: true };
  });

  // ---------------------------------------------------------------- verificación
  app.post('/admin/verificacion', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['entidad', 'ids', 'estado'],
        properties: {
          entidad: { type: 'string', maxLength: 40 },
          // ids numéricos, o "producto:vehiculo" para compatibilidades
          ids: { type: 'array', minItems: 1, maxItems: 5000, items: { anyOf: [{ type: 'integer' }, { type: 'string', maxLength: 40 }] } },
          estado,
          fuente_id: id,
          fuente_url: traza.fuente_url,
          nota: { type: 'string', maxLength: 500 },
        },
      },
    },
  }, async (request) => transaccion((db) => cambiarVerificacion(db, request.body, usuario(request))));

  // ---------------------------------------------------------------- relaciones de un repuesto
  app.get('/admin/compatibilidades', {
    schema: { querystring: { type: 'object', properties: { producto: id, vehiculo: id, modelo: id, estado, fuente: id, pagina } } },
  }, async (request) => listarCompatibilidades(pool, request.query));

  app.post('/admin/productos/:id/compatibilidades', {
    schema: {
      params: paramsId,
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          vehiculo_ids: { type: 'array', items: id, maxItems: 5000 },
          modelo_id: id,
          anio_desde: { type: 'integer', minimum: 1900, maximum: 2100 },
          anio_hasta: { type: 'integer', minimum: 1900, maximum: 2100 },
          motor_id: id,
          combustible: { type: 'string', maxLength: 20 },
          posicion: { type: 'string', maxLength: 60 },
          notas: { type: 'string', maxLength: 500 },
          ...traza,
        },
      },
    },
  }, async (request) => transaccion((db) => agregarCompatibilidades(db, request.params.id, request.body)));

  app.post('/admin/productos/:id/compatibilidades/quitar', {
    schema: {
      params: paramsId,
      body: { type: 'object', required: ['vehiculo_ids'], properties: { vehiculo_ids: { type: 'array', minItems: 1, maxItems: 5000, items: id } } },
    },
  }, async (request) => transaccion((db) => quitarCompatibilidades(db, request.params.id, request.body.vehiculo_ids)));

  const paramsSub = { type: 'object', required: ['id', 'sub'], properties: { id, sub: id } };
  app.post('/admin/productos/:id/oem', {
    schema: {
      params: paramsId,
      body: {
        type: 'object', additionalProperties: false, required: ['marca_vehiculo_id', 'numero_oem'],
        properties: { marca_vehiculo_id: id, numero_oem: { type: 'string', minLength: 2, maxLength: 60 }, ...traza },
      },
    },
  }, async (request, reply) => reply.status(201).send(await transaccion((db) => agregarOem(db, request.params.id, request.body))));
  app.delete('/admin/productos/:id/oem/:sub', { schema: { params: paramsSub } }, async (request) => {
    await quitarOem(pool, request.params.id, request.params.sub);
    return { ok: true };
  });

  app.post('/admin/productos/:id/equivalencias', {
    schema: {
      params: paramsId,
      body: {
        type: 'object', additionalProperties: false, required: ['marca_repuesto_id', 'numero_pieza'],
        properties: {
          marca_repuesto_id: id, numero_pieza: { type: 'string', minLength: 2, maxLength: 60 },
          tipo: { type: 'string', enum: ['equivalente', 'reemplaza', 'reemplazado_por'] }, ...traza,
        },
      },
    },
  }, async (request, reply) => reply.status(201).send(await transaccion((db) => agregarEquivalencia(db, request.params.id, request.body))));
  app.delete('/admin/productos/:id/equivalencias/:sub', { schema: { params: paramsSub } }, async (request) => {
    await quitarEquivalencia(pool, request.params.id, request.params.sub);
    return { ok: true };
  });

  app.post('/admin/productos/:id/proveedores', {
    schema: {
      params: paramsId,
      body: {
        type: 'object', additionalProperties: false, required: ['proveedor_id', 'codigo_proveedor'],
        properties: { proveedor_id: id, codigo_proveedor: { type: 'string', minLength: 1, maxLength: 60 } },
      },
    },
  }, async (request, reply) => reply.status(201).send(await agregarCodigoProveedor(pool, request.params.id, request.body)));
  app.delete('/admin/productos/:id/proveedores/:sub', { schema: { params: paramsSub } }, async (request) => {
    await quitarCodigoProveedor(pool, request.params.id, request.params.sub);
    return { ok: true };
  });

  // ---------------------------------------------------------------- importaciones
  app.get('/admin/importaciones', {
    schema: { querystring: { type: 'object', properties: { pagina, entidad: { type: 'string', maxLength: 40 }, estado: { type: 'string', maxLength: 40 } } } },
  }, async (request) => listarImportaciones(pool, request.query));

  app.get('/admin/importaciones/:id', {
    schema: { params: paramsId, querystring: { type: 'object', properties: { pagina_errores: pagina } } },
  }, async (request) => obtenerImportacion(pool, request.params.id, { paginaErrores: request.query.pagina_errores }));

  app.get('/admin/importaciones/:id/errores.csv', { schema: { params: paramsId } }, async (request, reply) => {
    const csv = await erroresCsv(pool, request.params.id);
    return reply.header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="importacion-${request.params.id}-errores.csv"`)
      .send(`﻿${csv}`);
  });

  app.get('/admin/plantillas/:entidad', { schema: { params: paramsEntidad } }, async (request, reply) => {
    const entidad = request.params.entidad.replace(/\.csv$/, '');
    return reply.header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="plantilla-${entidad}.csv"`)
      .send(`﻿${plantilla(entidad)}`);
  });

  /**
   * Importa un archivo (multipart/form-data): campos entidad, fuente, proveedor_id, solo_validar, hoja,
   * estado_por_defecto, confianza_por_defecto, duplicados (retener | marcar | crear) y el archivo (CSV, Excel o JSON).
   */
  app.post('/admin/importaciones', async (request, reply) => {
    if (!request.isMultipart()) throw new ErrorApi(400, 'Enviá el archivo como multipart/form-data.');
    const campos = {};
    let archivo = null;
    for await (const parte of request.parts()) {
      if (parte.type === 'file') {
        archivo = { nombre: parte.filename, contenido: await parte.toBuffer() };
        if (parte.file.truncated) throw new ErrorApi(400, `El archivo supera el máximo de ${MAX_ARCHIVO / 1024 / 1024} MB.`);
      } else {
        campos[parte.fieldname] = String(parte.value ?? '').trim();
      }
    }
    if (!archivo) throw new ErrorApi(400, 'Falta el archivo a importar.');
    if (!ENTIDADES[campos.entidad]) throw new ErrorApi(400, `Elegí qué querés importar (${Object.keys(ENTIDADES).join(', ')}).`);
    if (!campos.fuente) throw new ErrorApi(400, 'Elegí la fuente de los datos: toda importación queda registrada con su origen.');
    if (campos.estado_por_defecto && !ESTADOS.includes(campos.estado_por_defecto)) throw new ErrorApi(400, 'Estado por defecto inválido.');
    if (campos.confianza_por_defecto && !['alta', 'media', 'baja'].includes(campos.confianza_por_defecto)) throw new ErrorApi(400, 'Confianza inválida.');
    if (campos.duplicados && !['retener', 'marcar', 'crear'].includes(campos.duplicados)) throw new ErrorApi(400, 'Opción de duplicados inválida (retener, marcar o crear).');

    const { formato, filas } = await leerArchivo({ contenido: archivo.contenido, nombre: archivo.nombre, formato: campos.formato, hoja: campos.hoja });
    const resultado = await importar(pool, {
      entidad: campos.entidad, filas, fuente: campos.fuente, formato, archivo: archivo.nombre,
      proveedorId: Number(campos.proveedor_id) || null,
      soloValidar: ['true', '1', 'si', 'on'].includes(campos.solo_validar),
      usuarioId: usuario(request),
      opciones: {
        estadoPorDefecto: campos.estado_por_defecto || undefined,
        confianzaPorDefecto: campos.confianza_por_defecto || undefined,
        // duplicados: retener (por defecto) | marcar (crear y dejar para revisión) | crear (sin buscar parecidos)
        crearDuplicados: campos.duplicados === 'crear',
        marcarDuplicados: campos.duplicados === 'marcar',
      },
    });
    return reply.status(resultado.solo_validacion ? 200 : 201).send(resultado);
  });

  /**
   * Importación por API (integraciones con proveedores): las filas viajan como JSON en el cuerpo y pasan por el
   * mismo flujo que un archivo: validar → normalizar → detectar duplicados → relacionar → verificar → guardar.
   */
  app.post('/admin/importaciones/api', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['entidad', 'fuente', 'filas'],
        properties: {
          entidad: { type: 'string', maxLength: 40 },
          fuente: { type: 'string', maxLength: 80 },
          proveedor_id: id,
          filas: { type: 'array', minItems: 1, maxItems: MAX_FILAS, items: { type: 'object' } },
          solo_validar: { type: 'boolean' },
          estado_por_defecto: estado,
          confianza_por_defecto: { type: 'string', enum: ['alta', 'media', 'baja'] },
          duplicados: { type: 'string', enum: ['retener', 'marcar', 'crear'] },
          referencia: { type: 'string', maxLength: 200 },
        },
      },
    },
  }, async (request, reply) => {
    const b = request.body;
    if (!ENTIDADES[b.entidad]) throw new ErrorApi(400, `Entidad inválida. Opciones: ${Object.keys(ENTIDADES).join(', ')}.`);
    const resultado = await importar(pool, {
      entidad: b.entidad, filas: b.filas, fuente: b.fuente, formato: 'api', archivo: b.referencia || 'API',
      proveedorId: b.proveedor_id || null, soloValidar: Boolean(b.solo_validar), usuarioId: usuario(request),
      opciones: {
        estadoPorDefecto: b.estado_por_defecto, confianzaPorDefecto: b.confianza_por_defecto,
        crearDuplicados: b.duplicados === 'crear', marcarDuplicados: b.duplicados === 'marcar',
      },
    });
    return reply.status(resultado.solo_validacion ? 200 : 201).send(resultado);
  });

  // ---------------------------------------------------------------- duplicados
  app.get('/admin/duplicados', {
    schema: {
      querystring: {
        type: 'object',
        properties: { estado: { type: 'string', enum: ['pendiente', 'fusionado', 'descartado', 'creado'], default: 'pendiente' }, entidad: { type: 'string', maxLength: 40 }, pagina },
      },
    },
  }, async (request) => listarDuplicados(pool, request.query));

  app.post('/admin/duplicados/escanear', {
    schema: { body: { type: 'object', properties: { entidades: { type: 'array', items: { type: 'string', enum: ['marcas', 'modelos', 'generaciones', 'vehiculos', 'motores', 'marcas_repuesto'] } } } } },
  }, async (request) => {
    const nuevos = await escanearDuplicados(pool, request.body?.entidades?.length ? request.body.entidades : undefined);
    return { nuevos };
  });

  app.post('/admin/duplicados/:id/resolver', {
    schema: {
      params: paramsId,
      body: {
        type: 'object', additionalProperties: false, required: ['accion'],
        properties: { accion: { type: 'string', enum: ['fusionar', 'descartar', 'crear'] }, conservar: id },
      },
    },
  }, async (request) => transaccion((db) => resolverDuplicado(pool, db, request.params.id, request.body, usuario(request))));

  // Fuentes resumidas para los selectores (sin paginar)
  app.get('/admin/fuentes-lista', async () => {
    const { rows } = await query(`SELECT id, slug, nombre, tipo, nivel_confianza, terminos_revisados, licencia_verificada,
                                         permite_uso_comercial, permite_redistribucion FROM fuentes ORDER BY nombre`);
    return rows;
  });
}

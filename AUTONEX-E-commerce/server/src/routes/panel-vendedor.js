import fs from 'node:fs';
import path from 'node:path';
import multipart from '@fastify/multipart';
import { query, transaccion } from '../db.js';
import { config } from '../config.js';
import {
  MAX_BYTES_FOTO, MAX_FOTOS_POR_PUBLICACION, guardarArchivo, leerImagenSubida, procesarFoto, procesarLogo, urlArchivo,
} from '../services/fotos.js';
import { ErrorApi } from '../errores.js';
import { id, paramsId, provincia, telefono, texto, textoOpcional } from '../esquemas.js';
import { claveNombre, slugificar } from '../catalogo/normalizacion.js';
import { leerHorarioTexto, esquemaHorarios, normalizarHorarios, textoHorarios } from '../horarios.js';
import { EN_MANOS_DEL_COMPRADOR, PEDIDO_REVOCABLE, arrepentimientoAbierto, reintentarReintegro, revocarPedido } from '../services/reintegros.js';

// Flujo de estados de un pedido. El paso después de "en preparación" depende de la forma de entrega.
const SIGUIENTE = {
  pagado: () => ['en_preparacion'],
  en_preparacion: (metodo) => [metodo === 'retiro' ? 'listo_para_retirar' : 'enviado'],
  enviado: () => ['entregado'],
  listo_para_retirar: () => ['entregado'],
};

export const ESTADOS_PEDIDO = ['pendiente_pago', 'pagado', 'en_preparacion', 'enviado', 'listo_para_retirar', 'entregado', 'cancelado'];

// Número de seguimiento del transportista: letras, números, espacios y guiones (se guarda en mayúsculas y sin espacios
// de más)
const numeroSeguimiento = { type: 'string', minLength: 4, maxLength: 60, pattern: '^\\s*[A-Za-z0-9][A-Za-z0-9 -]*\\s*$' };
function normalizarSeguimiento(valor) {
  const limpio = valor.trim().replace(/\s+/g, ' ').toUpperCase();
  if (limpio.length < 4 || limpio.length > 40) throw new ErrorApi(400, 'El número de seguimiento tiene que tener entre 4 y 40 caracteres.');
  return limpio;
}

const precio = { type: 'number', exclusiveMinimum: 0, maximum: 100000000 };
const stock = { type: 'integer', minimum: 0, maximum: 100000 };
const condicion = { type: 'string', enum: ['nuevo', 'usado'] };

const SQL_PUBLICACION = `
  SELECT pu.id, pu.precio, pu.stock, pu.condicion, pu.estado, pu.actualizado_en, pu.descripcion,
         (SELECT coalesce(json_agg(json_build_object('id', pf.id, 'url', 'api/archivos/' || pf.archivo_id) ORDER BY pf.orden, pf.id), '[]')
            FROM publicacion_fotos pf WHERE pf.publicacion_id = pu.id) AS fotos,
         json_build_object('id', pr.id, 'nombre', pr.nombre, 'marca', mr.nombre, 'numero_pieza', pr.numero_pieza, 'sku', pr.sku,
                           'imagen', pr.imagen, 'universal', pr.universal, 'categoria', ca.nombre,
                           'estado_verificacion', pr.estado_verificacion) AS producto,
         (SELECT count(*) FROM publicaciones otra
           WHERE otra.producto_id = pu.producto_id AND otra.id <> pu.id AND otra.estado = 'activa') AS competidores,
         (SELECT min(otra.precio) FROM publicaciones otra
           WHERE otra.producto_id = pu.producto_id AND otra.id <> pu.id AND otra.estado = 'activa'
             AND otra.condicion = pu.condicion) AS mejor_precio_competencia
    FROM publicaciones pu
    JOIN productos pr ON pr.id = pu.producto_id
    JOIN marcas_repuesto mr ON mr.id = pr.marca_repuesto_id
    JOIN categorias ca ON ca.id = pr.categoria_id`;

/** Fuente de los datos que cargan los vendedores desde su panel (se crea la primera vez). */
async function fuenteVendedores(db) {
  const { rows: [f] } = await db.query(`
    INSERT INTO fuentes (slug, nombre, tipo, nivel_confianza, notas)
    VALUES ('vendedores', 'Carga de vendedores AUTONEX', 'manual', 'baja',
            'Repuestos y compatibilidades declarados por los vendedores al publicar. Requieren revisión de un administrador.')
    ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug RETURNING id`);
  return f;
}

/** Marca de repuesto por nombre (sin distinguir mayúsculas ni tildes); si no existe se crea sin verificar. */
async function marcaRepuestoId(db, nombre, fuenteId) {
  const clave = claveNombre(nombre);
  const { rows: [existe] } = await db.query(
    'SELECT id FROM marcas_repuesto WHERE clave_normalizada = $1 OR normalizar(nombre) = normalizar($2) LIMIT 1', [clave, nombre]);
  if (existe) return existe.id;
  const { rows: [nueva] } = await db.query(`
    INSERT INTO marcas_repuesto (nombre, slug, clave_normalizada, fuente_id, importado_en, estado_verificacion, confianza)
    VALUES ($1, $2, $3, $4, now(), 'UNVERIFIED', 'baja') RETURNING id`, [nombre, slugificar(nombre), clave, fuenteId]);
  return nueva.id;
}

export default async function rutasPanelVendedor(app) {
  const opciones = (extra = {}) => ({ onRequest: app.soloVendedor, ...extra });
  await app.register(multipart, { limits: { fileSize: MAX_BYTES_FOTO, files: MAX_FOTOS_POR_PUBLICACION, fields: 2 } });

  app.get('/vendedor/resumen', opciones(), async (request) => {
    const vid = request.user.vendedor_id;
    const { rows: [resumen] } = await query(`
      SELECT
        (SELECT coalesce(json_object_agg(estado, cantidad), '{}') FROM (
           SELECT estado, count(*) AS cantidad FROM pedidos WHERE vendedor_id = $1 GROUP BY estado) e) AS pedidos_por_estado,
        (SELECT coalesce(sum(subtotal), 0) FROM pedidos
          WHERE vendedor_id = $1 AND estado NOT IN ('pendiente_pago', 'cancelado')) AS ventas_totales,
        (SELECT coalesce(sum(subtotal), 0) FROM pedidos
          WHERE vendedor_id = $1 AND estado NOT IN ('pendiente_pago', 'cancelado')
            AND creado_en >= date_trunc('month', now())) AS ventas_mes,
        (SELECT count(*) FROM publicaciones WHERE vendedor_id = $1 AND estado = 'activa') AS publicaciones_activas,
        (SELECT count(*) FROM publicaciones WHERE vendedor_id = $1 AND estado = 'pausada') AS publicaciones_pausadas,
        (SELECT count(*) FROM publicaciones WHERE vendedor_id = $1 AND estado = 'activa' AND stock = 0) AS sin_stock,
        (SELECT count(*) FROM publicaciones WHERE vendedor_id = $1 AND estado = 'activa' AND stock BETWEEN 1 AND 3) AS stock_bajo,
        (SELECT count(*) FROM pedidos pe WHERE pe.vendedor_id = $1 AND pe.estado <> 'cancelado'
            AND EXISTS (SELECT 1 FROM arrepentimientos ar WHERE ar.compra_id = pe.compra_id AND ar.estado = 'recibido')) AS arrepentimientos`,
    [vid]);
    return resumen;
  });

  // ------------------------------------------------------------------ pedidos recibidos
  app.get('/vendedor/pedidos', opciones({
    schema: {
      querystring: {
        type: 'object',
        properties: { estado: { type: 'string', enum: [...ESTADOS_PEDIDO, 'activos', 'todos', 'arrepentimiento'] } },
      },
    },
  }), async (request) => {
    const estado = request.query.estado || 'activos';
    // Pedidos con una solicitud de arrepentimiento sin resolver (aunque ya estén entregados)
    const conArrepentimiento = `pe.estado NOT IN ('cancelado', 'pendiente_pago') AND EXISTS (
      SELECT 1 FROM arrepentimientos ar WHERE ar.compra_id = pe.compra_id AND ar.estado = 'recibido')`;
    const filtro = {
      activos: `(pe.estado IN ('pagado', 'en_preparacion', 'enviado', 'listo_para_retirar') OR (${conArrepentimiento}))`,
      todos: "pe.estado <> 'pendiente_pago'",
      arrepentimiento: conArrepentimiento,
    }[estado] || 'pe.estado = $2';
    const params = [request.user.vendedor_id];
    if (!['activos', 'todos', 'arrepentimiento'].includes(estado)) params.push(estado);

    const { rows } = await query(`
      SELECT pe.id, pe.estado, pe.subtotal, pe.costo_envio, pe.total, pe.nota, pe.creado_en, pe.actualizado_en,
             json_build_object('id', co.id, 'estado', co.estado, 'pagada_en', co.pagada_en,
                               'nombre', co.comprador_nombre, 'apellido', co.comprador_apellido,
                               'email', co.comprador_email, 'telefono', co.comprador_telefono,
                               'dni', co.comprador_dni) AS compra,
             (SELECT row_to_json(en) FROM envios en WHERE en.pedido_id = pe.id) AS envio,
             (SELECT json_build_object('codigo', ar.codigo, 'estado', ar.estado, 'creado_en', ar.creado_en, 'motivo', ar.motivo)
                FROM arrepentimientos ar WHERE ar.compra_id = co.id ORDER BY ar.creado_en DESC LIMIT 1) AS arrepentimiento,
             (SELECT json_build_object('estado', re.estado, 'monto', re.monto, 'mp_reintegro_id', re.mp_reintegro_id,
                                       'detalle', re.detalle, 'creado_en', re.creado_en)
                FROM reintegros re WHERE re.pedido_id = pe.id) AS reintegro,
             (SELECT coalesce(json_agg(json_build_object(
                 'id', pi.id, 'nombre', pi.nombre_producto, 'numero_pieza', pi.codigo_pieza, 'condicion', pi.condicion,
                 'precio_unitario', pi.precio_unitario, 'cantidad', pi.cantidad, 'subtotal', pi.subtotal,
                 'imagen', pr.imagen) ORDER BY pi.id), '[]')
                FROM pedido_items pi JOIN productos pr ON pr.id = pi.producto_id WHERE pi.pedido_id = pe.id) AS items
        FROM pedidos pe JOIN compras co ON co.id = pe.compra_id
       WHERE pe.vendedor_id = $1 AND ${filtro}
       ORDER BY (${conArrepentimiento}) DESC, CASE pe.estado WHEN 'pagado' THEN 0 WHEN 'en_preparacion' THEN 1 ELSE 2 END, pe.creado_en DESC`,
    params);

    return rows.map((p) => {
      const revocable = p.arrepentimiento?.estado === 'recibido' && PEDIDO_REVOCABLE.includes(p.estado);
      return {
        ...p,
        // Con una solicitud de arrepentimiento abierta el pedido no se prepara ni se despacha
        siguientes_estados: revocable ? [] : SIGUIENTE[p.estado]?.(p.envio?.metodo) ?? [],
        revocable,
        en_manos_del_comprador: EN_MANOS_DEL_COMPRADOR.includes(p.estado),
      };
    });
  });

  app.patch('/vendedor/pedidos/:id/estado', opciones({
    schema: {
      params: paramsId,
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['estado'],
        properties: {
          estado: { type: 'string', enum: ['en_preparacion', 'enviado', 'listo_para_retirar', 'entregado'] },
          numero_seguimiento: numeroSeguimiento, // opcional, al marcarlo como enviado
        },
      },
    },
  }), async (request) => {
    const nuevo = request.body.estado;
    const seguimiento = request.body.numero_seguimiento ? normalizarSeguimiento(request.body.numero_seguimiento) : null;
    if (seguimiento && nuevo !== 'enviado') {
      throw new ErrorApi(400, 'El número de seguimiento se carga cuando el pedido se marca como enviado.');
    }
    return transaccion(async (db) => {
      const { rows: [pedido] } = await db.query(`
        SELECT pe.id, pe.estado, pe.compra_id, en.metodo FROM pedidos pe JOIN envios en ON en.pedido_id = pe.id
         WHERE pe.id = $1 AND pe.vendedor_id = $2 FOR UPDATE OF pe`, [request.params.id, request.user.vendedor_id]);
      if (!pedido) throw new ErrorApi(404, 'No encontramos ese pedido entre los de tu local.');
      if (pedido.estado === 'pendiente_pago') throw new ErrorApi(409, 'El pedido todavía no está pagado.');
      const arrepentimiento = await arrepentimientoAbierto(db, pedido.compra_id);
      if (arrepentimiento && pedido.estado !== 'cancelado') {
        throw new ErrorApi(409, `El comprador pidió revocar la compra con el Botón de arrepentimiento (${arrepentimiento.codigo}): no prepares ni despaches el pedido. Cancelalo y se le reintegra el dinero.`);
      }
      const permitidos = SIGUIENTE[pedido.estado]?.(pedido.metodo) ?? [];
      if (!permitidos.includes(nuevo)) {
        if (nuevo === 'enviado' && pedido.metodo === 'retiro') {
          throw new ErrorApi(409, 'Este pedido es con retiro en el local: marcalo como "listo para retirar".');
        }
        if (nuevo === 'listo_para_retirar' && pedido.metodo === 'domicilio') {
          throw new ErrorApi(409, 'Este pedido es con envío a domicilio: marcalo como "enviado".');
        }
        throw new ErrorApi(409, `No se puede pasar un pedido de "${pedido.estado.replace(/_/g, ' ')}" a "${nuevo.replace(/_/g, ' ')}".`);
      }
      const { rows: [actualizado] } = await db.query(
        'UPDATE pedidos SET estado = $2, actualizado_en = now() WHERE id = $1 RETURNING id, estado, actualizado_en',
        [pedido.id, nuevo]);
      let envio = null;
      if (nuevo === 'enviado') {
        ({ rows: [envio] } = await db.query(
          `UPDATE envios SET despachado_en = now(), numero_seguimiento = coalesce($2, numero_seguimiento)
            WHERE pedido_id = $1 RETURNING numero_seguimiento, despachado_en`, [pedido.id, seguimiento]));
      }
      return { ...actualizado, ...envio, siguientes_estados: SIGUIENTE[nuevo]?.(pedido.metodo) ?? [] };
    });
  });

  // Botón de arrepentimiento: el vendedor cancela el pedido (si el comprador ya lo tiene, cuando se lo devuelve) y se
  // reintegra el total con Mercado Pago
  app.post('/vendedor/pedidos/:id/arrepentimiento', opciones({
    schema: {
      params: paramsId,
      body: {
        type: 'object',
        additionalProperties: false,
        properties: { producto_devuelto: { type: 'boolean' }, reponer_stock: { type: 'boolean' } },
      },
    },
  }), async (request) => revocarPedido({
    pedidoId: request.params.id,
    vendedorId: request.user.vendedor_id,
    productoDevuelto: request.body?.producto_devuelto === true,
    reponerStock: request.body?.reponer_stock !== false,
  }, app.mp, request.log));

  app.post('/vendedor/pedidos/:id/reintegro', opciones({ schema: { params: paramsId } }),
    async (request) => ({ reintegro: await reintentarReintegro(request.params.id, request.user.vendedor_id, app.mp, request.log) }));

  // Cargar o corregir el número de seguimiento de un pedido ya despachado
  app.put('/vendedor/pedidos/:id/seguimiento', opciones({
    schema: {
      params: paramsId,
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['numero_seguimiento'],
        properties: { numero_seguimiento: numeroSeguimiento },
      },
    },
  }), async (request) => {
    const { rows: [pedido] } = await query(`
      SELECT pe.id, pe.estado, en.metodo FROM pedidos pe JOIN envios en ON en.pedido_id = pe.id
       WHERE pe.id = $1 AND pe.vendedor_id = $2`, [request.params.id, request.user.vendedor_id]);
    if (!pedido) throw new ErrorApi(404, 'No encontramos ese pedido entre los de tu local.');
    if (pedido.metodo !== 'domicilio') throw new ErrorApi(409, 'Este pedido es con retiro en el local: no lleva número de seguimiento.');
    if (!['enviado', 'entregado'].includes(pedido.estado)) {
      throw new ErrorApi(409, 'El número de seguimiento se carga cuando el pedido ya fue enviado.');
    }
    const { rows: [envio] } = await query(
      'UPDATE envios SET numero_seguimiento = $2 WHERE pedido_id = $1 RETURNING numero_seguimiento, despachado_en',
      [pedido.id, normalizarSeguimiento(request.body.numero_seguimiento)]);
    return { id: pedido.id, ...envio };
  });

  // ------------------------------------------------------------------ publicaciones
  app.get('/vendedor/publicaciones', opciones({
    schema: {
      querystring: {
        type: 'object',
        properties: {
          q: { type: 'string', maxLength: 80 },
          estado: { type: 'string', enum: ['activa', 'pausada', 'sin_stock', 'todas'] },
        },
      },
    },
  }), async (request) => {
    const { q, estado = 'todas' } = request.query;
    const params = [request.user.vendedor_id];
    const condiciones = ['pu.vendedor_id = $1'];
    if (estado === 'activa' || estado === 'pausada') {
      params.push(estado);
      condiciones.push(`pu.estado = $${params.length}`);
    }
    if (estado === 'sin_stock') condiciones.push('pu.stock = 0');
    if (q) {
      params.push(`%${q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}%`);
      condiciones.push(`normalizar(pr.nombre || ' ' || mr.nombre || ' ' || pr.numero_pieza || ' ' || pr.sku) LIKE $${params.length}`);
    }
    const { rows } = await query(
      `${SQL_PUBLICACION} WHERE ${condiciones.join(' AND ')} ORDER BY pu.estado, ca.orden, pr.nombre`, params);
    return rows;
  });

  app.patch('/vendedor/publicaciones/:id', opciones({
    schema: {
      params: paramsId,
      body: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: { precio, stock, estado: { type: 'string', enum: ['activa', 'pausada'] } },
      },
    },
  }), async (request) => {
    const campos = Object.keys(request.body);
    const sets = campos.map((c, i) => `${c} = $${i + 3}`).join(', ');
    const { rowCount } = await query(
      `UPDATE publicaciones SET ${sets}, actualizado_en = now() WHERE id = $1 AND vendedor_id = $2`,
      [request.params.id, request.user.vendedor_id, ...campos.map((c) => request.body[c])]);
    if (!rowCount) throw new ErrorApi(404, 'No encontramos esa publicación entre las de tu local.');
    const { rows: [publicacion] } = await query(`${SQL_PUBLICACION} WHERE pu.id = $1`, [request.params.id]);
    return publicacion;
  });

  // Descripción propia de la publicación. Reemplaza la anterior: sin texto, la publicación queda sin descripción (los
  // textos vacíos se descartan al recibir el pedido, por eso no va en el PATCH).
  app.put('/vendedor/publicaciones/:id/descripcion', opciones({
    schema: {
      params: paramsId,
      body: { type: 'object', additionalProperties: false, properties: { descripcion: textoOpcional(2000) } },
    },
  }), async (request) => {
    const { rowCount } = await query(
      'UPDATE publicaciones SET descripcion = $3, actualizado_en = now() WHERE id = $1 AND vendedor_id = $2',
      [request.params.id, request.user.vendedor_id, request.body?.descripcion || null]);
    if (!rowCount) throw new ErrorApi(404, 'No encontramos esa publicación entre las de tu local.');
    const { rows: [publicacion] } = await query(`${SQL_PUBLICACION} WHERE pu.id = $1`, [request.params.id]);
    return publicacion;
  });

  // Alta de un producto del vendedor + su publicación. El vendedor no ve el catálogo de nadie: carga lo suyo. Si la pieza
  // ya existe (misma marca y número de pieza), la publicación se suma a esa ficha, donde el comprador compara las ofertas
  // de todas las casas; la descripción y las fotos de la publicación son del vendedor.
  // Lo que carga un vendedor queda con su fuente ("Carga de vendedores") y SIN VERIFICAR, igual que las
  // compatibilidades que declara: el comprador ve que no están confirmadas hasta que un administrador las revise.
  app.post('/vendedor/productos', opciones({
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['nombre', 'marca', 'numero_pieza', 'categoria_id', 'universal', 'precio', 'stock', 'condicion'],
        properties: {
          nombre: texto(140, 5),
          marca: texto(40, 2),
          numero_pieza: { type: 'string', minLength: 3, maxLength: 40, pattern: '^[A-Za-z0-9 ./_-]+$' },
          tipo_pieza: { type: 'string', enum: ['original', 'aftermarket', 'alternativo', 'generico', 'usado', 'reacondicionado'] },
          ean: { type: 'string', pattern: '^[0-9]{8,14}$' },
          categoria_id: id,
          descripcion: textoOpcional(2000),
          universal: { type: 'boolean' },
          vehiculo_ids: { type: 'array', maxItems: 200, uniqueItems: true, items: id },
          precio,
          stock,
          condicion,
        },
      },
    },
  }), async (request, reply) => {
    const b = request.body;
    const vehiculos = b.vehiculo_ids || [];
    if (!b.universal && vehiculos.length === 0) {
      throw new ErrorApi(400, 'Indicá con qué vehículos es compatible o marcalo como universal.');
    }
    let unidaAExistente = false;
    const publicacionId = await transaccion(async (db) => {
      const fuente = await fuenteVendedores(db);
      const marcaId = await marcaRepuestoId(db, b.marca, fuente.id);
      const { rows: [existente] } = await db.query(
        'SELECT id, estado_verificacion FROM productos WHERE marca_repuesto_id = $1 AND numero_normalizado = normalizar_codigo($2)',
        [marcaId, b.numero_pieza]);
      if (existente) {
        if (existente.estado_verificacion === 'DISCONTINUED') {
          throw new ErrorApi(409, 'Ese número de pieza figura como discontinuado y no se puede publicar. Revisá la marca y el número.');
        }
        if (!b.universal) {
          const { rows: [{ cantidad }] } = await db.query('SELECT count(*)::int AS cantidad FROM vehiculos WHERE id = ANY($1::int[])', [vehiculos]);
          if (cantidad !== vehiculos.length) throw new ErrorApi(400, 'Alguno de los vehículos elegidos no existe.');
        }
        const repetida = await db.query(
          'SELECT id FROM publicaciones WHERE producto_id = $1 AND vendedor_id = $2 AND condicion = $3',
          [existente.id, request.user.vendedor_id, b.condicion]);
        if (repetida.rowCount) {
          throw new ErrorApi(409, `Ya publicás ese repuesto como ${b.condicion}. Editá esa publicación desde la lista.`,
            { publicacion_id: repetida.rows[0].id });
        }
        // Las compatibilidades que declara se suman sin verificar (las que ya estaban no se tocan)
        if (!b.universal) {
          await db.query(
            `INSERT INTO compatibilidades (producto_id, vehiculo_id, fuente_id, importado_en, estado_verificacion, confianza, notas)
             SELECT $1, v.id, $3, now(), 'UNVERIFIED', 'baja', 'Declarada por el vendedor al publicar'
               FROM vehiculos v WHERE v.id = ANY($2::int[])
                AND NOT EXISTS (SELECT 1 FROM compatibilidades c WHERE c.producto_id = $1 AND c.vehiculo_id = v.id)`,
            [existente.id, vehiculos, fuente.id]);
        }
        const { rows: [pub] } = await db.query(
          `INSERT INTO publicaciones (producto_id, vendedor_id, precio, stock, condicion, descripcion)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
          [existente.id, request.user.vendedor_id, b.precio, b.stock, b.condicion, b.descripcion?.trim() || null]);
        unidaAExistente = true;
        return pub.id;
      }
      const { rows: [categoria] } = await db.query(
        'SELECT imagen, NOT EXISTS (SELECT 1 FROM categorias h WHERE h.padre_id = c.id) AS es_hoja FROM categorias c WHERE id = $1',
        [b.categoria_id]);
      if (!categoria) throw new ErrorApi(400, 'La categoría elegida no existe.');
      if (!categoria.es_hoja) throw new ErrorApi(400, 'Elegí la subcategoría más específica para el repuesto.');
      const { rows: [producto] } = await db.query(
        `INSERT INTO productos (nombre, marca_repuesto_id, numero_pieza, descripcion, categoria_id, imagen, universal, tipo_pieza, ean,
                                fuente_id, importado_en, estado_verificacion, confianza)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now(), 'UNVERIFIED', 'baja') RETURNING id`,
        [b.nombre, marcaId, b.numero_pieza.toUpperCase(), null, b.categoria_id, categoria.imagen, b.universal,
          b.tipo_pieza || (b.condicion === 'usado' ? 'usado' : 'aftermarket'), b.ean ?? null, fuente.id]);
      if (!b.universal) {
        const { rowCount } = await db.query(
          `INSERT INTO compatibilidades (producto_id, vehiculo_id, fuente_id, importado_en, estado_verificacion, confianza, notas)
           SELECT $1, v.id, $3, now(), 'UNVERIFIED', 'baja', 'Declarada por el vendedor al publicar'
             FROM vehiculos v WHERE v.id = ANY($2::int[])`, [producto.id, vehiculos, fuente.id]);
        if (rowCount !== vehiculos.length) throw new ErrorApi(400, 'Alguno de los vehículos elegidos no existe.');
      }
      const { rows: [pub] } = await db.query(
        `INSERT INTO publicaciones (producto_id, vendedor_id, precio, stock, condicion, descripcion)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [producto.id, request.user.vendedor_id, b.precio, b.stock, b.condicion, b.descripcion?.trim() || null]);
      return pub.id;
    });
    const { rows: [publicacion] } = await query(`${SQL_PUBLICACION} WHERE pu.id = $1`, [publicacionId]);
    return reply.status(201).send({ ...publicacion, unida_a_existente: unidaAExistente });
  });

  // ------------------------------------------------------------------ fotos de una publicación
  const publicacionPropia = async (publicacionId, vendedorId) => {
    const { rowCount } = await query('SELECT 1 FROM publicaciones WHERE id = $1 AND vendedor_id = $2', [publicacionId, vendedorId]);
    if (!rowCount) throw new ErrorApi(404, 'No encontramos esa publicación entre las de tu local.');
  };

  // Sube una o varias fotos (multipart/form-data, campo "fotos"). Máximo 6 por publicación, de hasta 8 MB cada una.
  app.post('/vendedor/publicaciones/:id/fotos', opciones({ schema: { params: paramsId } }), async (request) => {
    if (!request.isMultipart()) throw new ErrorApi(400, 'Enviá las fotos como multipart/form-data.');
    const publicacionId = request.params.id;
    await publicacionPropia(publicacionId, request.user.vendedor_id);
    const { rows: [{ cantidad }] } = await query('SELECT count(*)::int AS cantidad FROM publicacion_fotos WHERE publicacion_id = $1', [publicacionId]);
    const procesadas = [];
    try {
      for await (const parte of request.files()) {
        const datos = await parte.toBuffer();
        if (parte.file.truncated) throw new ErrorApi(413, `"${parte.filename}" pesa más de 8 MB.`);
        if (cantidad + procesadas.length >= MAX_FOTOS_POR_PUBLICACION) {
          throw new ErrorApi(400, `Cada publicación puede tener hasta ${MAX_FOTOS_POR_PUBLICACION} fotos (ya tiene ${cantidad}).`);
        }
        procesadas.push(await procesarFoto(datos, parte.filename));
      }
    } catch (e) {
      if (e.code === 'FST_REQ_FILE_TOO_LARGE') throw new ErrorApi(413, 'Cada foto puede pesar hasta 8 MB.');
      if (e.code === 'FST_FILES_LIMIT') throw new ErrorApi(400, `Podés subir hasta ${MAX_FOTOS_POR_PUBLICACION} fotos por vez.`);
      throw e;
    }
    if (!procesadas.length) throw new ErrorApi(400, 'Elegí al menos una foto.');
    await transaccion(async (db) => {
      const { rows: [{ orden }] } = await db.query(
        'SELECT coalesce(max(orden), -1) AS orden FROM publicacion_fotos WHERE publicacion_id = $1', [publicacionId]);
      for (const [i, f] of procesadas.entries()) {
        const archivoId = await guardarArchivo(db, f);
        await db.query('INSERT INTO publicacion_fotos (publicacion_id, archivo_id, orden) VALUES ($1,$2,$3)', [publicacionId, archivoId, orden + 1 + i]);
      }
      await db.query('UPDATE publicaciones SET actualizado_en = now() WHERE id = $1', [publicacionId]);
    });
    const { rows: [publicacion] } = await query(`${SQL_PUBLICACION} WHERE pu.id = $1`, [publicacionId]);
    return publicacion;
  });

  app.delete('/vendedor/publicaciones/:id/fotos/:fotoId', opciones({
    schema: { params: { type: 'object', required: ['id', 'fotoId'], properties: { id, fotoId: id } } },
  }), async (request) => {
    await publicacionPropia(request.params.id, request.user.vendedor_id);
    const { rows: [foto] } = await query(
      'DELETE FROM publicacion_fotos WHERE id = $1 AND publicacion_id = $2 RETURNING archivo_id', [request.params.fotoId, request.params.id]);
    if (!foto) throw new ErrorApi(404, 'No encontramos esa foto.');
    await query('DELETE FROM archivos WHERE id = $1', [foto.archivo_id]);
    const { rows: [publicacion] } = await query(`${SQL_PUBLICACION} WHERE pu.id = $1`, [request.params.id]);
    return publicacion;
  });

  // ------------------------------------------------------------------ logo del local
  // Sin logo subido, el local vuelve al logo que tenía de base (si lo tiene) o se muestran sus iniciales
  const logoDeBase = (slug) => (fs.existsSync(path.join(config.clientePublic, 'img', 'vendedores', `${slug}.svg`))
    ? `/img/vendedores/${slug}.svg` : null);

  app.put('/vendedor/logo', opciones(), async (request) => {
    const { datos, nombre } = await leerImagenSubida(request);
    const logo = await procesarLogo(datos, nombre);
    return transaccion(async (db) => {
      const { rows: [anterior] } = await db.query('SELECT logo_archivo_id FROM vendedores WHERE id = $1 FOR UPDATE', [request.user.vendedor_id]);
      const archivoId = await guardarArchivo(db, logo);
      const { rows: [vendedor] } = await db.query(
        'UPDATE vendedores SET logo = $2, logo_archivo_id = $3 WHERE id = $1 RETURNING logo', [request.user.vendedor_id, urlArchivo(archivoId), archivoId]);
      if (anterior.logo_archivo_id) await db.query('DELETE FROM archivos WHERE id = $1', [anterior.logo_archivo_id]);
      return { logo: vendedor.logo, logo_subido: true };
    });
  });

  app.delete('/vendedor/logo', opciones(), async (request) => transaccion(async (db) => {
    const { rows: [v] } = await db.query('SELECT slug, logo_archivo_id FROM vendedores WHERE id = $1 FOR UPDATE', [request.user.vendedor_id]);
    if (!v.logo_archivo_id) throw new ErrorApi(404, 'Tu local no tiene un logo subido.');
    const { rows: [vendedor] } = await db.query(
      'UPDATE vendedores SET logo = $2, logo_archivo_id = NULL WHERE id = $1 RETURNING logo', [request.user.vendedor_id, logoDeBase(v.slug)]);
    await db.query('DELETE FROM archivos WHERE id = $1', [v.logo_archivo_id]);
    return { logo: vendedor.logo, logo_subido: false };
  }));

  // ------------------------------------------------------------------ datos del local
  app.get('/vendedor/perfil', opciones(), async (request) => {
    const { rows: [vendedor] } = await query('SELECT * FROM vendedores WHERE id = $1', [request.user.vendedor_id]);
    return { ...vendedor, horarios: vendedor.horarios ?? leerHorarioTexto(vendedor.horario), logo_subido: Boolean(vendedor.logo_archivo_id) };
  });

  app.put('/vendedor/perfil', opciones({
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: {
          nombre_comercial: texto(80, 3),
          descripcion: textoOpcional(600),
          direccion: texto(120, 3),
          ciudad: texto(80, 2),
          provincia,
          telefono,
          whatsapp: { type: 'string', pattern: '^[0-9]{10,15}$' },
          horario: texto(200, 3),
          horarios: esquemaHorarios,
        },
      },
    },
  }), async (request) => {
    // El horario se carga por día; el texto que se muestra se arma a partir de eso
    if (request.body.horarios) {
      const horarios = normalizarHorarios(request.body.horarios);
      request.body.horarios = JSON.stringify(horarios);
      request.body.horario = textoHorarios(horarios);
    } else if (request.body.horario) {
      const leido = leerHorarioTexto(request.body.horario);
      request.body.horarios = leido ? JSON.stringify(leido) : null;
    }
    const campos = Object.keys(request.body);
    const sets = campos.map((c, i) => `${c} = $${i + 2}`).join(', ');
    const { rows: [vendedor] } = await query(
      `UPDATE vendedores SET ${sets} WHERE id = $1 RETURNING *`,
      [request.user.vendedor_id, ...campos.map((c) => request.body[c])]);
    return vendedor;
  });
}

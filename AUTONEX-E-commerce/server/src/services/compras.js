import crypto from 'node:crypto';
import { config } from '../config.js';
import { query, transaccion } from '../db.js';
import { ErrorApi } from '../errores.js';
import { cargarPublicaciones, unificarItems } from './carrito.js';
import { cotizarEnvio, NOMBRES_TRANSPORTISTA } from './envios.js';

/**
 * Crea la compra (pendiente de pago) con un pedido por vendedor, en una sola transacción.
 * Precios, stock y costos de envío se recalculan acá: no se usa ningún monto enviado por el frontend.
 * El stock NO se descuenta todavía: se descuenta cuando Mercado Pago aprueba el pago.
 * Sin usuario (compra como invitado) se genera un código de acceso secreto para ver y pagar la compra.
 * Devuelve { id, codigoAcceso }.
 */
export async function crearCompra(usuarioId, datos) {
  return transaccion(async (db) => {
    const items = unificarItems(datos.items);
    const publicaciones = await cargarPublicaciones(db, items.map((i) => i.publicacion_id), { bloquear: true });

    const porVendedor = new Map();
    for (const item of items) {
      const pub = publicaciones.get(item.publicacion_id);
      if (!pub) {
        throw new ErrorApi(409, 'Una de las publicaciones del carrito ya no existe. Actualizá el carrito y volvé a intentar.');
      }
      if (usuarioId && pub.vendedor_usuario_id === usuarioId) {
        throw new ErrorApi(409, `No podés comprar publicaciones de tu propio local ("${pub.nombre}").`);
      }
      if (pub.estado !== 'activa') {
        throw new ErrorApi(409, `"${pub.nombre}" de ${pub.nombre_comercial} está pausada y no se puede comprar.`);
      }
      if (pub.stock < item.cantidad) {
        throw new ErrorApi(409, pub.stock === 0
          ? `"${pub.nombre}" de ${pub.nombre_comercial} se quedó sin stock.`
          : `Solo quedan ${pub.stock} unidades de "${pub.nombre}" en ${pub.nombre_comercial}.`,
        { publicacion_id: pub.publicacion_id, stock: pub.stock });
      }
      if (!porVendedor.has(pub.vendedor_id)) {
        porVendedor.set(pub.vendedor_id, {
          vendedor: { id: pub.vendedor_id, nombre: pub.nombre_comercial, ciudad: pub.ciudad, provincia: pub.provincia },
          items: [],
        });
      }
      porVendedor.get(pub.vendedor_id).items.push({ pub, cantidad: item.cantidad, subtotal: pub.precio * item.cantidad });
    }

    const entregas = new Map(datos.entregas.map((e) => [e.vendedor_id, e]));
    const pedidos = [];
    for (const [vendedorId, grupo] of porVendedor) {
      const entrega = entregas.get(vendedorId);
      if (!entrega) throw new ErrorApi(400, `Elegí la forma de entrega para ${grupo.vendedor.nombre}.`);
      const subtotal = grupo.items.reduce((s, i) => s + i.subtotal, 0);
      let envio = { metodo: 'retiro', costo: 0 };
      if (entrega.metodo === 'domicilio') {
        if (!datos.direccion) throw new ErrorApi(400, 'Completá la dirección de envío.');
        if (!entrega.transportista) throw new ErrorApi(400, `Elegí el transportista para el pedido de ${grupo.vendedor.nombre}.`);
        const unidades = grupo.items.reduce((s, i) => s + i.cantidad, 0);
        const cotizacion = cotizarEnvio(grupo.vendedor, datos.direccion, unidades);
        const opcion = cotizacion.opciones.find((o) => o.transportista === entrega.transportista);
        if (!opcion?.disponible) throw new ErrorApi(400, opcion?.motivo || 'El transportista elegido no está disponible.');
        envio = { metodo: 'domicilio', transportista: entrega.transportista, costo: opcion.costo, demora: opcion.demora };
      }
      pedidos.push({ vendedorId, subtotal, envio, items: grupo.items });
    }

    const subtotalProductos = pedidos.reduce((s, p) => s + p.subtotal, 0);
    const totalEnvios = pedidos.reduce((s, p) => s + p.envio.costo, 0);
    const c = datos.comprador;
    const codigoAcceso = usuarioId ? null : crypto.randomBytes(16).toString('hex');
    const { rows: [compra] } = await db.query(
      `INSERT INTO compras (usuario_id, comprador_nombre, comprador_apellido, comprador_email, comprador_telefono,
                            comprador_dni, subtotal_productos, total_envios, total, codigo_acceso)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [usuarioId, c.nombre, c.apellido, c.email.toLowerCase(), c.telefono, c.dni,
        subtotalProductos, totalEnvios, subtotalProductos + totalEnvios, codigoAcceso],
    );

    const d = datos.direccion || {};
    for (const pedido of pedidos) {
      const { rows: [fila] } = await db.query(
        `INSERT INTO pedidos (compra_id, vendedor_id, subtotal, costo_envio, total)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [compra.id, pedido.vendedorId, pedido.subtotal, pedido.envio.costo, pedido.subtotal + pedido.envio.costo],
      );
      for (const item of pedido.items) {
        await db.query(
          `INSERT INTO pedido_items (pedido_id, publicacion_id, producto_id, nombre_producto, codigo_pieza, condicion,
                                     precio_unitario, cantidad, subtotal)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [fila.id, item.pub.publicacion_id, item.pub.producto_id, item.pub.nombre, item.pub.numero_pieza,
            item.pub.condicion, item.pub.precio, item.cantidad, item.subtotal],
        );
      }
      const domicilio = pedido.envio.metodo === 'domicilio';
      await db.query(
        `INSERT INTO envios (pedido_id, metodo, transportista, costo, demora_estimada, calle, numero, piso_depto,
                             codigo_postal, localidad, provincia, observaciones)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [fila.id, pedido.envio.metodo, pedido.envio.transportista ?? null, pedido.envio.costo,
          pedido.envio.demora ?? null,
          domicilio ? d.calle : null, domicilio ? d.numero : null, domicilio ? d.piso_depto ?? null : null,
          domicilio ? d.codigo_postal : null, domicilio ? d.localidad : null, domicilio ? d.provincia : null,
          domicilio ? d.observaciones ?? null : null],
      );
    }

    // Guarda teléfono y DNI en el perfil si todavía no los tenía, para precargarlos la próxima vez.
    if (usuarioId) {
      await db.query(
        `UPDATE usuarios SET telefono = coalesce(telefono, $2), dni = coalesce(dni, $3) WHERE id = $1`,
        [usuarioId, c.telefono, c.dni],
      );
    }
    return { id: compra.id, codigoAcceso };
  });
}

// ---------------------------------------------------------------- acceso a una compra

const mismoCodigo = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length
  && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Puede ver o pagar la compra: su dueño (con sesión) o quien tiene el código de una compra sin cuenta. */
export async function puedeVerCompra(compraId, usuarioId, codigo) {
  const { rows: [c] } = await query('SELECT usuario_id, codigo_acceso FROM compras WHERE id = $1', [compraId]);
  if (!c) return false;
  if (usuarioId && c.usuario_id === usuarioId) return true;
  return Boolean(c.codigo_acceso && mismoCodigo(codigo, c.codigo_acceso));
}

/** Compra sin cuenta por número y email (para seguirla desde otro dispositivo). Devuelve su código de acceso. */
export async function buscarCompraInvitado(compraId, email) {
  const { rows: [c] } = await query(
    'SELECT id, usuario_id, codigo_acceso FROM compras WHERE id = $1 AND comprador_email = lower($2)', [compraId, email.trim()]);
  if (!c) throw new ErrorApi(404, 'No encontramos una compra con ese número y ese email.');
  if (c.usuario_id) throw new ErrorApi(409, 'Esa compra se hizo con una cuenta: iniciá sesión para verla en "Mis compras".');
  return { compra: await obtenerCompra(c.id), codigo_acceso: c.codigo_acceso };
}

// ---------------------------------------------------------------- consultas de compras

const SQL_COMPRA = `
  SELECT co.id, co.usuario_id, co.estado, co.subtotal_productos, co.total_envios, co.total,
         co.comprador_nombre, co.comprador_apellido, co.comprador_email, co.comprador_telefono, co.comprador_dni,
         co.creado_en, co.pagada_en,
         (SELECT coalesce(json_agg(json_build_object(
             'id', pe.id, 'estado', pe.estado, 'subtotal', pe.subtotal, 'costo_envio', pe.costo_envio,
             'total', pe.total, 'nota', pe.nota, 'actualizado_en', pe.actualizado_en,
             'vendedor', json_build_object('id', ve.id, 'slug', ve.slug, 'nombre_comercial', ve.nombre_comercial,
                                           'direccion', ve.direccion, 'ciudad', ve.ciudad, 'provincia', ve.provincia,
                                           'horario', ve.horario, 'telefono', ve.telefono, 'whatsapp', ve.whatsapp,
                                           'logo', ve.logo),
             'envio', (SELECT row_to_json(en) FROM envios en WHERE en.pedido_id = pe.id),
             'reintegro', (SELECT json_build_object('estado', re.estado, 'monto', re.monto, 'creado_en', re.creado_en)
                             FROM reintegros re WHERE re.pedido_id = pe.id),
             'items', (SELECT coalesce(json_agg(json_build_object(
                          'id', pi.id, 'publicacion_id', pi.publicacion_id, 'producto_id', pi.producto_id,
                          'nombre', pi.nombre_producto, 'numero_pieza', pi.codigo_pieza, 'condicion', pi.condicion,
                          'precio_unitario', pi.precio_unitario, 'cantidad', pi.cantidad, 'subtotal', pi.subtotal,
                          'imagen', pr.imagen) ORDER BY pi.id), '[]')
                         FROM pedido_items pi JOIN productos pr ON pr.id = pi.producto_id
                        WHERE pi.pedido_id = pe.id)
           ) ORDER BY pe.id), '[]')
            FROM pedidos pe JOIN vendedores ve ON ve.id = pe.vendedor_id
           WHERE pe.compra_id = co.id) AS pedidos,
         (SELECT json_build_object('estado', pa.estado, 'estado_detalle', pa.estado_detalle,
                                   'mp_pago_id', pa.mp_pago_id, 'medio_pago', pa.medio_pago,
                                   'actualizado_en', pa.actualizado_en)
            FROM pagos pa WHERE pa.compra_id = co.id
           ORDER BY (pa.mp_pago_id IS NOT NULL) DESC, pa.actualizado_en DESC LIMIT 1) AS ultimo_pago,
         (SELECT json_build_object('codigo', ar.codigo, 'estado', ar.estado, 'creado_en', ar.creado_en, 'resuelto_en', ar.resuelto_en)
            FROM arrepentimientos ar WHERE ar.compra_id = co.id ORDER BY ar.creado_en DESC LIMIT 1) AS arrepentimiento
    FROM compras co`;

export async function obtenerCompra(compraId) {
  const { rows } = await query(`${SQL_COMPRA} WHERE co.id = $1`, [compraId]);
  return rows[0] || null;
}

export async function listarCompras(usuarioId) {
  const { rows } = await query(`${SQL_COMPRA} WHERE co.usuario_id = $1 ORDER BY co.creado_en DESC`, [usuarioId]);
  return rows;
}

// ---------------------------------------------------------------- Mercado Pago

function urlAbsoluta(ruta) {
  if (!ruta) return undefined;
  return `${config.publicUrl}${ruta.startsWith('/') ? '' : '/'}${ruta}`;
}

function esUrlPublica(url) {
  return /^https:\/\//.test(url) && !/\/\/(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(url);
}

/** Arma el cuerpo de la preferencia de Checkout Pro: productos + envíos, external_reference = id de compra. */
export function armarPreferencia(compra) {
  const items = [];
  for (const pedido of compra.pedidos) {
    for (const item of pedido.items) {
      const imagen = urlAbsoluta(item.imagen);
      items.push({
        id: `pub-${item.publicacion_id}`,
        title: `${item.nombre} (${item.numero_pieza})`.slice(0, 250),
        description: `Vendido por ${pedido.vendedor.nombre_comercial}${item.condicion === 'usado' ? ' · usado' : ''}`,
        quantity: item.cantidad,
        unit_price: Number(item.precio_unitario),
        currency_id: 'ARS',
        category_id: 'others',
        ...(imagen && esUrlPublica(imagen) ? { picture_url: imagen } : {}),
      });
    }
    if (pedido.envio?.metodo === 'domicilio' && pedido.costo_envio > 0) {
      items.push({
        id: `envio-${pedido.id}`,
        title: `Envío ${NOMBRES_TRANSPORTISTA[pedido.envio.transportista]} · ${pedido.vendedor.nombre_comercial}`,
        quantity: 1,
        unit_price: Number(pedido.costo_envio),
        currency_id: 'ARS',
        category_id: 'services',
      });
    }
  }

  const backUrl = (estado) => `${config.publicUrl}/pago/${estado}`;
  const baseWebhook = config.webhookBaseUrl || config.publicUrl;
  const notificationUrl = `${baseWebhook}/api/pagos/webhook?source_news=webhooks`;

  return {
    items,
    payer: { name: compra.comprador_nombre, surname: compra.comprador_apellido },
    external_reference: String(compra.id),
    statement_descriptor: config.mercadoPago.statementDescriptor,
    back_urls: { success: backUrl('exito'), pending: backUrl('pendiente'), failure: backUrl('fallo') },
    auto_return: 'approved',
    // Mercado Pago necesita una URL pública para notificar (ngrok, dominio propio...). Con localhost no se envía.
    ...(esUrlPublica(notificationUrl) ? { notification_url: notificationUrl } : {}),
    metadata: { compra_id: compra.id },
  };
}

/** Crea una preferencia nueva para la compra y la registra en la tabla pagos. */
export async function iniciarPago(mp, compra) {
  if (compra.estado === 'pagada') throw new ErrorApi(409, 'Esta compra ya está pagada.');
  if (compra.estado === 'cancelada') throw new ErrorApi(409, 'Esta compra fue cancelada.');
  const preferencia = await mp.crearPreferencia(armarPreferencia(compra));
  await query(
    'INSERT INTO pagos (compra_id, preferencia_id, init_point, monto) VALUES ($1,$2,$3,$4)',
    [compra.id, preferencia.id, preferencia.init_point, compra.total],
  );
  return { preferencia_id: preferencia.id, init_point: preferencia.init_point };
}

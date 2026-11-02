// Resuelve los ítems del carrito contra la base: precio, stock y estado reales de cada publicación.
// El frontend solo manda { publicacion_id, cantidad }; los montos siempre salen de acá.

export async function cargarPublicaciones(db, ids, { bloquear = false } = {}) {
  const { rows } = await db.query(`
    SELECT pu.id AS publicacion_id, pu.precio, pu.stock, pu.condicion, pu.estado,
           pr.id AS producto_id, pr.nombre, mr.nombre AS marca, pr.numero_pieza, pr.sku, pr.imagen,
           ve.id AS vendedor_id, ve.nombre_comercial, ve.slug AS vendedor_slug, ve.ciudad, ve.provincia,
           ve.direccion, ve.horario, ve.usuario_id AS vendedor_usuario_id
      FROM publicaciones pu
      JOIN productos pr ON pr.id = pu.producto_id
      JOIN marcas_repuesto mr ON mr.id = pr.marca_repuesto_id
      JOIN vendedores ve ON ve.id = pu.vendedor_id
     WHERE pu.id = ANY($1::int[])
     ORDER BY pu.id
     ${bloquear ? 'FOR UPDATE OF pu' : ''}`, [ids]);
  return new Map(rows.map((r) => [r.publicacion_id, r]));
}

/** Suma cantidades si la misma publicación vino repetida. */
export function unificarItems(items) {
  const porId = new Map();
  for (const { publicacion_id: id, cantidad } of items) porId.set(id, (porId.get(id) || 0) + cantidad);
  return [...porId].map(([publicacion_id, cantidad]) => ({ publicacion_id, cantidad }));
}

/**
 * Valida el carrito sin modificar nada. Devuelve cada ítem con su situación:
 *   ok | ajustado (había menos stock) | sin_stock | pausada | no_existe
 */
export async function validarCarrito(db, items) {
  const unificados = unificarItems(items);
  const publicaciones = await cargarPublicaciones(db, unificados.map((i) => i.publicacion_id));
  return unificados.map(({ publicacion_id: id, cantidad }) => {
    const pub = publicaciones.get(id);
    if (!pub) return { publicacion_id: id, cantidad_solicitada: cantidad, cantidad: 0, estado: 'no_existe' };
    const base = {
      publicacion_id: id,
      cantidad_solicitada: cantidad,
      precio: pub.precio,
      stock: pub.stock,
      condicion: pub.condicion,
      producto: { id: pub.producto_id, nombre: pub.nombre, marca: pub.marca, numero_pieza: pub.numero_pieza, sku: pub.sku, imagen: pub.imagen },
      vendedor: {
        id: pub.vendedor_id, nombre_comercial: pub.nombre_comercial, slug: pub.vendedor_slug,
        ciudad: pub.ciudad, provincia: pub.provincia, direccion: pub.direccion, horario: pub.horario,
      },
    };
    if (pub.estado !== 'activa') return { ...base, cantidad: 0, estado: 'pausada' };
    if (pub.stock <= 0) return { ...base, cantidad: 0, estado: 'sin_stock' };
    if (cantidad > pub.stock) return { ...base, cantidad: pub.stock, estado: 'ajustado' };
    return { ...base, cantidad, estado: 'ok' };
  });
}

import { many, one, transaction } from '../db/index.js';
import { badRequest, notFound } from '../utils/errors.js';

const SELECT_LISTADO = `
  SELECT l.id, l.asset_kind, l.title, l.summary, l.unit_label,
         l.unit_price_usd, l.units_total, l.units_sold,
         (l.units_total - l.units_sold) AS units_available,
         l.commission_pct, l.status, l.published_at,
         p.name AS project_name, p.hectares,
         o.name AS org_name, o.kind AS org_kind,
         z.name AS zone_name, z.slug AS zone_slug,
         c.registry, c.registry_ref, c.vintage_year, c.certified_on
    FROM listings l
    JOIN projects p ON p.id = l.project_id
    JOIN organizations o ON o.id = p.org_id
    JOIN zones z ON z.id = p.zone_id
    LEFT JOIN carbon_credits c ON c.id = l.credit_id`;

export async function listar({ assetKind, zoneSlug } = {}) {
  const condiciones = [`l.status = 'publicado'`];
  const params = [];
  if (assetKind) { params.push(assetKind); condiciones.push(`l.asset_kind = $${params.length}`); }
  if (zoneSlug)  { params.push(zoneSlug);  condiciones.push(`z.slug = $${params.length}`); }

  return many(
    `${SELECT_LISTADO} WHERE ${condiciones.join(' AND ')} ORDER BY l.published_at DESC`,
    params,
  );
}

export async function obtener(id) {
  const listado = await one(`${SELECT_LISTADO} WHERE l.id = $1`, [id]);
  if (!listado) throw notFound('Ese activo no está publicado');

  listado.salud_zona = await one(
    'SELECT health_index, kelp_cobertura_pct, avistamientos_tiburon FROM zone_health WHERE slug = $1',
    [listado.zone_slug],
  );
  return listado;
}

/**
 * Registra una orden de compra. Descuenta unidades del listado en la
 * misma transacción para que dos compradores simultáneos no puedan
 * sobrevender el mismo activo.
 */
export async function comprar(id, { buyerName, buyerEmail, units, buyerOrgId }) {
  return transaction(async (cliente) => {
    const { rows: [listado] } = await cliente.query(
      `SELECT * FROM listings WHERE id = $1 AND status = 'publicado' FOR UPDATE`,
      [id],
    );
    if (!listado) throw notFound('Ese activo no está disponible');

    const disponibles = Number(listado.units_total) - Number(listado.units_sold);
    if (units > disponibles) {
      throw badRequest(`Solo quedan ${disponibles} ${listado.unit_label} disponibles`);
    }

    const bruto = Number((units * Number(listado.unit_price_usd)).toFixed(2));
    const comision = Number((bruto * Number(listado.commission_pct) / 100).toFixed(2));

    const { rows: [orden] } = await cliente.query(
      `INSERT INTO orders (listing_id, buyer_org_id, buyer_name, buyer_email,
                           units, unit_price_usd, gross_usd, commission_usd, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pendiente') RETURNING *`,
      [id, buyerOrgId ?? null, buyerName, buyerEmail, units,
       listado.unit_price_usd, bruto, comision],
    );

    const { rows: [actualizado] } = await cliente.query(
      `UPDATE listings
          SET units_sold = units_sold + $2,
              status = CASE WHEN units_sold + $2 >= units_total THEN 'agotado'::listing_status
                            ELSE status END
        WHERE id = $1 RETURNING units_sold, units_total, status`,
      [id, units],
    );

    return { orden, listado: actualizado, comision, bruto };
  });
}

/** Números públicos del marketplace, para la portada. */
export async function indicadores() {
  return one(`
    SELECT
      (SELECT COUNT(*)::int FROM listings WHERE status = 'publicado')            AS activos_publicados,
      (SELECT COALESCE(SUM(gross_usd), 0)::numeric(14,2) FROM orders
        WHERE status IN ('pagada','liquidada'))                                  AS volumen_usd,
      (SELECT COALESCE(SUM(commission_usd), 0)::numeric(14,2) FROM orders
        WHERE status IN ('pagada','liquidada'))                                  AS comision_usd,
      (SELECT COALESCE(SUM(o.units), 0)::numeric(14,3)
         FROM orders o JOIN listings l ON l.id = o.listing_id
        WHERE l.asset_kind = 'credito_carbono'
          AND o.status IN ('pagada','liquidada'))                                AS tco2_vendido
  `);
}

export async function ordenesDeListado(listingId) {
  return many(
    `SELECT id, buyer_name, units, gross_usd, commission_usd, status, created_at
       FROM orders WHERE listing_id = $1 ORDER BY created_at DESC`,
    [listingId],
  );
}

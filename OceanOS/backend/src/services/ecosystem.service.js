import { many, one } from '../db/index.js';
import { notFound } from '../utils/errors.js';

/** Dashboard público: lo que ve cualquiera sin iniciar sesión. */
export async function saludDeZonas() {
  return many(
    `SELECT h.*, z.center_lat, z.center_lng, z.min_lat, z.max_lat,
            z.min_lng, z.max_lng, z.area_km2, z.is_protected, z.province
       FROM zone_health h JOIN zones z ON z.id = h.zone_id
      ORDER BY h.health_index DESC`,
  );
}

export async function zona(slug) {
  const z = await one(
    `SELECT h.*, z.center_lat, z.center_lng, z.min_lat, z.max_lat,
            z.min_lng, z.max_lng, z.area_km2, z.is_protected, z.province
       FROM zone_health h JOIN zones z ON z.id = h.zone_id
      WHERE z.slug = $1`,
    [slug],
  );
  if (!z) throw notFound('Esa zona no existe');

  z.serie_kelp = await many(
    `SELECT date_trunc('week', observed_at)::date AS semana,
            ROUND(AVG(kelp_cover_pct), 1)         AS cobertura,
            COUNT(*)::int                          AS reportes
       FROM sightings
      WHERE zone_id = $1 AND kind = 'kelp' AND status = 'verificado'
        AND kelp_cover_pct IS NOT NULL
        AND observed_at >= now() - interval '180 days'
      GROUP BY 1 ORDER BY 1`,
    [z.zone_id],
  );

  z.especies = await many(
    `SELECT sp.common_name, sp.scientific_name, sp.iucn_status, sp.kind,
            COUNT(*)::int AS avistamientos,
            MAX(s.observed_at) AS ultimo
       FROM sightings s JOIN species sp ON sp.id = s.species_id
      WHERE s.zone_id = $1 AND s.status = 'verificado'
      GROUP BY sp.id ORDER BY avistamientos DESC`,
    [z.zone_id],
  );

  z.proyectos = await many(
    `SELECT ps.*, o.name AS org_name
       FROM project_summary ps JOIN organizations o ON o.id = ps.org_id
      WHERE ps.zone_id = $1 ORDER BY ps.name`,
    [z.zone_id],
  );

  return z;
}

/** Los cuatro números del hero de la portada. */
export async function indicadoresGlobales() {
  return one(`
    SELECT
      (SELECT COUNT(*)::int FROM sightings WHERE status = 'verificado')      AS reportes_verificados,
      -- Quien reportó al menos una vez, con cualquier rol: el admin y las
      -- organizaciones también salen al agua.
      (SELECT COUNT(DISTINCT user_id)::int FROM sightings)                   AS ciudadanos,
      (SELECT COALESCE(SUM(hectares), 0)::numeric(12,2) FROM projects)       AS hectareas_en_restauracion,
      (SELECT COALESCE(SUM(tons_co2), 0)::numeric(12,3) FROM carbon_credits
        WHERE status = 'certificado')                                        AS tco2_certificado,
      (SELECT ROUND(AVG(health_index), 1) FROM zone_health)                  AS salud_promedio,
      (SELECT COUNT(*)::int FROM zones)                                      AS zonas
  `);
}

export async function especies() {
  return many(
    `SELECT sp.*, COUNT(s.id)::int AS avistamientos
       FROM species sp
       LEFT JOIN sightings s ON s.species_id = sp.id AND s.status = 'verificado'
      GROUP BY sp.id
      ORDER BY sp.is_key_species DESC, sp.common_name`,
  );
}

export async function zonasSimples() {
  return many('SELECT id, slug, name, province, center_lat, center_lng FROM zones ORDER BY name');
}

/** Tabla de posiciones de la comunidad. */
export async function ranking(limite = 10) {
  return many(
    `SELECT full_name, balance_okn, reportes, reportes_verificados, reputation, streak_days
       FROM user_balances
      WHERE reportes > 0
      ORDER BY balance_okn DESC
      LIMIT $1`,
    [limite],
  );
}

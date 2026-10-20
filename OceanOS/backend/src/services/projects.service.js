import { many, one, transaction } from '../db/index.js';
import { badRequest, forbidden, notFound } from '../utils/errors.js';

export async function listar(orgId) {
  return many(
    `SELECT ps.*, z.name AS zone_name, z.slug AS zone_slug
       FROM project_summary ps JOIN zones z ON z.id = ps.zone_id
      WHERE ps.org_id = $1 ORDER BY ps.name`,
    [orgId],
  );
}

export async function obtener(orgId, projectId) {
  const proyecto = await one(
    `SELECT ps.*, z.name AS zone_name, z.slug AS zone_slug, p.description,
            p.started_on, p.ends_on
       FROM project_summary ps
       JOIN projects p ON p.id = ps.project_id
       JOIN zones z ON z.id = ps.zone_id
      WHERE ps.project_id = $1 AND ps.org_id = $2`,
    [projectId, orgId],
  );
  if (!proyecto) throw notFound('Ese proyecto no existe en tu organización');

  proyecto.hitos_lista = await many(
    'SELECT * FROM project_milestones WHERE project_id = $1 ORDER BY position, due_on',
    [projectId],
  );
  proyecto.creditos = await many(
    'SELECT * FROM carbon_credits WHERE project_id = $1 ORDER BY vintage_year DESC',
    [projectId],
  );
  return proyecto;
}

/** Crea un proyecto respetando el tope de la suscripción. */
export async function crear(org, datos) {
  if (org.max_projects !== null) {
    const { total } = await one(
      'SELECT COUNT(*)::int AS total FROM projects WHERE org_id = $1', [org.id],
    );
    if (total >= org.max_projects) {
      throw forbidden(
        `El plan ${org.plan} permite ${org.max_projects} proyecto(s). Pasá a un plan superior para crear más.`,
      );
    }
  }

  const zona = await one('SELECT id FROM zones WHERE slug = $1', [datos.zoneSlug]);
  if (!zona) throw badRequest('Esa zona no existe');

  return one(
    `INSERT INTO projects (org_id, zone_id, name, description, status,
                           hectares, target_hectares, started_on, ends_on)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [org.id, zona.id, datos.name, datos.description ?? null, datos.status ?? 'planificado',
     datos.hectares ?? 0, datos.targetHectares ?? null, datos.startedOn ?? null, datos.endsOn ?? null],
  );
}

export async function actualizar(orgId, projectId, datos) {
  const campos = [];
  const params = [];
  const asignar = (columna, valor) => {
    if (valor === undefined) return;
    params.push(valor);
    campos.push(`${columna} = $${params.length}`);
  };

  asignar('name', datos.name);
  asignar('description', datos.description);
  asignar('status', datos.status);
  asignar('hectares', datos.hectares);
  asignar('target_hectares', datos.targetHectares);
  asignar('started_on', datos.startedOn);
  asignar('ends_on', datos.endsOn);

  if (!campos.length) throw badRequest('No mandaste ningún cambio');

  params.push(projectId, orgId);
  const proyecto = await one(
    `UPDATE projects SET ${campos.join(', ')}
      WHERE id = $${params.length - 1} AND org_id = $${params.length}
      RETURNING *`,
    params,
  );
  if (!proyecto) throw notFound('Ese proyecto no existe en tu organización');
  return proyecto;
}

export async function agregarHito(orgId, projectId, { title, dueOn }) {
  const proyecto = await one(
    'SELECT id FROM projects WHERE id = $1 AND org_id = $2', [projectId, orgId],
  );
  if (!proyecto) throw notFound('Ese proyecto no existe en tu organización');

  const { siguiente } = await one(
    'SELECT COALESCE(MAX(position) + 1, 0) AS siguiente FROM project_milestones WHERE project_id = $1',
    [projectId],
  );
  return one(
    `INSERT INTO project_milestones (project_id, title, due_on, position)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [projectId, title, dueOn ?? null, siguiente],
  );
}

export async function marcarHito(orgId, milestoneId, hecho) {
  const hito = await one(
    `UPDATE project_milestones m
        SET done_on = CASE WHEN $3 THEN CURRENT_DATE ELSE NULL END
       FROM projects p
      WHERE m.id = $1 AND m.project_id = p.id AND p.org_id = $2
      RETURNING m.*`,
    [milestoneId, orgId, hecho],
  );
  if (!hito) throw notFound('Ese hito no existe en tu organización');
  return hito;
}

/** Panel en tiempo real de la organización. */
export async function panel(orgId) {
  const resumen = await one(
    `SELECT COUNT(*)::int                                    AS proyectos,
            COUNT(*) FILTER (WHERE status = 'en_curso')::int AS en_curso,
            COALESCE(SUM(hectares), 0)::numeric(12,2)        AS hectareas,
            COALESCE(SUM(target_hectares), 0)::numeric(12,2) AS hectareas_objetivo
       FROM projects WHERE org_id = $1`,
    [orgId],
  );

  const carbono = await one(
    `SELECT COALESCE(SUM(c.tons_co2) FILTER (WHERE c.status = 'certificado'), 0)::numeric(12,3)   AS certificado,
            COALESCE(SUM(c.tons_co2) FILTER (WHERE c.status = 'en_validacion'), 0)::numeric(12,3) AS en_validacion
       FROM carbon_credits c JOIN projects p ON p.id = c.project_id
      WHERE p.org_id = $1`,
    [orgId],
  );

  const zonas = await many(
    `SELECT DISTINCT h.zone_id, h.slug, h.name, h.health_index,
            h.kelp_cobertura_pct, h.avistamientos_tiburon, h.amenazas_abiertas
       FROM projects p JOIN zone_health h ON h.zone_id = p.zone_id
      WHERE p.org_id = $1 ORDER BY h.health_index DESC`,
    [orgId],
  );

  const alertas = await many(
    `SELECT s.id, s.kind, s.notes, s.lat, s.lng, s.observed_at, s.status,
            z.name AS zone_name, sp.common_name
       FROM sightings s
       JOIN zones z ON z.id = s.zone_id
       LEFT JOIN species sp ON sp.id = s.species_id
      WHERE s.kind = 'amenaza'
        AND s.status <> 'rechazado'
        AND s.zone_id IN (SELECT zone_id FROM projects WHERE org_id = $1)
        AND s.observed_at >= now() - interval '90 days'
      ORDER BY s.observed_at DESC LIMIT 10`,
    [orgId],
  );

  const hitosProximos = await many(
    `SELECT m.id, m.title, m.due_on, p.name AS project_name
       FROM project_milestones m JOIN projects p ON p.id = m.project_id
      WHERE p.org_id = $1 AND m.done_on IS NULL
      ORDER BY m.due_on NULLS LAST LIMIT 8`,
    [orgId],
  );

  return { resumen, carbono, zonas, alertas, hitosProximos };
}

/** Series de sensores para los gráficos del panel. Requiere plan con IoT. */
export async function sensores(org) {
  if (!org.has_iot) {
    throw forbidden(`El monitoreo IoT está disponible desde el plan Professional. Tu plan es ${org.plan}.`);
  }
  const lista = await many(
    `SELECT s.*, z.name AS zone_name, p.name AS project_name
       FROM sensors s
       JOIN zones z ON z.id = s.zone_id
       LEFT JOIN projects p ON p.id = s.project_id
      WHERE s.zone_id IN (SELECT zone_id FROM projects WHERE org_id = $1)
      ORDER BY s.code`,
    [org.id],
  );

  const series = await many(
    `SELECT r.sensor_id, r.metric, r.unit,
            date_trunc('day', r.read_at)::date AS dia,
            ROUND(AVG(r.value), 2)             AS valor
       FROM sensor_readings r
      WHERE r.sensor_id = ANY($1::uuid[])
        AND r.read_at >= now() - interval '30 days'
      GROUP BY r.sensor_id, r.metric, r.unit, dia
      ORDER BY dia`,
    [lista.map((s) => s.id)],
  );

  return { sensores: lista, series };
}

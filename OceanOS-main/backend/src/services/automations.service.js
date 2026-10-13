import { many } from '../db/index.js';

/**
 * Flujo de n8n entregado con el MER.
 *
 *   webhook (alta del avistamiento)
 *     └─ triage lógico: ¿confianza de la IA por encima del umbral y
 *        especie amenazada?
 *          ├─ sí  → aviso por WhatsApp a la ONG o al área protegida
 *          └─ no  → acreditación de tokens (cuando la comunidad verifica)
 *                     └─ correo al usuario
 *
 * Acá no corre n8n: lo que el sistema sostiene es el registro de disparos,
 * la tabla puente entre el reporte y el flujo que ejecutó.
 *
 * El umbral llega por parámetro y no se importa de sightings.service.js
 * para no armar un ciclo entre los dos módulos: la fuente sigue siendo
 * UMBRA_IA, que es quien decide el estado del reporte.
 */
export const ESTADOS_AMENAZA = ['VU', 'EN', 'CR'];

/** Registra un disparo buscando el flujo por su slug. */
function disparar(cliente, { sightingId, userId, slug, estado = 'exito', detalle = null }) {
  return cliente.query(
    `INSERT INTO n8n_trigger_log (user_id, sighting_id, workflow_id, run_status, detail)
     SELECT $1, $2, w.id, $3, $4 FROM n8n_workflows w WHERE w.slug = $5 AND w.is_active`,
    [userId, sightingId, estado, detalle, slug],
  );
}

/** Los dos primeros nodos y la rama que elige el triage. */
export async function flujoDeAlta(cliente, avistamiento, { umbral }) {
  const comun = { sightingId: avistamiento.id, userId: avistamiento.user_id };

  await disparar(cliente, { ...comun, slug: 'webhook_avistamiento', detalle: 'Alta recibida' });
  await disparar(cliente, {
    ...comun,
    slug: 'triage_confianza',
    detalle: avistamiento.ai_confidence != null
      ? `Confianza ${Math.round(avistamiento.ai_confidence * 100)}%`
      : 'Sin clasificar',
  });

  // Rama verdadera. La condición se evalúa en la misma consulta que
  // inserta: si no se cumple, no inserta nada y no hay que traer la
  // especie ni la zona para decidirlo del lado de Node.
  await cliente.query(
    `INSERT INTO n8n_trigger_log (user_id, sighting_id, workflow_id, run_status, detail)
     SELECT s.user_id, s.id, w.id, 'exito',
            'Aviso enviado por ' || z.name || ' · ' || sp.common_name || ' (' || sp.iucn_status || ')'
       FROM sightings s
       JOIN species sp ON sp.id = s.species_id
       JOIN zones z    ON z.id  = s.zone_id
      CROSS JOIN n8n_workflows w
      WHERE s.id = $1 AND w.slug = 'alerta_ong' AND w.is_active
        AND s.ai_confidence > $2
        AND sp.iucn_status = ANY($3)`,
    [avistamiento.id, umbral, ESTADOS_AMENAZA],
  );

  if (avistamiento.status === 'verificado') {
    await flujoDeAcreditacion(cliente, avistamiento);
  } else {
    await disparar(cliente, {
      ...comun, slug: 'acreditacion_okn', estado: 'omitido',
      detalle: 'A la espera de que la comunidad resuelva la votación',
    });
  }
}

/** La rama que paga: corre cuando el reporte ya quedó verificado. */
export async function flujoDeAcreditacion(cliente, avistamiento) {
  const comun = { sightingId: avistamiento.id, userId: avistamiento.user_id };
  await disparar(cliente, { ...comun, slug: 'acreditacion_okn', detalle: 'Saldo actualizado' });
  await disparar(cliente, { ...comun, slug: 'aviso_usuario', detalle: 'Correo enviado al usuario' });
}

/** Los flujos con su cuenta de corridas, para el panel. */
export async function flujos() {
  return many(
    `SELECT w.id, w.slug, w.process_name, w.node_kind, w.step_order, w.description,
            COUNT(l.id)::int                                            AS corridas,
            COUNT(l.id) FILTER (WHERE l.run_status = 'omitido')::int    AS omitidas,
            MAX(l.triggered_at)                                         AS ultima
       FROM n8n_workflows w
       LEFT JOIN n8n_trigger_log l ON l.workflow_id = w.id
      WHERE w.is_active
      GROUP BY w.id
      ORDER BY w.step_order, w.slug`,
  );
}

/** Últimos disparos, con el reporte y el usuario que los originaron. */
export async function registro(limite = 40) {
  return many(
    `SELECT l.id, l.run_status, l.detail, l.triggered_at,
            w.process_name AS proceso, w.node_kind AS nodo,
            u.full_name    AS reportero, u.documento,
            sp.common_name AS especie, z.name AS zona, s.kind
       FROM n8n_trigger_log l
       JOIN n8n_workflows w ON w.id = l.workflow_id
       JOIN users u         ON u.id = l.user_id
       JOIN sightings s     ON s.id = l.sighting_id
       LEFT JOIN species sp ON sp.id = s.species_id
       LEFT JOIN zones z    ON z.id  = s.zone_id
      ORDER BY l.triggered_at DESC
      LIMIT $1`,
    [limite],
  );
}

import { many, one, transaction } from '../db/index.js';
import { badRequest, forbidden, notFound } from '../utils/errors.js';
import { flujoDeAlta, flujoDeAcreditacion } from './automations.service.js';

/**
 * Tabla de premios. Vive en un solo lugar para que la app, el libro mayor
 * y los tests no se desincronicen. Un reporte válido suma y la verificación
 * agrega un segundo premio por la calidad del dato.
 */
export const PREMIOS = {
  reporte_basico:   15,
  foto_verificada: 25,
  racha_semanal:   50,
  voto_comunidad:  10,
  zona_nueva:      100,
};

/** Por debajo de esta confianza, el reporte va a votación comunitaria. */
export const UMBRAL_IA = 0.80;

/** Votos necesarios para resolver un reporte en votación. */
export const VOTOS_PARA_RESOLVER = 3;

/** Sin reportes en la zona durante estos días, el próximo cobra zona_nueva. */
export const DIAS_ZONA_NUEVA = 30;

/** Cada cuántos días seguidos de racha se cobra racha_semanal. */
export const DIAS_BONO_RACHA = 7;

/** Cuánto se mueve la reputación del autor cuando se resuelve una votación. */
export const REPUTACION = { subeSiVerificado: 5, bajaSiRechazado: 10, maxima: 1000 };

const SELECT_BASE = `
  SELECT s.id, s.kind, s.lat, s.lng, s.depth_m, s.individuals, s.kelp_cover_pct,
         s.photo_url, s.ai_confidence, s.ai_label, s.notes, s.status,
         s.observed_at, s.created_at,
         z.slug AS zone_slug, z.name AS zone_name,
         u.full_name AS reporter_name,
         sp.common_name, sp.scientific_name, sp.iucn_status
    FROM sightings s
    JOIN zones z ON z.id = s.zone_id
    JOIN users u ON u.id = s.user_id
    LEFT JOIN species sp ON sp.id = s.species_id`;

export async function listar({ zoneSlug, kind, status, desde, limite = 200 }) {
  const condiciones = [];
  const params = [];

  if (zoneSlug) { params.push(zoneSlug); condiciones.push(`z.slug = $${params.length}`); }
  if (kind)     { params.push(kind);     condiciones.push(`s.kind = $${params.length}`); }
  if (status)   { params.push(status);   condiciones.push(`s.status = $${params.length}`); }
  if (desde)    { params.push(desde);    condiciones.push(`s.observed_at >= $${params.length}`); }

  params.push(Math.min(limite, 500));
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  return many(`${SELECT_BASE} ${where} ORDER BY s.observed_at DESC LIMIT $${params.length}`, params);
}

export async function obtener(id) {
  const avistamiento = await one(`${SELECT_BASE} WHERE s.id = $1`, [id]);
  if (!avistamiento) throw notFound('Ese avistamiento no existe');

  avistamiento.votos = await many(
    `SELECT v.agrees, v.weight, u.full_name, v.created_at
       FROM sighting_votes v JOIN users u ON u.id = v.user_id
      WHERE v.sighting_id = $1 ORDER BY v.created_at`,
    [id],
  );
  return avistamiento;
}

/**
 * Crea un avistamiento y acredita los tokens que corresponden, todo en
 * una transacción: si falla el libro mayor, no queda el reporte huérfano.
 */
export async function crear(userId, datos) {
  const zona = await one('SELECT id, slug FROM zones WHERE slug = $1', [datos.zoneSlug]);
  if (!zona) throw badRequest('Esa zona no existe');

  if (datos.kind === 'kelp' && datos.kelpCoverPct == null) {
    throw badRequest('Un reporte de kelp necesita el porcentaje de cobertura');
  }

  const confianza = datos.aiConfidence ?? null;
  const estado = confianza === null ? 'pendiente'
    : confianza >= UMBRAL_IA ? 'verificado' : 'en_votacion';

  return transaction(async (cliente) => {
    const { rows: [avistamiento] } = await cliente.query(
      `INSERT INTO sightings
         (zone_id, user_id, species_id, kind, lat, lng, depth_m, individuals,
          kelp_cover_pct, photo_url, ai_confidence, ai_label, notes, status,
          observed_at, resolved_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
               COALESCE($15, now()), $16)
       RETURNING *`,
      [zona.id, userId, datos.speciesId ?? null, datos.kind, datos.lat, datos.lng,
       datos.depthM ?? null, datos.individuals ?? null, datos.kelpCoverPct ?? null,
       datos.photoUrl ?? null, confianza, datos.aiLabel ?? null, datos.notes ?? null,
       estado, datos.observedAt ?? null,
       // Se resuelve acá y no con un CASE en SQL: reusar $14 como valor de
       // columna y dentro de una expresión deja el tipo ambiguo (42P08).
       estado === 'verificado' ? new Date() : null],
    );

    // El alta dispara el flujo de n8n, dentro de la misma transacción:
    // si el reporte no queda, el registro de disparos tampoco.
    await flujoDeAlta(cliente, avistamiento, { umbral: UMBRAL_IA });

    const movimientos = [['reporte_basico', PREMIOS.reporte_basico]];
    if (estado === 'verificado') movimientos.push(['foto_verificada', PREMIOS.foto_verificada]);

    // Zona nueva: nadie reportó ahí en los últimos 30 días (sin contar
    // este reporte, que ya está insertado).
    const { rows: [previo] } = await cliente.query(
      `SELECT 1 FROM sightings
        WHERE zone_id = $1 AND id <> $2 AND observed_at >= now() - make_interval(days => $3)
        LIMIT 1`,
      [zona.id, avistamiento.id, DIAS_ZONA_NUEVA],
    );
    if (!previo) movimientos.push(['zona_nueva', PREMIOS.zona_nueva]);

    // Los premios en 0 no se anotan: token_ledger exige amount <> 0 y la
    // transacción entera fallaría con el reporte básico.
    for (const [motivo, monto] of movimientos.filter(([, m]) => m > 0)) {
      await cliente.query(
        'INSERT INTO token_ledger (user_id, amount, reason, sighting_id) VALUES ($1,$2,$3,$4)',
        [userId, monto, motivo, avistamiento.id],
      );
    }

    // Racha: si el último reporte fue ayer, suma un día; si fue hoy, no
    // cambia; si fue antes, la racha vuelve a 1.
    const { rows: [usuario] } = await cliente.query(
      `UPDATE users SET
         streak_days = CASE
           WHEN last_report_on = CURRENT_DATE     THEN streak_days
           WHEN last_report_on = CURRENT_DATE - 1 THEN streak_days + 1
           ELSE 1 END,
         last_report_on = CURRENT_DATE
       WHERE id = $1 RETURNING streak_days, last_report_on`,
      [userId],
    );

    // Bono de racha cada 7 días completos, una sola vez por día.
    let bonoRacha = 0;
    if (usuario.streak_days > 0 && usuario.streak_days % DIAS_BONO_RACHA === 0) {
      const { rows: [yaCobrado] } = await cliente.query(
        `SELECT 1 FROM token_ledger
          WHERE user_id = $1 AND reason = 'racha_semanal'
            AND created_at::date = CURRENT_DATE LIMIT 1`,
        [userId],
      );
      if (!yaCobrado) {
        await cliente.query(
          `INSERT INTO token_ledger (user_id, amount, reason, detail)
           VALUES ($1,$2,'racha_semanal',$3)`,
          [userId, PREMIOS.racha_semanal, `Racha de ${usuario.streak_days} días`],
        );
        bonoRacha = PREMIOS.racha_semanal;
      }
    }

    const ganado = movimientos.reduce((total, [, monto]) => total + monto, 0) + bonoRacha;
    return { avistamiento, tokensGanados: ganado, racha: usuario.streak_days };
  });
}

/** Cola de reportes esperando votación, sin incluir los propios. */
export async function colaDeVerificacion(userId, limite = 20) {
  return many(
    `${SELECT_BASE}
      WHERE s.status = 'en_votacion'
        AND s.user_id <> $1
        AND NOT EXISTS (SELECT 1 FROM sighting_votes v
                         WHERE v.sighting_id = s.id AND v.user_id = $1)
      ORDER BY s.observed_at ASC
      LIMIT $2`,
    [userId, limite],
  );
}

/**
 * Registra un voto. Al llegar a 3 votos, resuelve el reporte por mayoría
 * ponderada por reputación del votante.
 */
export async function votar(userId, sightingId, { agrees, speciesId }) {
  return transaction(async (cliente) => {
    const { rows: [avistamiento] } = await cliente.query(
      'SELECT * FROM sightings WHERE id = $1 FOR UPDATE',
      [sightingId],
    );
    if (!avistamiento) throw notFound('Ese avistamiento no existe');
    if (avistamiento.status !== 'en_votacion') throw badRequest('Ese reporte ya está resuelto');
    if (avistamiento.user_id === userId) throw forbidden('No podés votar tu propio reporte');

    const { rows: [votante] } = await cliente.query(
      'SELECT reputation FROM users WHERE id = $1', [userId],
    );

    try {
      await cliente.query(
        `INSERT INTO sighting_votes (sighting_id, user_id, agrees, species_id, weight)
         VALUES ($1,$2,$3,$4,$5)`,
        [sightingId, userId, agrees, speciesId ?? null, votante.reputation],
      );
    } catch (error) {
      if (error.code === '23505') throw badRequest('Ya votaste este reporte');
      throw error;
    }

    await cliente.query(
      `INSERT INTO token_ledger (user_id, amount, reason, sighting_id)
       VALUES ($1,$2,'voto_comunidad',$3)`,
      [userId, PREMIOS.voto_comunidad, sightingId],
    );

    const { rows: [conteo] } = await cliente.query(
      `SELECT COUNT(*)::int AS total,
              COALESCE(SUM(weight) FILTER (WHERE agrees), 0)::int     AS peso_a_favor,
              COALESCE(SUM(weight) FILTER (WHERE NOT agrees), 0)::int AS peso_en_contra
         FROM sighting_votes WHERE sighting_id = $1`,
      [sightingId],
    );

    let resuelto = null;
    if (conteo.total >= VOTOS_PARA_RESOLVER) {
      resuelto = conteo.peso_a_favor >= conteo.peso_en_contra ? 'verificado' : 'rechazado';
      await cliente.query(
        'UPDATE sightings SET status = $1, resolved_at = now() WHERE id = $2',
        [resuelto, sightingId],
      );

      // El autor cobra la verificación solo si el reporte quedó validado.
      if (resuelto === 'verificado') {
        await cliente.query(
          `INSERT INTO token_ledger (user_id, amount, reason, sighting_id)
           VALUES ($1,$2,'foto_verificada',$3)`,
          [avistamiento.user_id, PREMIOS.foto_verificada, sightingId],
        );
        await cliente.query(
          'UPDATE users SET reputation = LEAST(reputation + $2, $3) WHERE id = $1',
          [avistamiento.user_id, REPUTACION.subeSiVerificado, REPUTACION.maxima],
        );
        await flujoDeAcreditacion(cliente, avistamiento);
      } else {
        await cliente.query(
          'UPDATE users SET reputation = GREATEST(reputation - $2, 0) WHERE id = $1',
          [avistamiento.user_id, REPUTACION.bajaSiRechazado],
        );
      }
    }

    return { votos: conteo.total, resuelto, tokensGanados: PREMIOS.voto_comunidad };
  });
}

/**
 * Las vistas calculadas de 001_init.sql, en JavaScript. Mismo principio
 * que en la base: ninguna métrica se guarda a mano, todo se deriva de los
 * hechos cada vez que se pide. Por eso un reporte nuevo mueve el índice de
 * salud de la zona sin que nadie lo actualice.
 */
import { DIA, aleatorio, redondear } from './semilla.js';

export const porId = (lista, id) => lista.find((fila) => fila.id === id) ?? null;
export const suma = (lista, campo) => lista.reduce((total, fila) => total + Number(fila[campo] ?? 0), 0);
export const dentroDe = (iso, dias) => Date.now() - new Date(iso).getTime() <= dias * DIA;

/** user_balances: el saldo es la suma del libro mayor, nunca un campo. */
export function saldo(e, userId) {
  const u = porId(e.usuarios, userId);
  const movimientos = e.libro.filter((l) => l.user_id === userId);
  const reportes = e.avistamientos.filter((s) => s.user_id === userId);
  return {
    user_id: userId,
    full_name: u.full_name,
    reputation: u.reputation,
    streak_days: u.streak_days,
    balance_okn: suma(movimientos, 'amount'),
    ganados_okn: suma(movimientos.filter((l) => l.amount > 0), 'amount'),
    reportes: reportes.length,
    reportes_verificados: reportes.filter((s) => s.status === 'verificado').length,
  };
}

/**
 * zone_health: índice de 0 a 100 sobre una ventana de 90 días.
 *   50% cobertura media de kelp verificado
 *   30% tiburones verificados (normalizado a 20 avistamientos)
 *   20% ausencia de amenazas no rechazadas
 */
export function saludZona(e, zona) {
  const recientes = e.avistamientos.filter((s) => s.zone_id === zona.id && dentroDe(s.observed_at, 90));

  const kelp = recientes.filter((s) => s.kind === 'kelp' && s.status === 'verificado' && s.kelp_cover_pct != null);
  const cobertura = kelp.length ? suma(kelp, 'kelp_cover_pct') / kelp.length : 0;
  const tiburones = recientes.filter((s) => s.kind === 'tiburon' && s.status === 'verificado').length;
  const amenazas = recientes.filter((s) => s.kind === 'amenaza' && s.status !== 'rechazado').length;

  return {
    zone_id: zona.id,
    slug: zona.slug,
    name: zona.name,
    kelp_cobertura_pct: redondear(cobertura, 1),
    avistamientos_tiburon: tiburones,
    amenazas_abiertas: amenazas,
    health_index: redondear(
      0.5 * Math.min(cobertura, 100)
      + 0.3 * Math.min(tiburones * 5, 100)
      + 0.2 * Math.max(100 - amenazas * 10, 0),
      1,
    ),
  };
}

/** zone_health unida a los datos geográficos de la zona. */
export function saludConZona(e, zona) {
  return {
    ...saludZona(e, zona),
    center_lat: zona.center_lat, center_lng: zona.center_lng,
    min_lat: zona.min_lat, max_lat: zona.max_lat, min_lng: zona.min_lng, max_lng: zona.max_lng,
    area_km2: zona.area_km2, is_protected: zona.is_protected, province: zona.province,
  };
}

/** project_summary: hectáreas, avance, hitos y carbono de un proyecto. */
export function resumenProyecto(e, p) {
  const hitos = e.hitos.filter((h) => h.project_id === p.id);
  const creditos = e.creditos.filter((c) => c.project_id === p.id);
  return {
    project_id: p.id,
    org_id: p.org_id,
    zone_id: p.zone_id,
    name: p.name,
    status: p.status,
    hectares: p.hectares,
    target_hectares: p.target_hectares,
    avance_pct: Number(p.target_hectares) > 0 ? redondear((p.hectares / p.target_hectares) * 100, 1) : null,
    hitos: hitos.length,
    hitos_cumplidos: hitos.filter((h) => h.done_on).length,
    tco2_certificado: redondear(suma(creditos.filter((c) => c.status === 'certificado'), 'tons_co2'), 3),
    tco2_en_validacion: redondear(suma(creditos.filter((c) => c.status === 'en_validacion'), 'tons_co2'), 3),
  };
}

/** La fila de avistamiento que devuelve la API: el SELECT_BASE del servicio. */
export function filaAvistamiento(e, s) {
  const zona = porId(e.zonas, s.zone_id);
  const especie = porId(e.especies, s.species_id);
  return {
    id: s.id, kind: s.kind, lat: s.lat, lng: s.lng, depth_m: s.depth_m, individuals: s.individuals,
    kelp_cover_pct: s.kelp_cover_pct, photo_url: s.photo_url, ai_confidence: s.ai_confidence,
    ai_label: s.ai_label, notes: s.notes, status: s.status,
    observed_at: s.observed_at, created_at: s.created_at,
    zone_slug: zona.slug, zone_name: zona.name,
    reporter_name: porId(e.usuarios, s.user_id)?.full_name ?? '—',
    common_name: especie?.common_name ?? null,
    scientific_name: especie?.scientific_name ?? null,
    iucn_status: especie?.iucn_status ?? null,
  };
}

/** Lo mismo que devuelve GET /auth/yo en la API real. */
export function perfil(e, userId) {
  const u = porId(e.usuarios, userId);
  const zona = porId(e.zonas, u.home_zone_id);
  const b = saldo(e, userId);
  return {
    id: u.id, email: u.email, full_name: u.full_name, role: u.role, home_zone_id: u.home_zone_id,
    reputation: u.reputation, streak_days: u.streak_days, created_at: u.created_at,
    balance_okn: b.balance_okn, ganados_okn: b.ganados_okn,
    reportes: b.reportes, reportes_verificados: b.reportes_verificados,
    home_zone_slug: zona?.slug ?? null, home_zone_name: zona?.name ?? null,
    organizaciones: [],
  };
}

/** Lunes de la semana, a medianoche local: el date_trunc('week') de Postgres. */
export function inicioDeSemana(iso) {
  const d = new Date(iso);
  const desdeLunes = (d.getDay() + 6) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - desdeLunes).toISOString();
}

const METRICAS = {
  temperatura: '°C', salinidad: 'PSU', biomasa: 'kg/m²', turbidez: 'NTU', oxigeno: 'mg/L', ph: 'pH',
};

/**
 * Lecturas diarias de los últimos 30 días, con las fórmulas del seed.
 * Dos cambios para que el gráfico cuente algo:
 *   - la biomasa crece hacia hoy (en el seed crecía hacia el pasado, o sea
 *     que un proyecto de restauración mostraba el bosque achicándose);
 *   - cada sensor tiene un corrimiento según su profundidad, para que las
 *     líneas no queden encimadas.
 */
export function lecturas(sensor) {
  const azar = aleatorio([...sensor.code].reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
  const ruido = (amplitud) => (azar() - 0.5) * amplitud;
  const hondura = (Number(sensor.depth_m) || 15) - 15;
  const hoy = new Date();
  const filas = [];

  for (let n = 29; n >= 0; n--) {
    const dia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - n).toISOString();
    const valores = {
      temperatura: 12.5 + 2.4 * Math.sin(n / 5) - hondura * 0.06 + ruido(0.6),
      salinidad:   33.6 + 0.4 * Math.cos(n / 7) + hondura * 0.01 + ruido(0.2),
      biomasa:     4.1 + 0.9 * ((29 - n) / 30) - Math.abs(hondura) * 0.03 + ruido(0.3),
      turbidez:    2.2 + 0.8 * Math.sin(n / 3) - hondura * 0.04 + ruido(0.4),
      oxigeno:     7.8 + 0.5 * Math.cos(n / 6) - hondura * 0.02 + ruido(0.2),
      ph:          8.05 + 0.1 * Math.sin(n / 9) - hondura * 0.002,
    };
    for (const [metric, valor] of Object.entries(valores)) {
      filas.push({ sensor_id: sensor.id, metric, unit: METRICAS[metric], dia, valor: redondear(valor, 2) });
    }
  }
  return filas;
}

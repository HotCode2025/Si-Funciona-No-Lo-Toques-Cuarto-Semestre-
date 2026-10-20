/**
 * Servidor de demostración: la API de OceanOS corriendo dentro del
 * navegador, sin PostgreSQL y sin sesión.
 *
 * Cada ruta replica su par de backend/src/routes y cada regla de negocio
 * la de backend/src/services: premios en tokens, racha, zona nueva,
 * votación ponderada por reputación, canjes con stock, órdenes que no
 * sobrevenden. La única diferencia de fondo es que acá no hay login: la
 * app ciudadana siempre la usa la PERSONA de la semilla, y el panel deja
 * elegir cualquiera de las tres organizaciones.
 *
 * Los planes no limitan nada: la demo es la versión gratis con todo
 * abierto, así que no hay tope de proyectos ni bloqueo de sensores.
 *
 * El estado se guarda en sessionStorage: sobrevive a recargar la página,
 * y cada pestaña nueva arranca con los datos frescos de la semilla.
 */
import { crearSemilla, VERSION, PERSONA_ID, DIA, claveDia, fechaLocal, nuevoId, redondear } from './semilla.js';
import {
  porId, suma, dentroDe, saldo, saludZona, saludConZona, resumenProyecto,
  filaAvistamiento, perfil, inicioDeSemana, lecturas,
} from './vistas.js';
import { badRequest, forbidden, notFound } from '../errores.js';

// Los mismos valores que backend/src/services/sightings.service.js y el
// documento fundacional del MVP. Un reporte válido suma y la verificación
// agrega un segundo premio por la calidad del dato.
const PREMIOS = {
  reporte_basico:   15,
  foto_verificada: 25,
  racha_semanal:   50,
  voto_comunidad:  10,
  zona_nueva:      100,
};
const UMBRAL_IA = 0.8;
const VOTOS_PARA_RESOLVER = 3;
const DIAS_ZONA_NUEVA = 30;
const DIAS_BONO_RACHA = 7;
const REPUTACION = { subeSiVerificado: 5, bajaSiRechazado: 10, maxima: 1000 };
const TIPOS = ['tiburon', 'kelp', 'fauna', 'amenaza'];
const ESTADOS_PROYECTO = ['planificado', 'en_curso', 'monitoreo', 'finalizado', 'suspendido'];

// ---------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------
const CLAVE = 'oceanos-demo';

let e = cargar();

function cargar() {
  try {
    const guardado = JSON.parse(sessionStorage.getItem(CLAVE));
    if (guardado?.version === VERSION) return guardado;
  } catch {
    // Sin almacenamiento (modo privado, bloqueado): se trabaja en memoria.
  }
  return crearSemilla();
}

function guardar() {
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify(e));
  } catch {
    // Si no se puede guardar, la demo sigue andando; solo no sobrevive a un F5.
  }
}

/** Vuelve todo a la semilla: borra reportes, votos, canjes y compras hechos. */
export function reiniciarDemo() {
  e = crearSemilla();
  try { sessionStorage.removeItem(CLAVE); } catch { /* idem */ }
}

// ---------------------------------------------------------------------
// Enrutador
// ---------------------------------------------------------------------
const rutas = [];

function ruta(metodo, patron, manejador) {
  const claves = [];
  const regex = new RegExp(`^${patron.replace(/:(\w+)/g, (_, clave) => { claves.push(clave); return '([^/]+)'; })}$`);
  rutas.push({ metodo, regex, claves, manejador });
}
const get   = (patron, manejador) => ruta('GET', patron, manejador);
const post  = (patron, manejador) => ruta('POST', patron, manejador);
const patch = (patron, manejador) => ruta('PATCH', patron, manejador);

/**
 * Atiende un pedido con la misma forma que fetch a /api. Devuelve una
 * copia profunda: ninguna página recibe una referencia al estado, así no
 * lo puede modificar por accidente.
 */
export async function atender(metodo, rutaCompleta, cuerpo) {
  const [camino, consulta = ''] = rutaCompleta.split('?');
  const r = rutas.find((x) => x.metodo === metodo && x.regex.test(camino));
  if (!r) throw notFound('Esa función todavía no está en la demostración');

  const valores = camino.match(r.regex).slice(1).map(decodeURIComponent);
  const params = Object.fromEntries(r.claves.map((clave, i) => [clave, valores[i]]));
  const query = Object.fromEntries(new URLSearchParams(consulta));

  // Todo manejador valida antes de tocar el estado: si tira un error, no
  // queda nada a medio escribir, igual que con la transacción en Postgres.
  const resultado = r.manejador({ params, query, body: cuerpo ?? {} });
  if (metodo !== 'GET') guardar();
  return resultado == null ? null : JSON.parse(JSON.stringify(resultado));
}

// ---------------------------------------------------------------------
// Ayudas
// ---------------------------------------------------------------------
const ahora = () => new Date().toISOString();
const recientePrimero = (a, b) => b.observed_at.localeCompare(a.observed_at);
const porNombre = (a, b) => a.name.localeCompare(b.name, 'es');

function acreditar(user_id, amount, reason, extra = {}) {
  e.libro.push({ id: nuevoId(), user_id, amount, reason, sighting_id: null, detail: null, created_at: ahora(), ...extra });
}

function organizacion(orgId) {
  const org = porId(e.organizaciones, orgId);
  if (!org) throw notFound('Esa organización no existe');
  return org;
}
const proyectosDe = (org) => e.proyectos.filter((p) => p.org_id === org.id);
const zonasDe = (org) => new Set(proyectosDe(org).map((p) => p.zone_id));

function proyectoDe(org, projectId) {
  const p = e.proyectos.find((x) => x.id === projectId && x.org_id === org.id);
  if (!p) throw notFound('Ese proyecto no existe en tu organización');
  return p;
}

function conZona(p) {
  const z = porId(e.zonas, p.zone_id);
  return { ...resumenProyecto(e, p), zone_name: z.name, zone_slug: z.slug };
}

// ---------------------------------------------------------------------
// Demo: quién está usando el sitio
// ---------------------------------------------------------------------
get('/demo/persona', () => ({ user: perfil(e, PERSONA_ID) }));

get('/demo/organizaciones', () => ({
  organizaciones: e.organizaciones.map(({ id, name, slug, kind, plan }) => ({ id, name, slug, kind, plan })),
}));

// ---------------------------------------------------------------------
// Capa 2 pública · /ecosistema
// ---------------------------------------------------------------------
get('/ecosistema/indicadores', () => {
  const salud = e.zonas.map((z) => saludZona(e, z));
  return {
    indicadores: {
      reportes_verificados: e.avistamientos.filter((s) => s.status === 'verificado').length,
      // Quién reportó al menos una vez, tenga el rol que tenga: el admin y
      // las organizaciones también salen al agua.
      ciudadanos: new Set(e.avistamientos.map((s) => s.user_id)).size,
      hectareas_en_restauracion: redondear(suma(e.proyectos, 'hectares'), 2),
      tco2_certificado: redondear(suma(e.creditos.filter((c) => c.status === 'certificado'), 'tons_co2'), 3),
      salud_promedio: redondear(suma(salud, 'health_index') / salud.length, 1),
      zonas: e.zonas.length,
    },
  };
});

get('/ecosistema/zonas', () => ({
  zonas: e.zonas.map((z) => saludConZona(e, z)).sort((a, b) => b.health_index - a.health_index),
}));

get('/ecosistema/especies', () => ({
  especies: e.especies
    .map((sp) => ({
      ...sp,
      avistamientos: e.avistamientos.filter((s) => s.species_id === sp.id && s.status === 'verificado').length,
    }))
    .sort((a, b) => (b.is_key_species - a.is_key_species) || a.common_name.localeCompare(b.common_name, 'es')),
}));

get('/ecosistema/ranking', () => ({
  ranking: e.usuarios
    .map((u) => saldo(e, u.id))
    .filter((b) => b.reportes > 0)
    .sort((a, b) => b.balance_okn - a.balance_okn)
    .slice(0, 10)
    .map(({ full_name, balance_okn, reportes, reportes_verificados, reputation, streak_days }) =>
      ({ full_name, balance_okn, reportes, reportes_verificados, reputation, streak_days })),
}));

get('/ecosistema/zonas/:slug', ({ params }) => {
  const zona = e.zonas.find((z) => z.slug === params.slug);
  if (!zona) throw notFound('Esa zona no existe');
  const z = saludConZona(e, zona);
  const deLaZona = e.avistamientos.filter((s) => s.zone_id === zona.id && s.status === 'verificado');

  const semanas = new Map();
  for (const s of deLaZona) {
    if (s.kind !== 'kelp' || s.kelp_cover_pct == null || !dentroDe(s.observed_at, 180)) continue;
    const semana = inicioDeSemana(s.observed_at);
    if (!semanas.has(semana)) semanas.set(semana, []);
    semanas.get(semana).push(s);
  }
  z.serie_kelp = [...semanas]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([semana, filas]) => ({
      semana, cobertura: redondear(suma(filas, 'kelp_cover_pct') / filas.length, 1), reportes: filas.length,
    }));

  const porEspecie = new Map();
  for (const s of deLaZona) {
    if (!s.species_id) continue;
    const previo = porEspecie.get(s.species_id) ?? { avistamientos: 0, ultimo: s.observed_at };
    porEspecie.set(s.species_id, {
      avistamientos: previo.avistamientos + 1,
      ultimo: s.observed_at > previo.ultimo ? s.observed_at : previo.ultimo,
    });
  }
  z.especies = [...porEspecie]
    .map(([id, datos]) => {
      const sp = porId(e.especies, id);
      return { common_name: sp.common_name, scientific_name: sp.scientific_name, iucn_status: sp.iucn_status, kind: sp.kind, ...datos };
    })
    .sort((a, b) => b.avistamientos - a.avistamientos);

  z.proyectos = e.proyectos
    .filter((p) => p.zone_id === zona.id)
    .map((p) => ({ ...resumenProyecto(e, p), org_name: porId(e.organizaciones, p.org_id).name }))
    .sort(porNombre);

  return { zona: z };
});

// ---------------------------------------------------------------------
// Capa 1 · /avistamientos
// ---------------------------------------------------------------------
get('/avistamientos', ({ query }) => {
  let lista = e.avistamientos;
  if (query.zone) {
    const zona = e.zonas.find((z) => z.slug === query.zone);
    lista = lista.filter((s) => s.zone_id === zona?.id);
  }
  if (query.kind)   lista = lista.filter((s) => s.kind === query.kind);
  if (query.status) lista = lista.filter((s) => s.status === query.status);
  if (query.desde)  lista = lista.filter((s) => new Date(s.observed_at) >= new Date(query.desde));

  const limite = Math.min(Number(query.limite) || 200, 500);
  return { avistamientos: [...lista].sort(recientePrimero).slice(0, limite).map((s) => filaAvistamiento(e, s)) };
});

// Antes que /avistamientos/:id para que "cola" no se lea como un id.
get('/avistamientos/cola/verificacion', () => ({
  cola: e.avistamientos
    .filter((s) => s.status === 'en_votacion'
      && s.user_id !== PERSONA_ID
      && !e.votos.some((v) => v.sighting_id === s.id && v.user_id === PERSONA_ID))
    .sort((a, b) => a.observed_at.localeCompare(b.observed_at))
    .slice(0, 20)
    .map((s) => ({
      ...filaAvistamiento(e, s),
      // Extra de la demo: cuántos votos tiene, para mostrar cuál se resuelve.
      votos_emitidos: e.votos.filter((v) => v.sighting_id === s.id).length,
    })),
}));

get('/avistamientos/:id', ({ params }) => {
  const s = porId(e.avistamientos, params.id);
  if (!s) throw notFound('Ese avistamiento no existe');
  return {
    avistamiento: {
      ...filaAvistamiento(e, s),
      votos: e.votos
        .filter((v) => v.sighting_id === s.id)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((v) => ({ agrees: v.agrees, weight: v.weight, full_name: porId(e.usuarios, v.user_id).full_name, created_at: v.created_at })),
    },
  };
});

post('/avistamientos', ({ body }) => {
  const zona = e.zonas.find((z) => z.slug === body.zoneSlug);
  if (!zona) throw badRequest('Esa zona no existe');
  if (!TIPOS.includes(body.kind)) throw badRequest('Ese tipo de reporte no existe');
  if (!Number.isFinite(body.lat) || !Number.isFinite(body.lng)) throw badRequest('Marcá dónde fue');
  if (body.kind === 'kelp' && body.kelpCoverPct == null) {
    throw badRequest('Un reporte de kelp necesita el porcentaje de cobertura');
  }

  const confianza = body.aiConfidence ?? null;
  const estado = confianza === null ? 'pendiente' : confianza >= UMBRAL_IA ? 'verificado' : 'en_votacion';
  // Zona nueva: nadie reportó ahí en los últimos 30 días. Se mira antes
  // de insertar, que es lo mismo que excluir el reporte recién creado.
  const zonaNueva = !e.avistamientos.some((s) => s.zone_id === zona.id && dentroDe(s.observed_at, DIAS_ZONA_NUEVA));

  const creado = ahora();
  const avistamiento = {
    id: nuevoId(), zone_id: zona.id, user_id: PERSONA_ID,
    species_id: porId(e.especies, body.speciesId) ? body.speciesId : null,
    kind: body.kind, lat: body.lat, lng: body.lng,
    depth_m: body.depthM ?? null, individuals: body.individuals ?? null,
    kelp_cover_pct: body.kelpCoverPct ?? null, photo_url: body.photoUrl ?? null,
    ai_confidence: confianza, ai_label: body.aiLabel ?? null, notes: body.notes ?? null,
    status: estado, observed_at: body.observedAt ?? creado, created_at: creado,
    resolved_at: estado === 'verificado' ? creado : null,
  };
  e.avistamientos.push(avistamiento);
  correrFlujoAlta(avistamiento);

  // Los premios en 0 no se anotan: en la base, token_ledger exige
  // amount <> 0, y un movimiento de 0 tampoco le dice nada a nadie.
  const movimientos = [
    ['reporte_basico', PREMIOS.reporte_basico],
    estado === 'verificado' && ['foto_verificada', PREMIOS.foto_verificada],
    zonaNueva && ['zona_nueva', PREMIOS.zona_nueva],
  ].filter((movimiento) => movimiento && movimiento[1] > 0);
  for (const [motivo, monto] of movimientos) {
    acreditar(PERSONA_ID, monto, motivo, { sighting_id: avistamiento.id });
  }

  // Racha: si el último reporte fue ayer suma un día, si fue hoy no
  // cambia, si fue antes vuelve a 1.
  const u = porId(e.usuarios, PERSONA_ID);
  const hoy = claveDia();
  u.streak_days = u.last_report_on === hoy ? u.streak_days
    : u.last_report_on === claveDia(Date.now() - DIA) ? u.streak_days + 1 : 1;
  u.last_report_on = hoy;

  // Bono de racha cada DIAS_BONO_RACHA días completos, una sola vez por día.
  if (u.streak_days % DIAS_BONO_RACHA === 0
      && !e.libro.some((l) => l.user_id === u.id && l.reason === 'racha_semanal' && claveDia(l.created_at) === hoy)) {
    acreditar(u.id, PREMIOS.racha_semanal, 'racha_semanal', { detail: `Racha de ${u.streak_days} días` });
    movimientos.push(['racha_semanal', PREMIOS.racha_semanal]);
  }

  return {
    avistamiento: filaAvistamiento(e, avistamiento),
    tokensGanados: movimientos.reduce((total, [, monto]) => total + monto, 0),
    racha: u.streak_days,
    // Extra de la demo: de dónde sale cada token, para mostrarlo al enviar.
    desglose: movimientos.map(([motivo, monto]) => ({ motivo, monto })),
  };
});

post('/avistamientos/:id/voto', ({ params, body }) => {
  const s = porId(e.avistamientos, params.id);
  if (!s) throw notFound('Ese avistamiento no existe');
  if (s.status !== 'en_votacion') throw badRequest('Ese reporte ya está resuelto');
  if (s.user_id === PERSONA_ID) throw forbidden('No podés votar tu propio reporte');
  if (e.votos.some((v) => v.sighting_id === s.id && v.user_id === PERSONA_ID)) throw badRequest('Ya votaste este reporte');
  if (typeof body.agrees !== 'boolean') throw badRequest('Falta el voto');

  const votante = porId(e.usuarios, PERSONA_ID);
  e.votos.push({
    id: nuevoId(), sighting_id: s.id, user_id: PERSONA_ID, agrees: body.agrees,
    species_id: body.speciesId ?? null, weight: votante.reputation, created_at: ahora(),
  });
  acreditar(PERSONA_ID, PREMIOS.voto_comunidad, 'voto_comunidad', { sighting_id: s.id });

  const votos = e.votos.filter((v) => v.sighting_id === s.id);
  let resuelto = null;
  if (votos.length >= VOTOS_PARA_RESOLVER) {
    const aFavor = suma(votos.filter((v) => v.agrees), 'weight');
    const enContra = suma(votos.filter((v) => !v.agrees), 'weight');
    resuelto = aFavor >= enContra ? 'verificado' : 'rechazado';
    s.status = resuelto;
    s.resolved_at = ahora();

    // El autor cobra la verificación solo si el reporte quedó validado.
    const autor = porId(e.usuarios, s.user_id);
    if (resuelto === 'verificado') {
      acreditar(autor.id, PREMIOS.foto_verificada, 'foto_verificada', { sighting_id: s.id });
      correrFlujoAcreditacion(s);
      autor.reputation = Math.min(autor.reputation + REPUTACION.subeSiVerificado, REPUTACION.maxima);
    } else {
      autor.reputation = Math.max(autor.reputation - REPUTACION.bajaSiRechazado, 0);
    }
  }

  return { votos: votos.length, resuelto, tokensGanados: PREMIOS.voto_comunidad };
});

// ---------------------------------------------------------------------
// Automatización n8n
// El flujo entregado con el MER: el alta de un avistamiento dispara un
// webhook, un nodo de triage decide la rama y cada paso queda registrado.
// Acá no hay n8n de verdad corriendo; lo que se replica es el registro de
// disparos, que es lo que el modelo de datos tiene que sostener.
// ---------------------------------------------------------------------
const AMENAZADAS = new Set(['VU', 'EN', 'CR']);

function disparar(slug, avistamiento, run_status, detail) {
  const flujo = e.flujos?.find((f) => f.slug === slug);
  if (!flujo) return;
  (e.disparos ??= []).push({
    id: nuevoId(), user_id: avistamiento.user_id, sighting_id: avistamiento.id,
    workflow_id: flujo.id, run_status, detail, triggered_at: ahora(),
  });
}

/** Los dos primeros nodos y la rama del triage, al dar de alta un reporte. */
function correrFlujoAlta(avistamiento) {
  const conf = avistamiento.ai_confidence;
  const esp = porId(e.especies, avistamiento.species_id);
  const zona = porId(e.zonas, avistamiento.zone_id);

  disparar('webhook_avistamiento', avistamiento, 'exito', 'Alta recibida');
  disparar('triage_confianza', avistamiento, 'exito',
    conf != null ? `Confianza ${Math.round(conf * 100)}%` : 'Sin clasificar');

  if (conf != null && conf > UMBRAL_IA && esp && AMENAZADAS.has(esp.iucn_status)) {
    disparar('alerta_ong', avistamiento, 'exito',
      `Aviso enviado por ${zona?.name ?? 'la zona'} · ${esp.common_name} (${esp.iucn_status})`);
  }
  if (avistamiento.status === 'verificado') correrFlujoAcreditacion(avistamiento);
  else disparar('acreditacion_okn', avistamiento, 'omitido', 'A la espera de que la comunidad resuelva la votación');
}

/** La rama que paga, cuando el reporte ya quedó verificado. */
function correrFlujoAcreditacion(avistamiento) {
  disparar('acreditacion_okn', avistamiento, 'exito', 'Saldo actualizado');
  disparar('aviso_usuario', avistamiento, 'exito', 'Correo enviado al usuario');
}

get('/automatizaciones', () => {
  const disparos = [...(e.disparos ?? [])].sort((a, b) => b.triggered_at.localeCompare(a.triggered_at));
  const flujos = (e.flujos ?? []).map((f) => {
    const suyos = disparos.filter((d) => d.workflow_id === f.id);
    return {
      ...f,
      corridas: suyos.length,
      omitidas: suyos.filter((d) => d.run_status === 'omitido').length,
      ultima: suyos[0]?.triggered_at ?? null,
    };
  });

  return {
    flujos,
    condicion: { umbral: UMBRAL_IA, estados: [...AMENAZADAS] },
    registro: disparos.slice(0, 40).map((d) => {
      const s = porId(e.avistamientos, d.sighting_id);
      const esp = s && porId(e.especies, s.species_id);
      const flujo = porId(e.flujos ?? [], d.workflow_id);
      return {
        id: d.id,
        run_status: d.run_status,
        detail: d.detail,
        triggered_at: d.triggered_at,
        proceso: flujo?.process_name ?? '—',
        nodo: flujo?.node_kind ?? null,
        reportero: porId(e.usuarios, d.user_id)?.full_name ?? '—',
        documento: porId(e.usuarios, d.user_id)?.documento ?? null,
        especie: esp?.common_name ?? null,
        zona: s ? porId(e.zonas, s.zone_id)?.name ?? null : null,
        kind: s?.kind ?? null,
      };
    }),
  };
});

// ---------------------------------------------------------------------
// Capa 1 · /tokens
// ---------------------------------------------------------------------
// Las reglas del sistema de tokens, para la página que las explica. Salen
// de las mismas constantes que aplican los manejadores de arriba: si se
// cambia un premio, la explicación cambia sola.
get('/tokens/reglas', () => ({
  reglas: {
    premios: PREMIOS,
    umbralIa: UMBRAL_IA,
    votosParaResolver: VOTOS_PARA_RESOLVER,
    diasZonaNueva: DIAS_ZONA_NUEVA,
    diasBonoRacha: DIAS_BONO_RACHA,
    reputacion: REPUTACION,
  },
}));

get('/tokens/billetera', () => ({
  ...saldo(e, PERSONA_ID),
  movimientos: e.libro
    .filter((l) => l.user_id === PERSONA_ID)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 60)
    .map((l) => {
      const s = porId(e.avistamientos, l.sighting_id);
      return {
        id: l.id, amount: l.amount, reason: l.reason, detail: l.detail, created_at: l.created_at,
        sighting_kind: s?.kind ?? null, zone_name: s ? porId(e.zonas, s.zone_id).name : null,
      };
    }),
}));

get('/tokens/recompensas', () => ({
  recompensas: e.recompensas
    .filter((r) => r.is_active)
    .sort((a, b) => a.cost_okn - b.cost_okn)
    .map((r) => ({ ...r, zone_name: porId(e.zonas, r.zone_id)?.name ?? null })),
}));

get('/tokens/canjes', () => ({
  canjes: e.canjes
    .filter((c) => c.user_id === PERSONA_ID)
    .sort((a, b) => b.redeemed_at.localeCompare(a.redeemed_at))
    .map((c) => {
      const r = porId(e.recompensas, c.reward_id);
      return { id: c.id, code: c.code, cost_okn: c.cost_okn, redeemed_at: c.redeemed_at, title: r.title, partner: r.partner };
    }),
}));

post('/tokens/canjes', ({ body }) => {
  const premio = e.recompensas.find((r) => r.id === body.rewardId && r.is_active);
  if (!premio) throw notFound('Esa recompensa no está disponible');
  if (premio.stock <= 0) throw badRequest('Se agotó esa recompensa');

  const { balance_okn: balance } = saldo(e, PERSONA_ID);
  if (balance < premio.cost_okn) {
    throw badRequest(`Te faltan ${premio.cost_okn - balance} OKN para este canje`);
  }

  acreditar(PERSONA_ID, -premio.cost_okn, 'canje', { detail: `${premio.title} · ${premio.partner}` });
  premio.stock -= 1;
  const canje = {
    id: nuevoId(), reward_id: premio.id, user_id: PERSONA_ID, cost_okn: premio.cost_okn,
    code: `OKN-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, redeemed_at: ahora(),
  };
  e.canjes.push(canje);

  return { canje, recompensa: premio, saldoRestante: balance - premio.cost_okn };
});

// ---------------------------------------------------------------------
// Capa 2 · /organizaciones
// ---------------------------------------------------------------------
get('/organizaciones/:orgId/panel', ({ params }) => {
  const org = organizacion(params.orgId);
  const proyectos = proyectosDe(org);
  const ids = new Set(proyectos.map((p) => p.id));
  const creditos = e.creditos.filter((c) => ids.has(c.project_id));
  const zonas = zonasDe(org);

  return {
    resumen: {
      proyectos: proyectos.length,
      en_curso: proyectos.filter((p) => p.status === 'en_curso').length,
      hectareas: redondear(suma(proyectos, 'hectares'), 2),
      hectareas_objetivo: redondear(suma(proyectos, 'target_hectares'), 2),
    },
    carbono: {
      certificado: redondear(suma(creditos.filter((c) => c.status === 'certificado'), 'tons_co2'), 3),
      en_validacion: redondear(suma(creditos.filter((c) => c.status === 'en_validacion'), 'tons_co2'), 3),
    },
    zonas: [...zonas]
      .map((id) => saludZona(e, porId(e.zonas, id)))
      .sort((a, b) => b.health_index - a.health_index),
    alertas: e.avistamientos
      .filter((s) => s.kind === 'amenaza' && s.status !== 'rechazado' && zonas.has(s.zone_id) && dentroDe(s.observed_at, 90))
      .sort(recientePrimero)
      .slice(0, 10)
      .map((s) => ({
        id: s.id, kind: s.kind, notes: s.notes, lat: s.lat, lng: s.lng, observed_at: s.observed_at, status: s.status,
        zone_name: porId(e.zonas, s.zone_id).name, common_name: porId(e.especies, s.species_id)?.common_name ?? null,
      })),
    hitosProximos: e.hitos
      .filter((h) => ids.has(h.project_id) && !h.done_on)
      .sort((a, b) => (!a.due_on - !b.due_on) || (a.due_on ?? '').localeCompare(b.due_on ?? ''))
      .slice(0, 8)
      .map((h) => ({ id: h.id, title: h.title, due_on: h.due_on, project_name: porId(e.proyectos, h.project_id).name })),
  };
});

get('/organizaciones/:orgId/sensores', ({ params }) => {
  const org = organizacion(params.orgId);
  const zonas = zonasDe(org);
  const lista = e.sensores
    .filter((s) => zonas.has(s.zone_id))
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((s) => ({
      ...s,
      zone_name: porId(e.zonas, s.zone_id).name,
      project_name: porId(e.proyectos, s.project_id)?.name ?? null,
    }));
  return { sensores: lista, series: lista.filter((s) => s.is_online).flatMap(lecturas) };
});

get('/organizaciones/:orgId/proyectos', ({ params }) => ({
  proyectos: proyectosDe(organizacion(params.orgId)).map(conZona).sort(porNombre),
}));

get('/organizaciones/:orgId/proyectos/:projectId', ({ params }) => {
  const p = proyectoDe(organizacion(params.orgId), params.projectId);
  return {
    proyecto: {
      ...conZona(p),
      description: p.description, started_on: p.started_on, ends_on: p.ends_on,
      hitos_lista: e.hitos
        .filter((h) => h.project_id === p.id)
        .sort((a, b) => (a.position - b.position) || (a.due_on ?? '').localeCompare(b.due_on ?? '')),
      creditos: e.creditos
        .filter((c) => c.project_id === p.id)
        .sort((a, b) => b.vintage_year - a.vintage_year),
    },
  };
});

post('/organizaciones/:orgId/proyectos', ({ params, body }) => {
  const org = organizacion(params.orgId);
  const nombre = String(body.name ?? '').trim();
  if (nombre.length < 2) throw badRequest('El proyecto necesita un nombre');
  const zona = e.zonas.find((z) => z.slug === body.zoneSlug);
  if (!zona) throw badRequest('Esa zona no existe');
  if (body.status && !ESTADOS_PROYECTO.includes(body.status)) throw badRequest('Ese estado no existe');

  const hectares = Number(body.hectares ?? 0);
  const objetivo = body.targetHectares != null ? Number(body.targetHectares) : null;
  if (!(hectares >= 0) || (objetivo != null && !(objetivo >= 0))) {
    throw badRequest('Las hectáreas tienen que ser un número positivo');
  }

  // Sin tope por plan: la demo es la versión gratis con todo abierto.
  const proyecto = {
    id: nuevoId(), org_id: org.id, zone_id: zona.id, name: nombre,
    description: body.description ?? null, status: body.status ?? 'planificado',
    hectares, target_hectares: objetivo,
    started_on: fechaLocal(body.startedOn), ends_on: fechaLocal(body.endsOn), created_at: ahora(),
  };
  e.proyectos.push(proyecto);
  return { proyecto };
});

patch('/organizaciones/:orgId/proyectos/:projectId', ({ params, body }) => {
  const p = proyectoDe(organizacion(params.orgId), params.projectId);

  const cambios = {};
  const asignar = (columna, valor) => { if (valor !== undefined) cambios[columna] = valor; };
  asignar('name', body.name);
  asignar('description', body.description);
  asignar('status', body.status);
  asignar('hectares', body.hectares !== undefined ? Number(body.hectares) : undefined);
  asignar('target_hectares', body.targetHectares !== undefined ? Number(body.targetHectares) : undefined);
  asignar('started_on', body.startedOn !== undefined ? fechaLocal(body.startedOn) : undefined);
  asignar('ends_on', body.endsOn !== undefined ? fechaLocal(body.endsOn) : undefined);

  if (!Object.keys(cambios).length) throw badRequest('No mandaste ningún cambio');
  if (cambios.status && !ESTADOS_PROYECTO.includes(cambios.status)) throw badRequest('Ese estado no existe');
  for (const campo of ['hectares', 'target_hectares']) {
    if (campo in cambios && !(cambios[campo] >= 0)) throw badRequest('Las hectáreas tienen que ser un número positivo');
  }

  Object.assign(p, cambios);
  return { proyecto: p };
});

post('/organizaciones/:orgId/proyectos/:projectId/hitos', ({ params, body }) => {
  const p = proyectoDe(organizacion(params.orgId), params.projectId);
  const titulo = String(body.title ?? '').trim();
  if (titulo.length < 2) throw badRequest('El hito necesita un título');

  const posiciones = e.hitos.filter((h) => h.project_id === p.id).map((h) => h.position);
  const hito = {
    id: nuevoId(), project_id: p.id, title: titulo, due_on: fechaLocal(body.dueOn), done_on: null,
    position: posiciones.length ? Math.max(...posiciones) + 1 : 0,
  };
  e.hitos.push(hito);
  return { hito };
});

patch('/organizaciones/:orgId/hitos/:milestoneId', ({ params, body }) => {
  const org = organizacion(params.orgId);
  const hito = porId(e.hitos, params.milestoneId);
  if (!hito || porId(e.proyectos, hito.project_id)?.org_id !== org.id) {
    throw notFound('Ese hito no existe en tu organización');
  }
  if (typeof body.done !== 'boolean') throw badRequest('Falta indicar si el hito está hecho');

  hito.done_on = body.done ? fechaLocal(claveDia()) : null;
  return { hito };
});

// ---------------------------------------------------------------------
// Capa 3 · /mercado
// ---------------------------------------------------------------------
function filaListado(l) {
  const p = porId(e.proyectos, l.project_id);
  const o = porId(e.organizaciones, p.org_id);
  const z = porId(e.zonas, p.zone_id);
  const c = porId(e.creditos, l.credit_id);
  return {
    id: l.id, asset_kind: l.asset_kind, title: l.title, summary: l.summary, unit_label: l.unit_label,
    unit_price_usd: l.unit_price_usd, units_total: l.units_total, units_sold: l.units_sold,
    units_available: redondear(l.units_total - l.units_sold, 3),
    commission_pct: l.commission_pct, status: l.status, published_at: l.published_at,
    project_name: p.name, hectares: p.hectares,
    org_name: o.name, org_kind: o.kind,
    zone_name: z.name, zone_slug: z.slug,
    registry: c?.registry ?? null, registry_ref: c?.registry_ref ?? null,
    vintage_year: c?.vintage_year ?? null, certified_on: c?.certified_on ?? null,
  };
}

// Antes que /mercado/:id para que "indicadores" no se lea como un id.
get('/mercado/indicadores', () => {
  const cerradas = e.ordenes.filter((o) => o.status === 'pagada' || o.status === 'liquidada');
  const deCarbono = cerradas.filter((o) => porId(e.listados, o.listing_id)?.asset_kind === 'credito_carbono');
  return {
    indicadores: {
      activos_publicados: e.listados.filter((l) => l.status === 'publicado').length,
      volumen_usd: redondear(suma(cerradas, 'gross_usd'), 2),
      comision_usd: redondear(suma(cerradas, 'commission_usd'), 2),
      tco2_vendido: redondear(suma(deCarbono, 'units'), 3),
    },
  };
});

get('/mercado', ({ query }) => ({
  activos: e.listados
    .filter((l) => l.status === 'publicado')
    .map(filaListado)
    .filter((a) => (!query.tipo || a.asset_kind === query.tipo) && (!query.zona || a.zone_slug === query.zona))
    .sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? '')),
}));

get('/mercado/:id', ({ params }) => {
  const l = porId(e.listados, params.id);
  if (!l) throw notFound('Ese activo no está publicado');
  const activo = filaListado(l);
  const { health_index, kelp_cobertura_pct, avistamientos_tiburon } =
    saludZona(e, e.zonas.find((z) => z.slug === activo.zone_slug));
  return { activo: { ...activo, salud_zona: { health_index, kelp_cobertura_pct, avistamientos_tiburon } } };
});

post('/mercado/:id/ordenes', ({ params, body }) => {
  const l = e.listados.find((x) => x.id === params.id && x.status === 'publicado');
  if (!l) throw notFound('Ese activo no está disponible');

  const unidades = Number(body.units);
  if (!(unidades > 0)) throw badRequest('La cantidad tiene que ser mayor a cero');
  if (String(body.buyerName ?? '').trim().length < 2) throw badRequest('Falta el nombre de quien compra');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.buyerEmail ?? '')) throw badRequest('Revisá el correo');

  // Mismo cuidado que el FOR UPDATE del servicio: nunca se sobrevende.
  const disponibles = redondear(l.units_total - l.units_sold, 3);
  if (unidades > disponibles) throw badRequest(`Solo quedan ${disponibles} ${l.unit_label} disponibles`);

  const bruto = redondear(unidades * l.unit_price_usd, 2);
  const comision = redondear((bruto * l.commission_pct) / 100, 2);
  const orden = {
    id: nuevoId(), listing_id: l.id, buyer_org_id: body.buyerOrgId ?? null,
    buyer_name: body.buyerName.trim(), buyer_email: body.buyerEmail,
    units: unidades, unit_price_usd: l.unit_price_usd, gross_usd: bruto, commission_usd: comision,
    status: 'pendiente', created_at: ahora(),
  };
  e.ordenes.push(orden);

  l.units_sold = redondear(l.units_sold + unidades, 3);
  if (l.units_sold >= l.units_total) l.status = 'agotado';

  return { orden, listado: { units_sold: l.units_sold, units_total: l.units_total, status: l.status }, comision, bruto };
});

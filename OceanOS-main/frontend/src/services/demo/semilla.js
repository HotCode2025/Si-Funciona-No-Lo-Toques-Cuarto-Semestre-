/**
 * Semilla de la demostración: el mismo contenido que
 * database/seeds/001_demo.sql, pero armado en memoria para que el sitio
 * funcione sin PostgreSQL.
 *
 * Las columnas conservan los nombres de la base (snake_case) a propósito:
 * así vistas.js puede copiar la lógica de las vistas SQL casi línea por
 * línea, y si algún día se vuelve a la API real no hay que traducir nada.
 *
 * Diferencias con el SQL, todas para que la demo se entienda mejor:
 *   - created_at de cada avistamiento es su observed_at. En el seed quedaba
 *     en now(), y la billetera mostraba 23 movimientos "recién".
 *   - Leandro ya votó el reporte del gatuzo. Así ese reporte arranca con
 *     dos votos y el voto de quien prueba la demo es el que lo resuelve:
 *     se ve la votación completa, no solo el primer paso.
 *   - Las coordenadas caen en el agua y los límites de Golfo Nuevo cubren el
 *     golfo entero (ver AGUA y ZONAS más abajo). El SQL todavía no.
 */

/** Subir este número invalida lo guardado en sessionStorage si cambia la forma del estado. */
export const VERSION = 13;

export const DIA = 24 * 3600 * 1000;
const HORA = 3600 * 1000;

/**
 * La cuenta con la que se usa la app ciudadana: es del proyecto, no de
 * ningún integrante. Los integrantes aparecen solo como autores de los
 * reportes de ejemplo.
 */
export const PERSONA_ID = '33333333-0000-0000-0000-000000000009';
export const ORG_POR_DEFECTO = '44444444-0000-0000-0000-000000000001';

const Z = {
  golfoNuevo: '11111111-0000-0000-0000-000000000001',
  valdes:     '11111111-0000-0000-0000-000000000002',
  sanJose:    '11111111-0000-0000-0000-000000000003',
  camarones:  '11111111-0000-0000-0000-000000000004',
};
const U = {
  admin:    '33333333-0000-0000-0000-000000000001',
  buzo:     '33333333-0000-0000-0000-000000000002',
  leandro:  '33333333-0000-0000-0000-000000000003',
  otar:     '33333333-0000-0000-0000-000000000005',
  jose:     '33333333-0000-0000-0000-000000000008',
  oceanos:  PERSONA_ID,
};
const E = (n) => `22222222-0000-0000-0000-00000000000${n}`;
const O = (n) => `44444444-0000-0000-0000-00000000000${n}`;
const P = (n) => `55555555-0000-0000-0000-00000000000${n}`;
const L = (n) => `99999999-0000-0000-0000-00000000000${n}`;
const N = (n) => `88888888-0000-0000-0000-00000000000${n}`;

// Condición del triage del flujo n8n, igual que en el diagrama entregado.
const UMBRAL_TRIAGE = 0.8;
const AMENAZADAS = new Set(['VU', 'EN', 'CR']);

/**
 * Generador pseudoaleatorio con semilla (mulberry32). El SQL usa random()
 * para el ruido de los sensores; acá tiene que ser determinista para que
 * los gráficos no cambien cada vez que se recarga la página.
 */
export function aleatorio(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const redondear = (valor, decimales = 0) => {
  const f = 10 ** decimales;
  return Math.round((Number(valor) + Number.EPSILON) * f) / f;
};

/** 'YYYY-MM-DD' en hora local. Es lo que en SQL sería CURRENT_DATE. */
export const claveDia = (fecha = new Date()) => {
  const d = new Date(fecha);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Una fecha sin hora ('2026-03-20') como medianoche LOCAL en ISO. Si se
 * guardara el texto tal cual, new Date() lo lee como medianoche UTC y en
 * Argentina se muestra el día anterior.
 */
export const fechaLocal = (texto) => {
  if (!texto) return null;
  const [y, m, d] = texto.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toISOString();
};

let contador = 0;
/** Id con forma de uuid. No necesita ser criptográfico: es una demo. */
export const nuevoId = () =>
  `${Date.now().toString(16).slice(-8)}-${(++contador).toString(16).padStart(4, '0')}-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`;

export function crearSemilla(ahora = Date.now()) {
  const hace = (dias, horas = 0) => new Date(ahora - dias * DIA - horas * HORA).toISOString();
  const mas = (iso, horas) => new Date(new Date(iso).getTime() + horas * HORA).toISOString();
  const masSeg = (iso, segundos) => new Date(new Date(iso).getTime() + segundos * 1000).toISOString();
  const r6 = (x) => redondear(x, 6);
  let secuencia = 0;
  const idSemilla = (letra) => `${letra}0000000-0000-4000-8000-${String(++secuencia).padStart(12, '0')}`;

  // ---------- ZONAS ------------------------------------------------------
  // Golfo Nuevo corregido contra el mapa real: en el SQL los límites
  // terminaban en −64,5 y dejaban afuera el tercio este del golfo, así que
  // el mapa arrancaba encuadrado sobre medio golfo.
  const zonas = [
    { id: Z.golfoNuevo, slug: 'golfo-nuevo', name: 'Golfo Nuevo', province: 'Chubut',
      center_lat: -42.7, center_lng: -64.63, min_lat: -42.93, max_lat: -42.47, min_lng: -65.1, max_lng: -64.15,
      area_km2: 2350, is_protected: false },
    { id: Z.valdes, slug: 'peninsula-valdes', name: 'Península Valdés', province: 'Chubut',
      center_lat: -42.5, center_lng: -63.95, min_lat: -42.9, max_lat: -42.1, min_lng: -64.6, max_lng: -63.5,
      area_km2: 3600, is_protected: true },
    { id: Z.sanJose, slug: 'golfo-san-jose', name: 'Golfo San José', province: 'Chubut',
      center_lat: -42.35, center_lng: -64.3, min_lat: -42.45, max_lat: -42.18, min_lng: -64.6, max_lng: -63.95,
      area_km2: 817, is_protected: true },
    { id: Z.camarones, slug: 'bahia-camarones', name: 'Bahía Camarones', province: 'Chubut',
      center_lat: -44.8, center_lng: -65.7, min_lat: -45.05, max_lat: -44.55, min_lng: -65.95, max_lng: -65.4,
      area_km2: 1120, is_protected: false },
  ];

  // ---------- ESPECIES ---------------------------------------------------
  const especies = [
    { id: E(1), scientific_name: 'Macrocystis pyrifera', common_name: 'Cachiyuyo (kelp gigante)', kind: 'kelp', iucn_status: 'DD', is_key_species: true,
      notes: 'Forma los bosques submarinos del Atlántico Sur. Sumidero de carbono azul.' },
    { id: E(2), scientific_name: 'Notorynchus cepedianus', common_name: 'Gatopardo', kind: 'tiburon', iucn_status: 'VU', is_key_species: true,
      notes: 'Apex predator del Golfo Nuevo. Su presencia sostiene el equilibrio trófico del bosque de kelp.' },
    { id: E(3), scientific_name: 'Carcharias taurus', common_name: 'Escalandrún', kind: 'tiburon', iucn_status: 'CR', is_key_species: true,
      notes: 'Población del Atlántico Sudoccidental en estado crítico.' },
    { id: E(4), scientific_name: 'Galeorhinus galeus', common_name: 'Cazón', kind: 'tiburon', iucn_status: 'CR', is_key_species: true,
      notes: 'Históricamente sobrepescado en aguas argentinas.' },
    { id: E(5), scientific_name: 'Mustelus schmitti', common_name: 'Gatuzo', kind: 'tiburon', iucn_status: 'EN', is_key_species: false,
      notes: 'Especie costera, captura incidental frecuente.' },
    { id: E(6), scientific_name: 'Squatina guggenheim', common_name: 'Pez ángel', kind: 'tiburon', iucn_status: 'EN', is_key_species: false,
      notes: 'Bentónico, muy vulnerable al arrastre de fondo.' },
    { id: E(7), scientific_name: 'Eubalaena australis', common_name: 'Ballena franca austral', kind: 'fauna', iucn_status: 'LC', is_key_species: false,
      notes: 'Cría en Golfo Nuevo y Golfo San José entre junio y diciembre.' },
    { id: E(8), scientific_name: 'Otaria flavescens', common_name: 'Lobo marino de un pelo', kind: 'fauna', iucn_status: 'LC', is_key_species: false, notes: null },
    { id: E(9), scientific_name: 'Spheniscus magellanicus', common_name: 'Pingüino de Magallanes', kind: 'fauna', iucn_status: 'LC', is_key_species: false, notes: null },
    { id: E('a'), scientific_name: 'Undaria pinnatifida', common_name: 'Alga invasora (wakame)', kind: 'amenaza', iucn_status: null, is_key_species: false,
      notes: 'Invasora establecida en Golfo Nuevo desde 1992. Desplaza al cachiyuyo nativo.' },
  ];

  // ---------- USUARIOS ---------------------------------------------------
  const hoy = claveDia(ahora);
  const diaMenos = (n) => claveDia(ahora - n * DIA);
  const usuarios = [
    { id: U.admin,    documento: '44812309', email: 'admin@oceanos.ar',    full_name: 'Lautaro Martinez', role: 'admin',        home_zone_id: Z.golfoNuevo, reputation: 1000, streak_days: 0,  last_report_on: null,        created_at: hace(400) },
    { id: U.buzo,     documento: '41250877', email: 'buzo@oceanos.ar',     full_name: 'Gabriel Maculus',  role: 'ciudadano',    home_zone_id: Z.golfoNuevo, reputation: 480,  streak_days: 12, last_report_on: hoy,         created_at: hace(214) },
    { id: U.leandro,  documento: '43907165', email: 'leandro@oceanos.ar',  full_name: 'Leandro Orozco',   role: 'ciudadano',    home_zone_id: Z.golfoNuevo, reputation: 320,  streak_days: 5,  last_report_on: diaMenos(1), created_at: hace(180) },
    { id: U.otar,     documento: '40118542', email: 'otar@oceanos.ar',     full_name: 'Otar',             role: 'ciudadano',    home_zone_id: Z.sanJose,    reputation: 640,  streak_days: 21, last_report_on: hoy,         created_at: hace(260) },
    { id: U.jose,     documento: '38264910', email: 'jose@oceanos.ar',     full_name: 'Jose Rodriguez',   role: 'organizacion', home_zone_id: Z.valdes,     reputation: 100,  streak_days: 0,  last_report_on: null,        created_at: hace(290) },
    // La cuenta de la demo arranca de cero: sin reportes (así el ranking es
    // solo de los reportes de ejemplo) y con la reputación inicial de la base.
    { id: U.oceanos,  email: 'demo@oceanos.ar',     full_name: 'OceanOS',          role: 'ciudadano',    home_zone_id: Z.golfoNuevo, reputation: 100,  streak_days: 0,  last_report_on: null,        created_at: hace(0, 2) },
  ];

  // ---------- ORGANIZACIONES ---------------------------------------------
  const organizaciones = [
    { id: O(1), slug: 'fundacion-kelp',     name: 'Fundación Kelp Patagonia',        kind: 'ong',            plan: 'professional', contact_email: 'contacto@kelppatagonia.ar' },
    { id: O(2), slug: 'pesquera-atlantico', name: 'Pesquera Atlántico Sur',          kind: 'pesquera',       plan: 'starter',      contact_email: 'ops@pesqueraatlantico.ar' },
    { id: O(3), slug: 'apn-valdes',         name: 'Área Protegida Península Valdés', kind: 'area_protegida', plan: 'enterprise',   contact_email: 'tecnica@apvaldes.gob.ar' },
  ];

  // ---------- PROYECTOS DE RESTAURACIÓN ----------------------------------
  const proyectos = [
    { id: P(1), org_id: O(1), zone_id: Z.golfoNuevo, name: 'Refugios de kelp — Punta Este',
      description: 'Instalación de arrecifes artificiales y trasplante de esporofitos de Macrocystis en 40 hectáreas del Golfo Nuevo.',
      status: 'en_curso', hectares: 26.5, target_hectares: 40, started_on: fechaLocal('2026-03-01'), ends_on: fechaLocal('2027-06-30'), created_at: hace(200) },
    { id: P(2), org_id: O(1), zone_id: Z.sanJose, name: 'Control de Undaria — Golfo San José',
      description: 'Extracción manual estacional del alga invasora para liberar sustrato al cachiyuyo nativo.',
      status: 'monitoreo', hectares: 12, target_hectares: 15, started_on: fechaLocal('2025-09-15'), ends_on: fechaLocal('2026-12-31'), created_at: hace(360) },
    { id: P(3), org_id: O(3), zone_id: Z.valdes, name: 'Corredor de apex predators',
      description: 'Monitoreo acústico de gatopardo y escalandrún para sostener la cadena trófica del bosque.',
      status: 'en_curso', hectares: 80, target_hectares: 120, started_on: fechaLocal('2026-01-10'), ends_on: null, created_at: hace(250) },
    { id: P(4), org_id: O(2), zone_id: Z.camarones, name: 'Línea de base — Camarones',
      description: 'Relevamiento previo a certificación de carbono azul.',
      status: 'planificado', hectares: 0, target_hectares: 60, started_on: null, ends_on: null, created_at: hace(60) },
  ];

  const hito = (project_id, title, due, done, position) => ({
    id: idSemilla('b'), project_id, title, due_on: fechaLocal(due), done_on: fechaLocal(done), position,
  });
  const hitos = [
    hito(P(1), 'Relevamiento batimétrico del sitio', '2026-03-20', '2026-03-18', 0),
    hito(P(1), 'Instalación de 12 arrecifes artificiales', '2026-05-30', '2026-06-04', 1),
    hito(P(1), 'Primer trasplante de esporofitos', '2026-08-15', '2026-08-12', 2),
    hito(P(1), 'Medición de cobertura a 6 meses', '2026-12-15', null, 3),
    hito(P(1), 'Validación externa CENPAT', '2027-03-30', null, 4),
    hito(P(2), 'Campaña de extracción primavera', '2026-10-01', null, 0),
    hito(P(2), 'Informe de recolonización nativa', '2026-11-30', null, 1),
    hito(P(3), 'Despliegue de 6 receptores acústicos', '2026-02-28', '2026-02-25', 0),
    hito(P(3), 'Marcado de 20 ejemplares', '2026-07-31', '2026-08-09', 1),
    hito(P(3), 'Primer informe de residencia', '2026-11-15', null, 2),
  ];

  // ---------- SENSORES IoT -----------------------------------------------
  // Las lecturas no se guardan: vistas.js las genera con la misma fórmula
  // del seed cada vez que se piden (son 720 filas que nunca cambian).
  const sensores = [
    { id: '66666666-0000-0000-0000-000000000001', zone_id: Z.golfoNuevo, project_id: P(1), code: 'GN-01', label: 'Punta Este · boya norte',  lat: -42.702, lng: -64.868, depth_m: 12, is_online: true,  installed_on: fechaLocal('2026-03-05') },
    { id: '66666666-0000-0000-0000-000000000002', zone_id: Z.golfoNuevo, project_id: P(1), code: 'GN-02', label: 'Punta Este · fondo 22m',   lat: -42.711, lng: -64.855, depth_m: 22, is_online: true,  installed_on: fechaLocal('2026-03-05') },
    { id: '66666666-0000-0000-0000-000000000003', zone_id: Z.golfoNuevo, project_id: null, code: 'GN-03', label: 'Muelle Storni',            lat: -42.788, lng: -65.032, depth_m: 8,  is_online: false, installed_on: fechaLocal('2025-11-20') },
    { id: '66666666-0000-0000-0000-000000000004', zone_id: Z.sanJose,    project_id: P(2), code: 'SJ-01', label: 'San José · banco central', lat: -42.34,  lng: -64.285, depth_m: 15, is_online: true,  installed_on: fechaLocal('2025-09-20') },
    { id: '66666666-0000-0000-0000-000000000005', zone_id: Z.valdes,     project_id: P(3), code: 'PV-01', label: 'Valdés · corredor sur',    lat: -42.61,  lng: -63.88,  depth_m: 30, is_online: true,  installed_on: fechaLocal('2026-01-15') },
  ];

  // ---------- AVISTAMIENTOS ----------------------------------------------
  // En el SQL las coordenadas salen de una fórmula repartida por todo el
  // rectángulo de la zona, y ese rectángulo incluye tierra. Con el mapa SVG
  // no se notaba; sobre el mapa real quedaban cachiyuyos en Puerto Madryn y
  // ballenas en el medio de la península. Además la fórmula es modular y
  // dibujaba filas diagonales. Acá los puntos se reparten al azar (con
  // semilla fija, siempre los mismos) dentro de espejos de agua comprobados
  // sobre OpenStreetMap.
  const AGUA = {
    golfoNuevo:      { lat: -42.71, lng: -64.62, radioLat: 0.10, radioLng: 0.28 },
    golfoNuevoOeste: { lat: -42.72, lng: -64.86, radioLat: 0.06, radioLng: 0.08 },
    golfoNuevoEste:  { lat: -42.71, lng: -64.45, radioLat: 0.05, radioLng: 0.07 },
    golfoSanJose:    { lat: -42.31, lng: -64.30, radioLat: 0.04, radioLng: 0.12 },
  };
  // u y v van de 0 a 1. Radio con raíz cuadrada para que la densidad sea
  // pareja en toda la elipse: con el radio lineal los puntos se amontonan
  // en el centro, y con un mapeo de cuadrado a círculo, contra el borde.
  const enAgua = ({ lat, lng, radioLat, radioLng }, u, v) => {
    const radio = Math.sqrt(u);
    const angulo = v * 2 * Math.PI;
    return {
      lat: r6(lat + radio * Math.sin(angulo) * radioLat),
      lng: r6(lng + radio * Math.cos(angulo) * radioLng),
    };
  };

  // Un generador por grupo: agregar un tiburón no mueve los cachiyuyos.
  const azarKelp = aleatorio(101);
  const azarTiburones = aleatorio(202);
  const azarBallenas = aleatorio(303);
  const azarLobosYPinguinos = aleatorio(404);

  const avistamientos = [];
  const avistamiento = (datos) => {
    const fila = {
      id: idSemilla('a'), species_id: null, depth_m: null, individuals: null, kelp_cover_pct: null,
      photo_url: null, ai_confidence: null, ai_label: null, notes: null, resolved_at: null, ...datos,
    };
    fila.created_at = fila.observed_at;
    avistamientos.push(fila);
    return fila;
  };

  // Kelp verificado en Golfo Nuevo: cobertura alta, salud alta.
  for (let n = 1; n <= 22; n++) {
    const observado = hace(n * 2);
    avistamiento({
      zone_id: Z.golfoNuevo, user_id: U.buzo, species_id: E(1), kind: 'kelp',
      ...enAgua(AGUA.golfoNuevoOeste, azarKelp(), azarKelp()),
      depth_m: 8 + (n % 14), kelp_cover_pct: 58 + (n % 32),
      ai_confidence: redondear(0.88 + (n % 10) * 0.01, 3), ai_label: 'Macrocystis pyrifera',
      status: 'verificado', observed_at: observado, resolved_at: mas(observado, 3),
    });
  }

  // Tiburones verificados: gatopardo y escalandrún, repartidos entre tres
  // personas. Se agrupan de a dos para que el autor no dependa de n % 3,
  // que es lo que decide la especie: si no, uno se quedaba con todos los
  // escalandrunes.
  const buzosDeTiburones = [U.otar, U.leandro, U.admin];
  for (let n = 1; n <= 14; n++) {
    const observado = hace(n * 4);
    const escalandrun = n % 3 === 0;
    avistamiento({
      zone_id: Z.golfoNuevo, user_id: buzosDeTiburones[Math.floor(n / 2) % 3],
      species_id: escalandrun ? E(3) : E(2), kind: 'tiburon',
      ...enAgua(AGUA.golfoNuevo, azarTiburones(), azarTiburones()),
      depth_m: 10 + (n % 20), individuals: 1 + (n % 3),
      ai_confidence: redondear(0.82 + (n % 12) * 0.012, 3),
      ai_label: escalandrun ? 'Carcharias taurus' : 'Notorynchus cepedianus',
      status: 'verificado', observed_at: observado, resolved_at: mas(observado, 5),
    });
  }

  // Fauna en Península Valdés, reportada por Jose desde el área protegida.
  // La zona es casi toda tierra: las ballenas van a los dos golfos donde
  // crían, que caen dentro de sus límites.
  for (let n = 1; n <= 9; n++) {
    const observado = hace(n * 3);
    avistamiento({
      zone_id: Z.valdes, user_id: U.jose, species_id: E(7), kind: 'fauna',
      ...enAgua(n % 2 ? AGUA.golfoSanJose : AGUA.golfoNuevoEste, azarBallenas(), azarBallenas()),
      individuals: 1 + (n % 4), ai_confidence: 0.94, ai_label: 'Eubalaena australis',
      status: 'verificado', observed_at: observado, resolved_at: mas(observado, 2),
    });
  }

  // Lobos marinos y pingüinos, todos verificados. Suman reportes sin mover
  // el índice de salud, que solo mira cachiyuyo, tiburones y amenazas.
  const lobo = { species_id: E(8), ai_label: 'Otaria flavescens', zone_id: Z.golfoNuevo, agua: AGUA.golfoNuevo };
  const pinguino = { species_id: E(9), ai_label: 'Spheniscus magellanicus', zone_id: Z.valdes, agua: AGUA.golfoSanJose };
  const lobosYPinguinos = [
    ...[lobo, lobo, lobo, lobo, pinguino, pinguino, pinguino, pinguino].map((f) => ({ ...f, user_id: U.admin })),
    ...[lobo, lobo].map((f) => ({ ...f, user_id: U.leandro })),
  ];
  lobosYPinguinos.forEach(({ agua, ...f }, i) => {
    const observado = hace(2 + i * 5);
    avistamiento({
      ...f, kind: 'fauna',
      ...enAgua(agua, azarLobosYPinguinos(), azarLobosYPinguinos()),
      individuals: 2 + (i % 5), ai_confidence: redondear(0.86 + (i % 4) * 0.03, 3),
      status: 'verificado', observed_at: observado, resolved_at: mas(observado, 3),
    });
  });

  // Amenazas abiertas: alga invasora y red fantasma. Verificada no quiere
  // decir resuelta: sigue abierta hasta que la retiren, y cuenta igual.
  avistamiento({ zone_id: Z.golfoNuevo, user_id: U.buzo, species_id: E('a'), kind: 'amenaza',
    lat: -42.77, lng: -64.86, depth_m: 6, ai_confidence: 0.91, ai_label: 'Undaria pinnatifida',
    status: 'verificado', notes: 'Mancha densa de wakame sobre sustrato rocoso, ~200 m².', observed_at: hace(6) });
  avistamiento({ zone_id: Z.golfoNuevo, user_id: U.leandro, kind: 'amenaza',
    lat: -42.67, lng: -64.8, depth_m: 18,
    status: 'verificado', notes: 'Red de pesca abandonada enganchada en el arrecife artificial 7.',
    observed_at: hace(2), resolved_at: hace(1) });
  avistamiento({ zone_id: Z.sanJose, user_id: U.otar, species_id: E('a'), kind: 'amenaza',
    lat: -42.33, lng: -64.36, depth_m: 9, ai_confidence: 0.86, ai_label: 'Undaria pinnatifida',
    status: 'verificado', notes: 'Rebrote en el sector ya intervenido en 2025.', observed_at: hace(11) });

  // Reportes en votación: confianza del modelo por debajo de 0.80.
  const gatuzo = avistamiento({ id: '77777777-0000-0000-0000-000000000001', zone_id: Z.golfoNuevo, user_id: U.otar,
    species_id: E(5), kind: 'tiburon', lat: -42.68, lng: -64.62, depth_m: 14, individuals: 1,
    ai_confidence: 0.61, ai_label: 'Mustelus schmitti', status: 'en_votacion',
    notes: 'Visibilidad baja, no llegué a ver el patrón de manchas.', observed_at: hace(1) });
  avistamiento({ id: '77777777-0000-0000-0000-000000000002', zone_id: Z.golfoNuevo, user_id: U.admin,
    species_id: E(6), kind: 'tiburon', lat: -42.78, lng: -64.56, depth_m: 25, individuals: 1,
    ai_confidence: 0.54, ai_label: 'Squatina guggenheim', status: 'en_votacion',
    notes: 'Semienterrado en la arena, foto de frente.', observed_at: hace(3) });
  avistamiento({ id: '77777777-0000-0000-0000-000000000003', zone_id: Z.golfoNuevo, user_id: U.otar,
    species_id: E(1), kind: 'kelp', lat: -42.7, lng: -64.92, depth_m: 7,
    ai_confidence: 0.72, ai_label: 'Macrocystis pyrifera', status: 'en_votacion',
    notes: '¿Cachiyuyo joven o Undaria? No me la juego.', observed_at: hace(4) });

  // El gatuzo es de Otar, así que votan otros: nadie vota su propio reporte.
  const votos = [
    { id: idSemilla('c'), sighting_id: gatuzo.id, user_id: U.admin,   agrees: true, species_id: E(5), weight: 1000, created_at: hace(0, 20) },
    { id: idSemilla('c'), sighting_id: gatuzo.id, user_id: U.leandro, agrees: true, species_id: E(5), weight: 320,  created_at: hace(0, 6) },
  ];

  // ---------- LIBRO MAYOR DE TOKENS --------------------------------------
  // Igual que en el seed: se deriva de los avistamientos ya cargados.
  // Cada reporte válido paga 15 y, si queda verificado por el
  // clasificador o la comunidad, suma otros 25 OKN.
  const libro = [];
  const movimiento = (user_id, amount, reason, created_at, extra = {}) =>
    libro.push({ id: idSemilla('e'), user_id, amount, reason, sighting_id: null, detail: null, created_at, ...extra });

  for (const s of avistamientos) {
    movimiento(s.user_id, 15, 'reporte_basico', s.created_at, { sighting_id: s.id });
  }
  for (const s of avistamientos.filter((a) => a.status === 'verificado')) {
    movimiento(s.user_id, 25, 'foto_verificada', s.resolved_at ?? mas(s.created_at, 4), { sighting_id: s.id });
  }
  movimiento(U.buzo,    50,  'racha_semanal',  hace(5),     { detail: 'Racha de 7 días' });
  movimiento(U.otar,    50,  'racha_semanal',  hace(9),     { detail: 'Racha de 7 días' });
  movimiento(U.otar,    100, 'zona_nueva',     hace(30),    { detail: 'Primer reporte en Golfo San José' });
  movimiento(U.admin,   10,  'voto_comunidad', hace(0, 20), { detail: 'Voto en reporte de baja confianza', sighting_id: gatuzo.id });
  movimiento(U.leandro, 10,  'voto_comunidad', hace(0, 6),  { detail: 'Voto en reporte de baja confianza', sighting_id: gatuzo.id });
  // Saldo de bienvenida de la cuenta de la demo. Sin esto el paso "canjeá
  // el café" del recorrido no cierra: reportar en zona nueva y votar dan
  // 125 OKN y el café cuesta 150.
  movimiento(U.oceanos, 200, 'ajuste',         hace(0, 2),  { detail: 'Bienvenida a la cuenta de demostración' });

  // ---------- RECOMPENSAS ------------------------------------------------
  const recompensas = [
    { id: idSemilla('f'), zone_id: Z.golfoNuevo, partner: 'Madryn Buceo', title: 'Bautismo de buceo',
      description: 'Inmersión guiada de 40 minutos en el bosque de cachiyuyo de Punta Este.', cost_okn: 1200, stock: 8, is_active: true },
    { id: idSemilla('f'), zone_id: Z.golfoNuevo, partner: 'Náutica Golfo', title: 'Avistaje de ballenas',
      description: 'Salida embarcada de 90 minutos, temporada junio a diciembre.', cost_okn: 1800, stock: 12, is_active: true },
    { id: idSemilla('f'), zone_id: Z.valdes, partner: 'Valdés Expediciones', title: 'Snorkel con lobos marinos',
      description: 'Salida de medio día a Punta Loma con equipo incluido.', cost_okn: 1500, stock: 6, is_active: true },
    { id: idSemilla('f'), zone_id: Z.golfoNuevo, partner: 'Café del Muelle', title: 'Café de especialidad',
      description: 'Un café y una medialuna en el muelle Piedrabuena.', cost_okn: 150, stock: 100, is_active: true },
  ];

  // ---------- CARBONO Y MARKETPLACE --------------------------------------
  const creditos = [
    { id: '88888888-0000-0000-0000-000000000001', project_id: P(1), registry: 'verra', registry_ref: 'VCS-AR-2026-0417',
      vintage_year: 2026, tons_co2: 1840.5, status: 'certificado', certified_on: fechaLocal('2026-07-22') },
    { id: '88888888-0000-0000-0000-000000000002', project_id: P(3), registry: 'gold_standard', registry_ref: 'GS-11288',
      vintage_year: 2026, tons_co2: 3120, status: 'certificado', certified_on: fechaLocal('2026-08-30') },
    { id: '88888888-0000-0000-0000-000000000003', project_id: P(2), registry: 'interno', registry_ref: null,
      vintage_year: 2026, tons_co2: 610.25, status: 'en_validacion', certified_on: null },
  ];

  const listados = [
    { id: L(1), project_id: P(1), credit_id: creditos[0].id, asset_kind: 'credito_carbono',
      title: 'Carbono azul · Punta Este 2026',
      summary: 'Créditos verificados por Verra sobre 26,5 hectáreas de bosque de cachiyuyo restaurado en el Golfo Nuevo.',
      unit_label: 'tCO₂e', unit_price_usd: 42, units_total: 1840.5, units_sold: 620, commission_pct: 10, status: 'publicado', published_at: hace(40) },
    { id: L(2), project_id: P(3), credit_id: creditos[1].id, asset_kind: 'credito_carbono',
      title: 'Carbono azul · Corredor Valdés 2026',
      summary: 'Créditos Gold Standard sobre el corredor de apex predators de Península Valdés.',
      unit_label: 'tCO₂e', unit_price_usd: 51, units_total: 3120, units_sold: 410, commission_pct: 12, status: 'publicado', published_at: hace(12) },
    { id: L(3), project_id: P(1), credit_id: null, asset_kind: 'hectarea_viva',
      title: 'Hectárea viva · Golfo Nuevo',
      summary: 'Apadrinamiento de una hectárea de bosque restaurado con reporte anual de biodiversidad y acceso al panel de métricas.',
      unit_label: 'hectárea', unit_price_usd: 3800, units_total: 40, units_sold: 11, commission_pct: 8, status: 'publicado', published_at: hace(65) },
    { id: L(4), project_id: P(2), credit_id: null, asset_kind: 'bono_restauracion',
      title: 'Bono de restauración · San José',
      summary: 'Instrumento a 36 meses atado a hitos de recolonización de cachiyuyo nativo tras el control de Undaria.',
      unit_label: 'bono', unit_price_usd: 1000, units_total: 250, units_sold: 0, commission_pct: 9, status: 'borrador', published_at: null },
  ];

  const ordenes = [
    { id: idSemilla('d'), listing_id: L(1), buyer_org_id: null, buyer_name: 'Naviera Austral S.A.', buyer_email: 'esg@navieraaustral.com',
      units: 420, unit_price_usd: 42, gross_usd: 17640, commission_usd: 1764, status: 'liquidada', created_at: hace(31) },
    { id: idSemilla('d'), listing_id: L(1), buyer_org_id: null, buyer_name: 'Bodega Valle Azul', buyer_email: 'sustentabilidad@vallazul.ar',
      units: 200, unit_price_usd: 42, gross_usd: 8400, commission_usd: 840, status: 'pagada', created_at: hace(9) },
    { id: idSemilla('d'), listing_id: L(2), buyer_org_id: null, buyer_name: 'Fondo Patagonia ESG', buyer_email: 'deals@patagoniaesg.com',
      units: 410, unit_price_usd: 51, gross_usd: 20910, commission_usd: 2509.2, status: 'pagada', created_at: hace(5) },
    { id: idSemilla('d'), listing_id: L(3), buyer_org_id: null, buyer_name: 'Grupo Litoral', buyer_email: 'rse@grupolitoral.com.ar',
      units: 11, unit_price_usd: 3800, gross_usd: 41800, commission_usd: 3344, status: 'liquidada', created_at: hace(20) },
  ];

  // ---------- AUTOMATIZACIÓN n8n ----------------------------------------
  // Los cinco nodos del flujo que se entregó junto al MER. El registro de
  // disparos no se escribe a mano: sale de los mismos avistamientos, con
  // la condición del triage tal cual figura en el diagrama.
  const flujos = [
    { id: N(1), slug: 'webhook_avistamiento', process_name: 'Webhook · alta de avistamiento',   node_kind: 'webhook',    step_order: 1,
      description: 'Recibe el alta de la tabla de avistamientos y arranca el flujo.' },
    { id: N(2), slug: 'triage_confianza',     process_name: 'Triage lógico',                    node_kind: 'condicion',  step_order: 2,
      description: 'Evalúa si la confianza de la IA supera el 80% y si la especie está amenazada.' },
    { id: N(3), slug: 'alerta_ong',           process_name: 'Alerta a ONG y áreas protegidas',  node_kind: 'whatsapp',   step_order: 3,
      description: 'Rama verdadera: avisa por WhatsApp a la ONG o al área protegida de la zona.' },
    { id: N(4), slug: 'acreditacion_okn',     process_name: 'Acreditación de tokens OKN',       node_kind: 'base_datos', step_order: 3,
      description: 'Rama falsa: con el reporte verificado, acredita los OKN en el saldo del usuario.' },
    { id: N(5), slug: 'aviso_usuario',        process_name: 'Aviso de acreditación',            node_kind: 'email',      step_order: 4,
      description: 'Le escribe al usuario para avisarle que sus tokens quedaron acreditados.' },
  ];

  const disparos = [];
  const disparo = (flujo, s, run_status, detail, segundos) => disparos.push({
    id: idSemilla('e'), user_id: s.user_id, sighting_id: s.id, workflow_id: flujo,
    run_status, detail, triggered_at: masSeg(s.resolved_at ?? s.observed_at, segundos),
  });

  for (const s of avistamientos) {
    const esp = especies.find((e) => e.id === s.species_id);
    const conf = s.ai_confidence;

    disparos.push({
      id: idSemilla('e'), user_id: s.user_id, sighting_id: s.id, workflow_id: N(1),
      run_status: 'exito', detail: 'Alta recibida', triggered_at: masSeg(s.observed_at, 4),
    });
    disparos.push({
      id: idSemilla('e'), user_id: s.user_id, sighting_id: s.id, workflow_id: N(2),
      run_status: 'exito',
      detail: conf != null ? `Confianza ${Math.round(conf * 100)}%` : 'Sin clasificar',
      triggered_at: masSeg(s.observed_at, 6),
    });

    // Rama verdadera del triage: especie amenazada y por encima del umbral.
    if (conf != null && conf > UMBRAL_TRIAGE && esp && AMENAZADAS.has(esp.iucn_status)) {
      const zona = zonas.find((z) => z.id === s.zone_id);
      disparos.push({
        id: idSemilla('e'), user_id: s.user_id, sighting_id: s.id, workflow_id: N(3),
        run_status: 'exito',
        detail: `Aviso enviado por ${zona?.name ?? 'la zona'} · ${esp.common_name} (${esp.iucn_status})`,
        triggered_at: masSeg(s.observed_at, 9),
      });
    }

    // Rama falsa: la acreditación espera a que el reporte quede verificado.
    if (s.status === 'verificado') {
      disparo(N(4), s, 'exito', 'Saldo actualizado', 12);
      disparo(N(5), s, 'exito', 'Correo enviado al usuario', 15);
    } else if (s.status === 'pendiente' || s.status === 'en_votacion') {
      disparo(N(4), s, 'omitido', 'A la espera de que la comunidad resuelva la votación', 12);
    }
  }

  return {
    version: VERSION,
    creado: ahora,
    zonas, especies, usuarios, organizaciones, proyectos, hitos, sensores,
    avistamientos, votos, libro, recompensas, canjes: [], creditos, listados, ordenes,
    flujos, disparos,
  };
}

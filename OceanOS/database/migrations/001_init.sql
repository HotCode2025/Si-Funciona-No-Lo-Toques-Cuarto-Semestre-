-- =====================================================================
-- OceanOS · 001_init.sql
-- PostgreSQL 16+ (validado en 16, pensado para 18)
--
-- REGLA DEL MODELO: TODO CUELGA DE UNA ZONA.
-- El océano no se gestiona como un espacio continuo: se gestiona por
-- zonas (Golfo Nuevo, Península Valdés...). Avistamientos, sensores,
-- proyectos y créditos de carbono viven dentro de una zona. Eso es lo
-- que permite calcular salud del ecosistema y certificar carbono sobre
-- un polígono concreto en vez de sobre "el mar".
--
-- Las tres capas del producto, por profundidad:
--   Capa 1 · superficie -> users, sightings, sighting_votes, token_ledger
--   Capa 2 · columna    -> organizations, projects, sensors, readings
--   Capa 3 · lecho      -> carbon_credits, listings, orders
-- =====================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- ---------- TIPOS ----------------------------------------------------
CREATE TYPE user_role       AS ENUM ('ciudadano', 'organizacion', 'admin');
CREATE TYPE org_plan        AS ENUM ('starter', 'professional', 'enterprise');
CREATE TYPE org_kind        AS ENUM ('pesquera', 'ong', 'area_protegida', 'gobierno', 'investigacion');
CREATE TYPE sighting_kind   AS ENUM ('tiburon', 'kelp', 'fauna', 'amenaza');
CREATE TYPE review_status   AS ENUM ('pendiente', 'en_votacion', 'verificado', 'rechazado');
CREATE TYPE ledger_reason   AS ENUM ('reporte_basico', 'foto_verificada', 'racha_semanal', 'voto_comunidad', 'zona_nueva', 'canje', 'ajuste');
CREATE TYPE project_status  AS ENUM ('planificado', 'en_curso', 'monitoreo', 'finalizado', 'suspendido');
CREATE TYPE sensor_metric   AS ENUM ('temperatura', 'salinidad', 'biomasa', 'turbidez', 'oxigeno', 'ph');
CREATE TYPE credit_registry AS ENUM ('verra', 'gold_standard', 'interno');
CREATE TYPE credit_status   AS ENUM ('borrador', 'en_validacion', 'certificado', 'retirado');
CREATE TYPE asset_kind      AS ENUM ('credito_carbono', 'hectarea_viva', 'bono_restauracion');
CREATE TYPE listing_status  AS ENUM ('borrador', 'publicado', 'pausado', 'agotado');
CREATE TYPE order_status    AS ENUM ('pendiente', 'pagada', 'liquidada', 'cancelada');
CREATE TYPE n8n_node_kind   AS ENUM ('webhook', 'condicion', 'whatsapp', 'base_datos', 'email');
CREATE TYPE n8n_run_status  AS ENUM ('exito', 'fallo', 'omitido');

-- =====================================================================
-- 1. ZONAS · el ancla de todo el modelo
-- Sin PostGIS a propósito: bounding box + centroide alcanzan para el
-- MVP y el proyecto se instala sin dependencias extra.
-- =====================================================================
CREATE TABLE zones (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text UNIQUE NOT NULL,
  name         text NOT NULL,
  province     text NOT NULL DEFAULT 'Chubut',
  center_lat   numeric(9,6) NOT NULL,
  center_lng   numeric(9,6) NOT NULL,
  min_lat      numeric(9,6) NOT NULL,
  max_lat      numeric(9,6) NOT NULL,
  min_lng      numeric(9,6) NOT NULL,
  max_lng      numeric(9,6) NOT NULL,
  area_km2     numeric(10,2),
  is_protected boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT zones_bbox_valida CHECK (min_lat < max_lat AND min_lng < max_lng)
);

-- =====================================================================
-- 2. ESPECIES · taxonomía validada (acuerdo con CONICET/CENPAT)
-- =====================================================================
CREATE TABLE species (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scientific_name text UNIQUE NOT NULL,
  common_name     text NOT NULL,
  kind            sighting_kind NOT NULL,
  iucn_status     text,
  is_key_species  boolean NOT NULL DEFAULT false,
  notes           text
);

-- =====================================================================
-- 3. USUARIOS
-- =====================================================================
CREATE TABLE users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento      text UNIQUE,            -- MER: identificador del ciudadano (DNI)
  email          citext UNIQUE NOT NULL,
  password_hash  text NOT NULL,
  full_name      text NOT NULL,
  role           user_role NOT NULL DEFAULT 'ciudadano',
  home_zone_id   uuid REFERENCES zones(id) ON DELETE SET NULL,
  reputation     integer NOT NULL DEFAULT 100 CHECK (reputation BETWEEN 0 AND 1000),
  streak_days    integer NOT NULL DEFAULT 0,
  last_report_on date,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX users_role_idx ON users (role);

-- =====================================================================
-- CAPA 1 · SUPERFICIE — ciencia ciudadana
-- =====================================================================

CREATE TABLE sightings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id        uuid NOT NULL REFERENCES zones(id) ON DELETE RESTRICT,
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  species_id     uuid REFERENCES species(id) ON DELETE SET NULL,
  kind           sighting_kind NOT NULL,
  lat            numeric(9,6) NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng            numeric(9,6) NOT NULL CHECK (lng BETWEEN -180 AND 180),
  depth_m        numeric(6,2) CHECK (depth_m >= 0),
  individuals    integer CHECK (individuals > 0),
  -- Cobertura de kelp en % cuando kind = 'kelp'
  kelp_cover_pct numeric(5,2) CHECK (kelp_cover_pct BETWEEN 0 AND 100),
  photo_url      text,
  -- Confianza del modelo on-device (0 a 1). Bajo 0.80 va a votación.
  ai_confidence  numeric(4,3) CHECK (ai_confidence BETWEEN 0 AND 1),
  ai_label       text,
  notes          text,
  status         review_status NOT NULL DEFAULT 'pendiente',
  observed_at    timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  resolved_at    timestamptz
);
CREATE INDEX sightings_zone_fecha_idx ON sightings (zone_id, observed_at DESC);
CREATE INDEX sightings_user_idx       ON sightings (user_id, observed_at DESC);
CREATE INDEX sightings_status_idx     ON sightings (status) WHERE status = 'en_votacion';
CREATE INDEX sightings_bbox_idx       ON sightings (lat, lng);

-- Votación comunitaria: 3 votos resuelven un reporte de baja confianza.
CREATE TABLE sighting_votes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sighting_id uuid NOT NULL REFERENCES sightings(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agrees      boolean NOT NULL,
  species_id  uuid REFERENCES species(id) ON DELETE SET NULL,
  -- Peso del voto = reputación del votante al momento de votar.
  weight      integer NOT NULL DEFAULT 100,
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- Un voto por usuario por reporte, y nadie vota su propio reporte
  -- (eso lo refuerza el servicio, acá queda la unicidad).
  UNIQUE (sighting_id, user_id)
);

-- Libro mayor de tokens OKN. Append-only: el saldo es la suma, nunca
-- se guarda un balance denormalizado que se pueda desincronizar.
CREATE TABLE token_ledger (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount      integer NOT NULL CHECK (amount <> 0),
  reason      ledger_reason NOT NULL,
  sighting_id uuid REFERENCES sightings(id) ON DELETE SET NULL,
  detail      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX token_ledger_user_idx ON token_ledger (user_id, created_at DESC);

-- Recompensas de operadores turísticos de Puerto Madryn.
CREATE TABLE rewards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id     uuid REFERENCES zones(id) ON DELETE SET NULL,
  partner     text NOT NULL,
  title       text NOT NULL,
  description text,
  cost_okn    integer NOT NULL CHECK (cost_okn > 0),
  stock       integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  is_active   boolean NOT NULL DEFAULT true
);

CREATE TABLE redemptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_id   uuid NOT NULL REFERENCES rewards(id) ON DELETE RESTRICT,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cost_okn    integer NOT NULL,
  code        text UNIQUE NOT NULL,
  redeemed_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
-- CAPA 2 · COLUMNA DE AGUA — SaaS marino B2B
-- =====================================================================

CREATE TABLE organizations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text UNIQUE NOT NULL,
  name        text NOT NULL,
  kind        org_kind NOT NULL,
  plan        org_plan NOT NULL DEFAULT 'starter',
  cuit        text,
  contact_email citext,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE org_members (
  org_id    uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_owner  boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);

-- Límites por plan. Los lee el middleware antes de crear un proyecto.
CREATE TABLE plan_limits (
  plan            org_plan PRIMARY KEY,
  max_projects    integer,        -- NULL = ilimitado
  max_members     integer,
  monthly_usd     integer NOT NULL,
  has_iot         boolean NOT NULL DEFAULT false,
  has_reports     boolean NOT NULL DEFAULT false,
  has_carbon      boolean NOT NULL DEFAULT false,
  has_api         boolean NOT NULL DEFAULT false
);

CREATE TABLE projects (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  zone_id       uuid NOT NULL REFERENCES zones(id) ON DELETE RESTRICT,
  name          text NOT NULL,
  description   text,
  status        project_status NOT NULL DEFAULT 'planificado',
  hectares      numeric(10,2) NOT NULL DEFAULT 0 CHECK (hectares >= 0),
  target_hectares numeric(10,2) CHECK (target_hectares >= 0),
  started_on    date,
  ends_on       date,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT projects_fechas CHECK (ends_on IS NULL OR started_on IS NULL OR ends_on >= started_on)
);
CREATE INDEX projects_org_idx  ON projects (org_id, status);
CREATE INDEX projects_zone_idx ON projects (zone_id);

-- Hitos: lo que después alimenta los reportes a BID/GEF.
CREATE TABLE project_milestones (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title       text NOT NULL,
  due_on      date,
  done_on     date,
  position    integer NOT NULL DEFAULT 0
);

CREATE TABLE sensors (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id     uuid NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  project_id  uuid REFERENCES projects(id) ON DELETE SET NULL,
  code        text UNIQUE NOT NULL,
  label       text NOT NULL,
  lat         numeric(9,6) NOT NULL,
  lng         numeric(9,6) NOT NULL,
  depth_m     numeric(6,2),
  is_online   boolean NOT NULL DEFAULT true,
  installed_on date
);

CREATE TABLE sensor_readings (
  id         bigserial PRIMARY KEY,
  sensor_id  uuid NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
  metric     sensor_metric NOT NULL,
  value      numeric(10,3) NOT NULL,
  unit       text NOT NULL,
  read_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sensor_readings_serie_idx ON sensor_readings (sensor_id, metric, read_at DESC);

-- =====================================================================
-- CAPA 3 · LECHO MARINO — activos de océano
-- =====================================================================

CREATE TABLE carbon_credits (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  registry      credit_registry NOT NULL DEFAULT 'interno',
  registry_ref  text,
  vintage_year  integer NOT NULL CHECK (vintage_year BETWEEN 2020 AND 2100),
  tons_co2      numeric(12,3) NOT NULL CHECK (tons_co2 > 0),
  status        credit_status NOT NULL DEFAULT 'borrador',
  certified_on  date,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (registry, registry_ref)
);

CREATE TABLE listings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  credit_id     uuid REFERENCES carbon_credits(id) ON DELETE SET NULL,
  asset_kind    asset_kind NOT NULL,
  title         text NOT NULL,
  summary       text,
  unit_label    text NOT NULL,                      -- "tCO₂e", "hectárea"
  unit_price_usd numeric(12,2) NOT NULL CHECK (unit_price_usd > 0),
  units_total   numeric(12,3) NOT NULL CHECK (units_total > 0),
  units_sold    numeric(12,3) NOT NULL DEFAULT 0 CHECK (units_sold >= 0),
  -- Comisión de OceanOS: 8 a 12% según el documento fundacional.
  commission_pct numeric(4,2) NOT NULL DEFAULT 10.00 CHECK (commission_pct BETWEEN 8 AND 12),
  status        listing_status NOT NULL DEFAULT 'borrador',
  published_at  timestamptz,
  CONSTRAINT listings_no_sobrevende CHECK (units_sold <= units_total)
);
CREATE INDEX listings_publicados_idx ON listings (status, asset_kind) WHERE status = 'publicado';

CREATE TABLE orders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id    uuid NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
  buyer_org_id  uuid REFERENCES organizations(id) ON DELETE SET NULL,
  buyer_name    text NOT NULL,
  buyer_email   citext NOT NULL,
  units         numeric(12,3) NOT NULL CHECK (units > 0),
  unit_price_usd numeric(12,2) NOT NULL,
  gross_usd     numeric(14,2) NOT NULL,
  commission_usd numeric(14,2) NOT NULL,
  status        order_status NOT NULL DEFAULT 'pendiente',
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_listing_idx ON orders (listing_id, created_at DESC);

-- =====================================================================
-- AUTOMATIZACIÓN · n8n
-- El MER entregado abstrae la relación Registra (Usuario–Avistamiento)
-- como una entidad de alto nivel, Evento_Reporte, y la vincula con
-- Workflow_n8n a través de la relación Dispara. Esa agregación N:M se
-- reduce acá a una tabla puente: cada fila dice qué reporte, de qué
-- usuario, disparó qué flujo, y cómo terminó.
-- =====================================================================

-- MER: Workflow_n8n (id_workflow, nombre_proceso)
CREATE TABLE n8n_workflows (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text UNIQUE NOT NULL,
  process_name text NOT NULL,
  node_kind    n8n_node_kind NOT NULL,
  step_order   smallint NOT NULL,
  description  text,
  is_active    boolean NOT NULL DEFAULT true
);

-- MER: log_disparo_n8n (documento, id_avistamiento, id_workflow).
-- La llave del MER es compuesta; acá se usa una subrogada porque un
-- mismo flujo puede correr dos veces sobre el mismo reporte (al cargarlo
-- y al resolverse la votación). El trío del MER queda como índice único
-- junto al momento del disparo.
CREATE TABLE n8n_trigger_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sighting_id  uuid NOT NULL REFERENCES sightings(id) ON DELETE CASCADE,
  workflow_id  uuid NOT NULL REFERENCES n8n_workflows(id) ON DELETE RESTRICT,
  run_status   n8n_run_status NOT NULL DEFAULT 'exito',
  detail       text,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, sighting_id, workflow_id, triggered_at)
);
CREATE INDEX n8n_log_sighting_idx ON n8n_trigger_log (sighting_id);
CREATE INDEX n8n_log_when_idx     ON n8n_trigger_log (triggered_at DESC);

-- =====================================================================
-- VISTAS CALCULADAS
-- Ninguna métrica se guarda a mano. Todo se deriva de los hechos.
-- =====================================================================

-- Saldo OKN de cada usuario = suma del libro mayor.
-- OJO: acá NO se puede hacer LEFT JOIN a token_ledger y a sightings a la
-- vez. Son dos ramas independientes del mismo usuario y el join las
-- multiplica entre sí (fan-out), inflando el saldo por la cantidad de
-- reportes. Van como subconsultas laterales, cada una agregada aparte.
CREATE VIEW user_balances AS
SELECT u.id        AS user_id,
       u.full_name,
       u.reputation,
       u.streak_days,
       t.balance_okn,
       t.ganados_okn,
       s.reportes,
       s.reportes_verificados
FROM users u
CROSS JOIN LATERAL (
  SELECT COALESCE(SUM(amount), 0)::integer                             AS balance_okn,
         COALESCE(SUM(amount) FILTER (WHERE amount > 0), 0)::integer   AS ganados_okn
  FROM token_ledger l WHERE l.user_id = u.id
) t
CROSS JOIN LATERAL (
  SELECT COUNT(*)::integer                                             AS reportes,
         COUNT(*) FILTER (WHERE status = 'verificado')::integer        AS reportes_verificados
  FROM sightings sg WHERE sg.user_id = u.id
) s;

-- Índice de salud del ecosistema por zona, 0 a 100.
-- Mezcla tres señales con pesos explícitos:
--   50% cobertura media de kelp
--   30% presencia de tiburones (apex predator, normalizada a 20 avistamientos/90d)
--   20% ausencia de amenazas reportadas
CREATE VIEW zone_health AS
WITH ventana AS (
  SELECT id AS zone_id, now() - interval '90 days' AS desde FROM zones
),
kelp AS (
  SELECT s.zone_id, AVG(s.kelp_cover_pct) AS cobertura
  FROM sightings s JOIN ventana v ON v.zone_id = s.zone_id
  WHERE s.kind = 'kelp' AND s.status = 'verificado'
    AND s.kelp_cover_pct IS NOT NULL AND s.observed_at >= v.desde
  GROUP BY s.zone_id
),
tiburones AS (
  SELECT s.zone_id, COUNT(*) AS n
  FROM sightings s JOIN ventana v ON v.zone_id = s.zone_id
  WHERE s.kind = 'tiburon' AND s.status = 'verificado' AND s.observed_at >= v.desde
  GROUP BY s.zone_id
),
amenazas AS (
  SELECT s.zone_id, COUNT(*) AS n
  FROM sightings s JOIN ventana v ON v.zone_id = s.zone_id
  WHERE s.kind = 'amenaza' AND s.status <> 'rechazado' AND s.observed_at >= v.desde
  GROUP BY s.zone_id
)
SELECT z.id   AS zone_id,
       z.slug,
       z.name,
       ROUND(COALESCE(k.cobertura, 0), 1)                       AS kelp_cobertura_pct,
       COALESCE(t.n, 0)::integer                                AS avistamientos_tiburon,
       COALESCE(a.n, 0)::integer                                AS amenazas_abiertas,
       ROUND(
         0.50 * LEAST(COALESCE(k.cobertura, 0), 100)
       + 0.30 * LEAST(COALESCE(t.n, 0) * 5.0, 100)
       + 0.20 * GREATEST(100 - COALESCE(a.n, 0) * 10.0, 0)
       , 1)::numeric(5,1)                                       AS health_index
FROM zones z
LEFT JOIN kelp      k ON k.zone_id = z.id
LEFT JOIN tiburones t ON t.zone_id = z.id
LEFT JOIN amenazas  a ON a.zone_id = z.id;

-- Resumen de proyecto: hectáreas, hitos cumplidos y carbono certificado.
-- Mismo cuidado que en user_balances: hitos y créditos son dos ramas
-- independientes del proyecto, así que van en subconsultas separadas.
-- Si se juntaran con dos LEFT JOIN, el total de toneladas quedaría
-- multiplicado por la cantidad de hitos.
CREATE VIEW project_summary AS
SELECT p.id      AS project_id,
       p.org_id,
       p.zone_id,
       p.name,
       p.status,
       p.hectares,
       p.target_hectares,
       CASE WHEN COALESCE(p.target_hectares, 0) > 0
            THEN ROUND(p.hectares / p.target_hectares * 100, 1)
            ELSE NULL END::numeric(5,1)  AS avance_pct,
       h.hitos,
       h.hitos_cumplidos,
       c.tco2_certificado,
       c.tco2_en_validacion
FROM projects p
CROSS JOIN LATERAL (
  SELECT COUNT(*)::integer                                        AS hitos,
         COUNT(*) FILTER (WHERE done_on IS NOT NULL)::integer      AS hitos_cumplidos
  FROM project_milestones m WHERE m.project_id = p.id
) h
CROSS JOIN LATERAL (
  SELECT COALESCE(SUM(tons_co2) FILTER (WHERE status = 'certificado'), 0)::numeric(12,3)   AS tco2_certificado,
         COALESCE(SUM(tons_co2) FILTER (WHERE status = 'en_validacion'), 0)::numeric(12,3) AS tco2_en_validacion
  FROM carbon_credits cc WHERE cc.project_id = p.id
) c;

COMMIT;

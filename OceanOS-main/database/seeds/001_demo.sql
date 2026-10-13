-- =====================================================================
-- OceanOS · 001_demo.sql — datos de demostración
--
-- Zonas y especies REALES del Atlántico Sur patagónico. Los usuarios,
-- organizaciones y transacciones son ficticios.
-- Todas las cuentas usan la contraseña: oceano1234
-- =====================================================================

BEGIN;

-- ---------- ZONAS ----------------------------------------------------
INSERT INTO zones (id, slug, name, province, center_lat, center_lng, min_lat, max_lat, min_lng, max_lng, area_km2, is_protected) VALUES
 ('11111111-0000-0000-0000-000000000001','golfo-nuevo','Golfo Nuevo','Chubut',
   -42.740000, -64.930000, -42.900000, -42.450000, -65.150000, -64.500000, 2350.00, false),
 ('11111111-0000-0000-0000-000000000002','peninsula-valdes','Península Valdés','Chubut',
   -42.500000, -63.950000, -42.900000, -42.100000, -64.600000, -63.500000, 3600.00, true),
 ('11111111-0000-0000-0000-000000000003','golfo-san-jose','Golfo San José','Chubut',
   -42.350000, -64.300000, -42.450000, -42.180000, -64.600000, -63.950000, 817.00, true),
 ('11111111-0000-0000-0000-000000000004','bahia-camarones','Bahía Camarones','Chubut',
   -44.800000, -65.700000, -45.050000, -44.550000, -65.950000, -65.400000, 1120.00, false);

-- ---------- ESPECIES -------------------------------------------------
INSERT INTO species (id, scientific_name, common_name, kind, iucn_status, is_key_species, notes) VALUES
 ('22222222-0000-0000-0000-000000000001','Macrocystis pyrifera','Cachiyuyo (kelp gigante)','kelp','DD',true,
  'Forma los bosques submarinos del Atlántico Sur. Sumidero de carbono azul.'),
 ('22222222-0000-0000-0000-000000000002','Notorynchus cepedianus','Gatopardo','tiburon','VU',true,
  'Apex predator del Golfo Nuevo. Su presencia sostiene el equilibrio trófico del bosque de kelp.'),
 ('22222222-0000-0000-0000-000000000003','Carcharias taurus','Escalandrún','tiburon','CR',true,
  'Población del Atlántico Sudoccidental en estado crítico.'),
 ('22222222-0000-0000-0000-000000000004','Galeorhinus galeus','Cazón','tiburon','CR',true,
  'Históricamente sobrepescado en aguas argentinas.'),
 ('22222222-0000-0000-0000-000000000005','Mustelus schmitti','Gatuzo','tiburon','EN',false,
  'Especie costera, captura incidental frecuente.'),
 ('22222222-0000-0000-0000-000000000006','Squatina guggenheim','Pez ángel','tiburon','EN',false,
  'Bentónico, muy vulnerable al arrastre de fondo.'),
 ('22222222-0000-0000-0000-000000000007','Eubalaena australis','Ballena franca austral','fauna','LC',false,
  'Cría en Golfo Nuevo y Golfo San José entre junio y diciembre.'),
 ('22222222-0000-0000-0000-000000000008','Otaria flavescens','Lobo marino de un pelo','fauna','LC',false,NULL),
 ('22222222-0000-0000-0000-000000000009','Spheniscus magellanicus','Pingüino de Magallanes','fauna','LC',false,NULL),
 ('22222222-0000-0000-0000-00000000000a','Undaria pinnatifida','Alga invasora (wakame)','amenaza',NULL,false,
  'Invasora establecida en Golfo Nuevo desde 1992. Desplaza al cachiyuyo nativo.');

-- ---------- LÍMITES POR PLAN ----------------------------------------
-- MODO DEMOSTRACIÓN: los tres planes están abiertos y en cero. Ninguna
-- organización se topa con un límite, así que todas las pantallas del
-- producto se pueden recorrer con cualquier cuenta.
--
-- El código de los planes NO se tocó: `crear` sigue leyendo max_projects
-- y `sensores` sigue leyendo has_iot (projects.service.js). Lo único que
-- cambió son los valores, así que para volver a mostrar el bloqueo por
-- plan alcanza con restaurar estas tres filas:
--
--   ('starter',       1, 5,   500, false, false, false, false),
--   ('professional',  5, 20, 2000, true,  true,  false, false),
--   ('enterprise', NULL, NULL,8000, true,  true,  true,  true);
--
-- NULL en max_projects/max_members significa ilimitado (ver 001_init.sql).
INSERT INTO plan_limits (plan, max_projects, max_members, monthly_usd, has_iot, has_reports, has_carbon, has_api) VALUES
 ('starter',      NULL, NULL, 0, true, true, true, true),
 ('professional', NULL, NULL, 0, true, true, true, true),
 ('enterprise',   NULL, NULL, 0, true, true, true, true);

-- ---------- USUARIOS -------------------------------------------------
-- Contraseña de todas las cuentas: oceano1234
INSERT INTO users (id, documento, email, password_hash, full_name, role, home_zone_id, reputation, streak_days, last_report_on) VALUES
 ('33333333-0000-0000-0000-000000000001','44812309','admin@oceanos.ar',    '$2b$10$E7BT.7s9B5RaZTZeV7pH6uwVOFAf0snpvF09fjRnhBnvhhGLm4rxK','Lautaro Martinez','admin',       '11111111-0000-0000-0000-000000000001',1000, 0,NULL),
 ('33333333-0000-0000-0000-000000000002','41250877','buzo@oceanos.ar',     '$2b$10$E7BT.7s9B5RaZTZeV7pH6uwVOFAf0snpvF09fjRnhBnvhhGLm4rxK','Gabriel Maculus','ciudadano',    '11111111-0000-0000-0000-000000000001', 480,12,CURRENT_DATE),
 ('33333333-0000-0000-0000-000000000003','43907165','leandro@oceanos.ar',  '$2b$10$E7BT.7s9B5RaZTZeV7pH6uwVOFAf0snpvF09fjRnhBnvhhGLm4rxK','Leandro Orozco','ciudadano',     '11111111-0000-0000-0000-000000000001', 320, 5,CURRENT_DATE - 1),
 ('33333333-0000-0000-0000-000000000005','40118542','otar@oceanos.ar',     '$2b$10$E7BT.7s9B5RaZTZeV7pH6uwVOFAf0snpvF09fjRnhBnvhhGLm4rxK','Otar','ciudadano',               '11111111-0000-0000-0000-000000000003', 640, 21,CURRENT_DATE),
 ('33333333-0000-0000-0000-000000000008','38264910','jose@oceanos.ar',     '$2b$10$E7BT.7s9B5RaZTZeV7pH6uwVOFAf0snpvF09fjRnhBnvhhGLm4rxK','Jose Rodriguez','organizacion',  '11111111-0000-0000-0000-000000000002', 100, 0,NULL),
 -- Cuenta del proyecto, la que se usa para mostrar la app: no es de ningún
 -- integrante y arranca sin reportes.
 ('33333333-0000-0000-0000-000000000009',NULL,'demo@oceanos.ar',     '$2b$10$E7BT.7s9B5RaZTZeV7pH6uwVOFAf0snpvF09fjRnhBnvhhGLm4rxK','OceanOS','ciudadano',           '11111111-0000-0000-0000-000000000001', 100, 0,NULL);

-- ---------- ORGANIZACIONES ------------------------------------------
INSERT INTO organizations (id, slug, name, kind, plan, contact_email) VALUES
 ('44444444-0000-0000-0000-000000000001','fundacion-kelp','Fundación Kelp Patagonia','ong','professional','contacto@kelppatagonia.ar'),
 ('44444444-0000-0000-0000-000000000002','pesquera-atlantico','Pesquera Atlántico Sur','pesquera','starter','ops@pesqueraatlantico.ar'),
 ('44444444-0000-0000-0000-000000000003','apn-valdes','Área Protegida Península Valdés','area_protegida','enterprise','tecnica@apvaldes.gob.ar');

INSERT INTO org_members (org_id, user_id, is_owner) VALUES
 ('44444444-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000001',true),
 ('44444444-0000-0000-0000-000000000003','33333333-0000-0000-0000-000000000008',true);

-- ---------- PROYECTOS DE RESTAURACIÓN -------------------------------
INSERT INTO projects (id, org_id, zone_id, name, description, status, hectares, target_hectares, started_on, ends_on) VALUES
 ('55555555-0000-0000-0000-000000000001','44444444-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000001',
  'Refugios de kelp — Punta Este','Instalación de arrecifes artificiales y trasplante de esporofitos de Macrocystis en 40 hectáreas del Golfo Nuevo.',
  'en_curso', 26.50, 40.00, '2026-03-01','2027-06-30'),
 ('55555555-0000-0000-0000-000000000002','44444444-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000003',
  'Control de Undaria — Golfo San José','Extracción manual estacional del alga invasora para liberar sustrato al cachiyuyo nativo.',
  'monitoreo', 12.00, 15.00, '2025-09-15','2026-12-31'),
 ('55555555-0000-0000-0000-000000000003','44444444-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000002',
  'Corredor de apex predators','Monitoreo acústico de gatopardo y escalandrún para sostener la cadena trófica del bosque.',
  'en_curso', 80.00, 120.00, '2026-01-10', NULL),
 ('55555555-0000-0000-0000-000000000004','44444444-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000004',
  'Línea de base — Camarones','Relevamiento previo a certificación de carbono azul.','planificado', 0.00, 60.00, NULL, NULL);

INSERT INTO project_milestones (project_id, title, due_on, done_on, position) VALUES
 ('55555555-0000-0000-0000-000000000001','Relevamiento batimétrico del sitio','2026-03-20','2026-03-18',0),
 ('55555555-0000-0000-0000-000000000001','Instalación de 12 arrecifes artificiales','2026-05-30','2026-06-04',1),
 ('55555555-0000-0000-0000-000000000001','Primer trasplante de esporofitos','2026-08-15','2026-08-12',2),
 ('55555555-0000-0000-0000-000000000001','Medición de cobertura a 6 meses','2026-12-15',NULL,3),
 ('55555555-0000-0000-0000-000000000001','Validación externa CENPAT','2027-03-30',NULL,4),
 ('55555555-0000-0000-0000-000000000002','Campaña de extracción primavera','2026-10-01',NULL,0),
 ('55555555-0000-0000-0000-000000000002','Informe de recolonización nativa','2026-11-30',NULL,1),
 ('55555555-0000-0000-0000-000000000003','Despliegue de 6 receptores acústicos','2026-02-28','2026-02-25',0),
 ('55555555-0000-0000-0000-000000000003','Marcado de 20 ejemplares','2026-07-31','2026-08-09',1),
 ('55555555-0000-0000-0000-000000000003','Primer informe de residencia','2026-11-15',NULL,2);

-- ---------- SENSORES IoT --------------------------------------------
INSERT INTO sensors (id, zone_id, project_id, code, label, lat, lng, depth_m, is_online, installed_on) VALUES
 ('66666666-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000001','55555555-0000-0000-0000-000000000001','GN-01','Punta Este · boya norte',  -42.702000,-64.868000, 12.00,true, '2026-03-05'),
 ('66666666-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000001','55555555-0000-0000-0000-000000000001','GN-02','Punta Este · fondo 22m',   -42.711000,-64.855000, 22.00,true, '2026-03-05'),
 ('66666666-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000001',NULL,                                    'GN-03','Muelle Storni',            -42.788000,-65.032000,  8.00,false,'2025-11-20'),
 ('66666666-0000-0000-0000-000000000004','11111111-0000-0000-0000-000000000003','55555555-0000-0000-0000-000000000002','SJ-01','San José · banco central', -42.340000,-64.285000, 15.00,true, '2025-09-20'),
 ('66666666-0000-0000-0000-000000000005','11111111-0000-0000-0000-000000000002','55555555-0000-0000-0000-000000000003','PV-01','Valdés · corredor sur',    -42.610000,-63.880000, 30.00,true, '2026-01-15');

-- Series de lecturas: 30 días, una por día y por métrica.
INSERT INTO sensor_readings (sensor_id, metric, value, unit, read_at)
SELECT s.id,
       m.metric,
       CASE m.metric
         WHEN 'temperatura' THEN 12.5 + 2.4 * sin(d.n / 5.0) + (random() - 0.5) * 0.6
         WHEN 'salinidad'   THEN 33.6 + 0.4 * cos(d.n / 7.0) + (random() - 0.5) * 0.2
         WHEN 'biomasa'     THEN 4.10 + 0.9 * (d.n / 30.0)   + (random() - 0.5) * 0.3
         WHEN 'turbidez'    THEN 2.20 + 0.8 * sin(d.n / 3.0) + (random() - 0.5) * 0.4
         WHEN 'oxigeno'     THEN 7.80 + 0.5 * cos(d.n / 6.0) + (random() - 0.5) * 0.2
         ELSE                    8.05 + 0.10 * sin(d.n / 9.0)
       END,
       CASE m.metric
         WHEN 'temperatura' THEN '°C'  WHEN 'salinidad' THEN 'PSU'
         WHEN 'biomasa'     THEN 'kg/m²' WHEN 'turbidez' THEN 'NTU'
         WHEN 'oxigeno'     THEN 'mg/L' ELSE 'pH'
       END,
       now() - (d.n || ' days')::interval
FROM sensors s
CROSS JOIN generate_series(0, 29) AS d(n)
CROSS JOIN (VALUES ('temperatura'::sensor_metric), ('salinidad'), ('biomasa'), ('turbidez'), ('oxigeno'), ('ph')) AS m(metric)
WHERE s.is_online;

-- ---------- AVISTAMIENTOS -------------------------------------------
-- Kelp verificado en Golfo Nuevo: cobertura alta, salud alta.
INSERT INTO sightings (zone_id, user_id, species_id, kind, lat, lng, depth_m, kelp_cover_pct, ai_confidence, ai_label, status, observed_at, resolved_at, notes)
SELECT '11111111-0000-0000-0000-000000000001',
       '33333333-0000-0000-0000-000000000002',
       '22222222-0000-0000-0000-000000000001',
       'kelp',
       -42.55 - ((n * 13) % 30) * 0.011,
       -65.08 + ((n * 7) % 24) * 0.023,
       8 + (n % 14),
       58 + (n % 32),
       0.88 + (n % 10) * 0.01,
       'Macrocystis pyrifera',
       'verificado',
       now() - ((n * 2) || ' days')::interval,
       now() - ((n * 2) || ' days')::interval + interval '3 hours',
       NULL
FROM generate_series(1, 22) AS n;

-- Tiburones verificados: gatopardo y escalandrún.
INSERT INTO sightings (zone_id, user_id, species_id, kind, lat, lng, depth_m, individuals, ai_confidence, ai_label, status, observed_at, resolved_at)
SELECT '11111111-0000-0000-0000-000000000001',
       -- Otar, Leandro y Lautaro, de a dos: con n % 3 uno se quedaría con
       -- todos los escalandrunes, que salen justamente de n % 3.
       CASE (n / 2) % 3
         WHEN 0 THEN '33333333-0000-0000-0000-000000000005'::uuid
         WHEN 1 THEN '33333333-0000-0000-0000-000000000003'::uuid
         ELSE        '33333333-0000-0000-0000-000000000001'::uuid END,
       CASE WHEN n % 3 = 0 THEN '22222222-0000-0000-0000-000000000003'::uuid ELSE '22222222-0000-0000-0000-000000000002'::uuid END,
       'tiburon',
       -42.52 - ((n * 17) % 32) * 0.010,
       -65.05 + ((n * 11) % 26) * 0.021,
       10 + (n % 20),
       1 + (n % 3),
       0.82 + (n % 12) * 0.012,
       CASE WHEN n % 3 = 0 THEN 'Carcharias taurus' ELSE 'Notorynchus cepedianus' END,
       'verificado',
       now() - ((n * 4) || ' days')::interval,
       now() - ((n * 4) || ' days')::interval + interval '5 hours'
FROM generate_series(1, 14) AS n;

-- Fauna en Península Valdés, reportada por Jose desde el área protegida.
INSERT INTO sightings (zone_id, user_id, species_id, kind, lat, lng, individuals, ai_confidence, ai_label, status, observed_at, resolved_at)
SELECT '11111111-0000-0000-0000-000000000002',
       '33333333-0000-0000-0000-000000000008',
       '22222222-0000-0000-0000-000000000007',
       'fauna',
       -42.18 - ((n * 19) % 28) * 0.024,
       -64.52 + ((n * 13) % 22) * 0.045,
       1 + (n % 4),
       0.94,
       'Eubalaena australis',
       'verificado',
       now() - ((n * 3) || ' days')::interval,
       now() - ((n * 3) || ' days')::interval + interval '2 hours'
FROM generate_series(1, 9) AS n;

-- Lobos marinos y pingüinos, todos verificados: ocho de Lautaro y dos de
-- Leandro. Suman reportes sin mover el índice de salud, que solo mira
-- cachiyuyo, tiburones y amenazas.
INSERT INTO sightings (zone_id, user_id, species_id, kind, lat, lng, individuals, ai_confidence, ai_label, status, observed_at, resolved_at)
SELECT f.zona::uuid, f.autor::uuid, f.especie::uuid, 'fauna', f.lat, f.lng,
       2 + (f.n % 5),
       0.86 + (f.n % 4) * 0.03,
       f.etiqueta,
       'verificado',
       now() - ((2 + f.n * 5) || ' days')::interval,
       now() - ((2 + f.n * 5) || ' days')::interval + interval '3 hours'
FROM (VALUES
 (0,'11111111-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000008',-42.690,-64.780,'Otaria flavescens'),
 (1,'11111111-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000008',-42.745,-64.650,'Otaria flavescens'),
 (2,'11111111-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000008',-42.800,-64.720,'Otaria flavescens'),
 (3,'11111111-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000008',-42.660,-64.560,'Otaria flavescens'),
 (4,'11111111-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000009',-42.300,-64.380,'Spheniscus magellanicus'),
 (5,'11111111-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000009',-42.320,-64.250,'Spheniscus magellanicus'),
 (6,'11111111-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000009',-42.290,-64.200,'Spheniscus magellanicus'),
 (7,'11111111-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000009',-42.335,-64.320,'Spheniscus magellanicus'),
 (8,'11111111-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000003','22222222-0000-0000-0000-000000000008',-42.720,-64.840,'Otaria flavescens'),
 (9,'11111111-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000003','22222222-0000-0000-0000-000000000008',-42.770,-64.600,'Otaria flavescens')
) AS f(n, zona, autor, especie, lat, lng, etiqueta);

-- Amenazas abiertas: alga invasora y red fantasma. Verificada no quiere
-- decir resuelta: sigue abierta hasta que la retiren, y cuenta igual.
INSERT INTO sightings (zone_id, user_id, species_id, kind, lat, lng, depth_m, ai_confidence, ai_label, status, notes, observed_at) VALUES
 ('11111111-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000002','22222222-0000-0000-0000-00000000000a','amenaza',
  -42.845000,-65.055000, 6.00, 0.91,'Undaria pinnatifida','verificado','Mancha densa de wakame sobre sustrato rocoso, ~200 m².', now() - interval '6 days'),
 ('11111111-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000003',NULL,'amenaza',
  -42.617000,-64.688000, 18.00, NULL, NULL,'verificado','Red de pesca abandonada enganchada en el arrecife artificial 7.', now() - interval '2 days'),
 ('11111111-0000-0000-0000-000000000003','33333333-0000-0000-0000-000000000005','22222222-0000-0000-0000-00000000000a','amenaza',
  -42.352000,-64.311000, 9.00, 0.86,'Undaria pinnatifida','verificado','Rebrote en el sector ya intervenido en 2025.', now() - interval '11 days');

-- Reportes en votación: confianza del modelo por debajo de 0.80.
INSERT INTO sightings (id, zone_id, user_id, species_id, kind, lat, lng, depth_m, individuals, ai_confidence, ai_label, status, notes, observed_at) VALUES
 ('77777777-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000005','22222222-0000-0000-0000-000000000005','tiburon',
  -42.487000,-64.902000, 14.00, 1, 0.61,'Mustelus schmitti','en_votacion','Visibilidad baja, no llegué a ver el patrón de manchas.', now() - interval '1 day'),
 ('77777777-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000006','tiburon',
  -42.876000,-64.611000, 25.00, 1, 0.54,'Squatina guggenheim','en_votacion','Semienterrado en la arena, foto de frente.', now() - interval '3 days'),
 ('77777777-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000005','22222222-0000-0000-0000-000000000001','kelp',
  -42.512000,-65.121000,  7.00, NULL, 0.72,'Macrocystis pyrifera','en_votacion','¿Cachiyuyo joven o Undaria? No me la juego.', now() - interval '4 days');

-- Un voto ya emitido en el primer reporte en votación. El reporte es de
-- Otar, así que vota otra persona: nadie vota su propio reporte.
INSERT INTO sighting_votes (sighting_id, user_id, agrees, species_id, weight) VALUES
 ('77777777-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000001', true, '22222222-0000-0000-0000-000000000005', 1000);

-- ---------- LIBRO MAYOR DE TOKENS -----------------------------------
-- Se deriva de los avistamientos ya cargados, con la tabla de premios de
-- sightings.service.js: un reporte válido paga 15 y, si queda verificado,
-- suma otros 25 OKN por la calidad del dato.
INSERT INTO token_ledger (user_id, amount, reason, sighting_id, created_at)
SELECT user_id, 15, 'reporte_basico', id, created_at
FROM sightings;

INSERT INTO token_ledger (user_id, amount, reason, sighting_id, created_at)
SELECT user_id, 25, 'foto_verificada', id, COALESCE(resolved_at, created_at + interval '4 hours')
FROM sightings WHERE status = 'verificado';

INSERT INTO token_ledger (user_id, amount, reason, detail, created_at) VALUES
 ('33333333-0000-0000-0000-000000000002', 50,'racha_semanal','Racha de 7 días', now() - interval '5 days'),
 ('33333333-0000-0000-0000-000000000005', 50,'racha_semanal','Racha de 7 días', now() - interval '9 days'),
 ('33333333-0000-0000-0000-000000000005',100,'zona_nueva','Primer reporte en Golfo San José', now() - interval '30 days'),
 ('33333333-0000-0000-0000-000000000001', 10,'voto_comunidad','Voto en reporte de baja confianza', now() - interval '1 day'),
 ('33333333-0000-0000-0000-000000000003', 10,'voto_comunidad','Voto en reporte de baja confianza', now() - interval '6 hours'),
 ('33333333-0000-0000-0000-000000000009',200,'ajuste','Bienvenida a la cuenta de demostración', now() - interval '2 hours');

-- ---------- RECOMPENSAS ---------------------------------------------
INSERT INTO rewards (zone_id, partner, title, description, cost_okn, stock) VALUES
 ('11111111-0000-0000-0000-000000000001','Madryn Buceo','Bautismo de buceo','Inmersión guiada de 40 minutos en el bosque de cachiyuyo de Punta Este.',1200,8),
 ('11111111-0000-0000-0000-000000000001','Náutica Golfo','Avistaje de ballenas','Salida embarcada de 90 minutos, temporada junio a diciembre.',1800,12),
 ('11111111-0000-0000-0000-000000000002','Valdés Expediciones','Snorkel con lobos marinos','Salida de medio día a Punta Loma con equipo incluido.',1500,6),
 ('11111111-0000-0000-0000-000000000001','Café del Muelle','Café de especialidad','Un café y una medialuna en el muelle Piedrabuena.',150,100);

-- ---------- CARBONO Y MARKETPLACE -----------------------------------
INSERT INTO carbon_credits (id, project_id, registry, registry_ref, vintage_year, tons_co2, status, certified_on) VALUES
 ('88888888-0000-0000-0000-000000000001','55555555-0000-0000-0000-000000000001','verra','VCS-AR-2026-0417',2026, 1840.500,'certificado','2026-07-22'),
 ('88888888-0000-0000-0000-000000000002','55555555-0000-0000-0000-000000000003','gold_standard','GS-11288',2026, 3120.000,'certificado','2026-08-30'),
 ('88888888-0000-0000-0000-000000000003','55555555-0000-0000-0000-000000000002','interno',NULL,2026,  610.250,'en_validacion',NULL);

INSERT INTO listings (id, project_id, credit_id, asset_kind, title, summary, unit_label, unit_price_usd, units_total, units_sold, commission_pct, status, published_at) VALUES
 ('99999999-0000-0000-0000-000000000001','55555555-0000-0000-0000-000000000001','88888888-0000-0000-0000-000000000001','credito_carbono',
  'Carbono azul · Punta Este 2026','Créditos verificados por Verra sobre 26,5 hectáreas de bosque de cachiyuyo restaurado en el Golfo Nuevo.',
  'tCO₂e', 42.00, 1840.500, 620.000, 10.00,'publicado', now() - interval '40 days'),
 ('99999999-0000-0000-0000-000000000002','55555555-0000-0000-0000-000000000003','88888888-0000-0000-0000-000000000002','credito_carbono',
  'Carbono azul · Corredor Valdés 2026','Créditos Gold Standard sobre el corredor de apex predators de Península Valdés.',
  'tCO₂e', 51.00, 3120.000, 410.000, 12.00,'publicado', now() - interval '12 days'),
 ('99999999-0000-0000-0000-000000000003','55555555-0000-0000-0000-000000000001',NULL,'hectarea_viva',
  'Hectárea viva · Golfo Nuevo','Apadrinamiento de una hectárea de bosque restaurado con reporte anual de biodiversidad y acceso al panel de métricas.',
  'hectárea', 3800.00, 40.000, 11.000, 8.00,'publicado', now() - interval '65 days'),
 ('99999999-0000-0000-0000-000000000004','55555555-0000-0000-0000-000000000002',NULL,'bono_restauracion',
  'Bono de restauración · San José','Instrumento a 36 meses atado a hitos de recolonización de cachiyuyo nativo tras el control de Undaria.',
  'bono', 1000.00, 250.000, 0.000, 9.00,'borrador', NULL);

INSERT INTO orders (listing_id, buyer_org_id, buyer_name, buyer_email, units, unit_price_usd, gross_usd, commission_usd, status, created_at) VALUES
 ('99999999-0000-0000-0000-000000000001',NULL,'Naviera Austral S.A.','esg@navieraaustral.com',   420.000, 42.00, 17640.00, 1764.00,'liquidada', now() - interval '31 days'),
 ('99999999-0000-0000-0000-000000000001',NULL,'Bodega Valle Azul','sustentabilidad@vallazul.ar', 200.000, 42.00,  8400.00,  840.00,'pagada',    now() - interval '9 days'),
 ('99999999-0000-0000-0000-000000000002',NULL,'Fondo Patagonia ESG','deals@patagoniaesg.com',    410.000, 51.00, 20910.00, 2509.20,'pagada',    now() - interval '5 days'),
 ('99999999-0000-0000-0000-000000000003',NULL,'Grupo Litoral','rse@grupolitoral.com.ar',          11.000,3800.00, 41800.00, 3344.00,'liquidada', now() - interval '20 days');

-- ---------------------------------------------------------------------
-- Automatización n8n
-- Los cinco nodos del flujo entregado en el MER, y el registro de qué
-- reporte disparó cuál. El log no se escribe a mano: se deriva de los
-- avistamientos, igual que el resto de las métricas del proyecto.
-- ---------------------------------------------------------------------
INSERT INTO n8n_workflows (id, slug, process_name, node_kind, step_order, description) VALUES
 ('88888888-0000-0000-0000-000000000001','webhook_avistamiento','Webhook · alta de avistamiento','webhook',1,
  'Recibe el INSERT de la tabla de avistamientos y arranca el flujo.'),
 ('88888888-0000-0000-0000-000000000002','triage_confianza','Triage lógico','condicion',2,
  'Evalúa si la confianza de la IA supera el 80% y si la especie está amenazada.'),
 ('88888888-0000-0000-0000-000000000003','alerta_ong','Alerta a ONG y áreas protegidas','whatsapp',3,
  'Rama verdadera: avisa por WhatsApp a la ONG o al área protegida de la zona.'),
 ('88888888-0000-0000-0000-000000000004','acreditacion_okn','Acreditación de tokens OKN','base_datos',3,
  'Rama falsa: una vez verificado el reporte, acredita los OKN en el saldo del usuario.'),
 ('88888888-0000-0000-0000-000000000005','aviso_usuario','Aviso de acreditación','email',4,
  'Le escribe al usuario para avisarle que sus tokens quedaron acreditados.');

-- Nodo 1 y 2: corren para todo reporte, sin excepción.
INSERT INTO n8n_trigger_log (user_id, sighting_id, workflow_id, run_status, detail, triggered_at)
SELECT s.user_id, s.id, w.id, 'exito',
       CASE w.slug WHEN 'webhook_avistamiento' THEN 'Alta recibida'
                   ELSE 'Confianza ' || COALESCE(round(s.ai_confidence * 100)::text || '%', 'sin clasificar') END,
       s.observed_at + interval '4 seconds'
FROM sightings s
CROSS JOIN n8n_workflows w
WHERE w.slug IN ('webhook_avistamiento','triage_confianza');

-- Nodo 3, rama verdadera: especie amenazada reconocida con más del 80%.
INSERT INTO n8n_trigger_log (user_id, sighting_id, workflow_id, run_status, detail, triggered_at)
SELECT s.user_id, s.id, w.id, 'exito',
       'Aviso enviado por ' || z.name || ' · ' || sp.common_name || ' (' || sp.iucn_status || ')',
       s.observed_at + interval '9 seconds'
FROM sightings s
JOIN species sp ON sp.id = s.species_id
JOIN zones z    ON z.id  = s.zone_id
CROSS JOIN n8n_workflows w
WHERE w.slug = 'alerta_ong'
  AND s.ai_confidence > 0.80
  AND sp.iucn_status IN ('VU','EN','CR');

-- Nodos 3 y 4, rama falsa: el reporte queda verificado y se paga.
INSERT INTO n8n_trigger_log (user_id, sighting_id, workflow_id, run_status, detail, triggered_at)
SELECT s.user_id, s.id, w.id, 'exito',
       CASE w.slug WHEN 'acreditacion_okn' THEN 'Saldo actualizado'
                   ELSE 'Correo enviado al usuario' END,
       COALESCE(s.resolved_at, s.observed_at) + interval '12 seconds'
FROM sightings s
CROSS JOIN n8n_workflows w
WHERE w.slug IN ('acreditacion_okn','aviso_usuario')
  AND s.status = 'verificado';

-- Reportes todavía en votación: la acreditación queda pendiente.
INSERT INTO n8n_trigger_log (user_id, sighting_id, workflow_id, run_status, detail, triggered_at)
SELECT s.user_id, s.id, w.id, 'omitido',
       'A la espera de que la comunidad resuelva la votación',
       s.observed_at + interval '12 seconds'
FROM sightings s
CROSS JOIN n8n_workflows w
WHERE w.slug = 'acreditacion_okn'
  AND s.status IN ('pendiente','en_votacion');


COMMIT;

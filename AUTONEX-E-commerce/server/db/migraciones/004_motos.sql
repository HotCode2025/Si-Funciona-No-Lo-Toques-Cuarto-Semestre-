-- AUTONEX · 004 · módulo de motos
--
-- Las motos usan las MISMAS tablas que los autos (marcas_vehiculo, modelos_vehiculo, generaciones, vehiculos,
-- motores, compatibilidades, equivalencias, oem_productos, productos): así el selector, el buscador, los filtros,
-- el panel y el importador funcionan igual para las dos. Se distinguen por el segmento 'moto'.
-- Esta migración solo agrega lo propio de las motos, las imágenes con su origen y vistas con los nombres de la
-- especificación (motorcycle_brands, part_vehicle_compatibility, ...). No borra ni cambia datos existentes.

-- ---------------------------------------------------------------- segmento y tipos de vehículo
ALTER TABLE marcas_vehiculo DROP CONSTRAINT marcas_vehiculo_segmento_check,
  ADD CONSTRAINT marcas_vehiculo_segmento_check CHECK (segmento IN ('particular', 'comercial', 'pesado', 'mixto', 'moto'));
ALTER TABLE modelos_vehiculo DROP CONSTRAINT modelos_vehiculo_segmento_check,
  ADD CONSTRAINT modelos_vehiculo_segmento_check CHECK (segmento IN ('particular', 'comercial', 'pesado', 'moto'));
ALTER TABLE vehiculos DROP CONSTRAINT vehiculos_segmento_check,
  ADD CONSTRAINT vehiculos_segmento_check CHECK (segmento IN ('particular', 'comercial', 'pesado', 'moto'));

ALTER TABLE tipos_vehiculo DROP CONSTRAINT tipos_vehiculo_clase_check,
  ADD CONSTRAINT tipos_vehiculo_clase_check CHECK (clase IN ('liviano', 'comercial', 'pesado', 'propulsion', 'otro', 'moto'));
INSERT INTO tipos_vehiculo (slug, nombre, clase, orden) VALUES
  ('moto', 'Moto', 'moto', 30), ('scooter', 'Scooter', 'moto', 31), ('cuatriciclo', 'Cuatriciclo (ATV)', 'moto', 32),
  ('utv', 'UTV / side by side', 'moto', 33)
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------- motor: 2T/4T y alimentación
ALTER TABLE motores
  ADD COLUMN tiempos       TEXT CHECK (tiempos IN ('2T', '4T', 'electrico')),
  ADD COLUMN alimentacion  TEXT CHECK (alimentacion IN ('carburador', 'inyeccion', 'electrico'));
-- Las motos de 50 cc tienen 49 cc
ALTER TABLE motores DROP CONSTRAINT motores_cilindrada_cc_check,
  ADD CONSTRAINT motores_cilindrada_cc_check CHECK (cilindrada_cc IS NULL OR cilindrada_cc BETWEEN 20 AND 30000);

-- ---------------------------------------------------------------- presencia en Argentina (NULL = sin datos)
ALTER TABLE marcas_vehiculo
  ADD COLUMN disponible_argentina  BOOLEAN,
  ADD COLUMN oficial_argentina     BOOLEAN,
  ADD COLUMN importado             BOOLEAN,
  ADD COLUMN historico_argentina   BOOLEAN,
  ADD COLUMN internacional         BOOLEAN,
  ADD COLUMN wikidata              TEXT;
ALTER TABLE modelos_vehiculo
  ADD COLUMN disponible_argentina  BOOLEAN,
  ADD COLUMN oficial_argentina     BOOLEAN,
  ADD COLUMN importado             BOOLEAN,
  ADD COLUMN historico_argentina   BOOLEAN,
  ADD COLUMN internacional         BOOLEAN,
  ADD COLUMN wikidata              TEXT;

-- ---------------------------------------------------------------- categorías de motos (un modelo puede tener varias)
CREATE TABLE categorias_moto (
  id      SERIAL PRIMARY KEY,
  codigo  TEXT NOT NULL UNIQUE,
  nombre  TEXT NOT NULL,
  orden   SMALLINT NOT NULL DEFAULT 0
);
INSERT INTO categorias_moto (codigo, nombre, orden) VALUES
  ('MOTOCROSS', 'Motocross', 1), ('ENDURO', 'Enduro', 2), ('CROSS_COUNTRY', 'Cross country', 3), ('TRIAL', 'Trial', 4),
  ('SUPERMOTO', 'Supermoto', 5), ('DUAL_SPORT', 'Doble propósito', 6), ('TRAIL', 'Trail', 7), ('ADVENTURE', 'Adventure', 8),
  ('RALLY', 'Rally', 9), ('NAKED', 'Naked', 10), ('STREET', 'Calle', 11), ('SPORT', 'Deportiva', 12),
  ('SUPERSPORT', 'Superdeportiva', 13), ('SPORT_TOURING', 'Sport touring', 14), ('TOURING', 'Touring', 15),
  ('CRUISER', 'Cruiser', 16), ('CUSTOM', 'Custom', 17), ('BOBBER', 'Bobber', 18), ('CHOPPER', 'Chopper', 19),
  ('SCRAMBLER', 'Scrambler', 20), ('CAFE_RACER', 'Café racer', 21), ('CLASSIC', 'Clásica', 22),
  ('COMMUTER', 'Urbana / trabajo', 23), ('CUB', 'Cub', 24), ('UNDERBONE', 'Underbone', 25), ('SCOOTER', 'Scooter', 26),
  ('MAXI_SCOOTER', 'Maxi scooter', 27), ('ELECTRIC', 'Eléctrica', 28), ('COMPETITION', 'Competición', 29),
  ('KIDS', 'Infantil', 30), ('ATV', 'Cuatriciclo (ATV)', 31);

CREATE TABLE modelo_categorias_moto (
  modelo_id     INTEGER NOT NULL REFERENCES modelos_vehiculo(id) ON DELETE CASCADE,
  categoria_id  INTEGER NOT NULL REFERENCES categorias_moto(id) ON DELETE CASCADE,
  fuente_id            INTEGER REFERENCES fuentes(id) ON DELETE SET NULL,
  importacion_id       INTEGER REFERENCES importaciones(id) ON DELETE SET NULL,
  estado_verificacion  TEXT NOT NULL DEFAULT 'UNVERIFIED'
                       CHECK (estado_verificacion IN ('VERIFIED', 'UNVERIFIED', 'NEEDS_REVIEW', 'DISCONTINUED')),
  creado_en            TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (modelo_id, categoria_id)
);
CREATE INDEX modelo_categorias_moto_categoria_idx ON modelo_categorias_moto (categoria_id);

-- ---------------------------------------------------------------- repuestos: rubro, UPC y años en la compatibilidad
ALTER TABLE categorias ADD COLUMN rubro TEXT NOT NULL DEFAULT 'autos' CHECK (rubro IN ('autos', 'motos', 'general'));
ALTER TABLE marcas_repuesto
  ADD COLUMN para_autos  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN para_motos  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE productos ADD COLUMN upc TEXT;
-- Una pieza puede servir solo para algunos años de una versión: no se asume que sirve para todos
ALTER TABLE compatibilidades
  ADD COLUMN anio_desde  SMALLINT,
  ADD COLUMN anio_hasta  SMALLINT,
  ADD CONSTRAINT compatibilidades_anios_check CHECK (anio_hasta IS NULL OR anio_desde IS NULL OR anio_hasta >= anio_desde);

-- ---------------------------------------------------------------- imágenes reales con su origen
-- Para motos, versiones, repuestos y marcas. Solo imágenes de fuentes con licencia o autorización; si no hay una
-- legítima, no se inventa: la API informa IMAGE_MISSING.
CREATE TABLE imagenes (
  id             SERIAL PRIMARY KEY,
  entidad        TEXT NOT NULL CHECK (entidad IN ('producto', 'modelo', 'vehiculo', 'marca', 'marca_repuesto')),
  registro_id    INTEGER NOT NULL,
  tipo           TEXT NOT NULL DEFAULT 'principal'
                 CHECK (tipo IN ('principal', 'lateral', 'frontal', 'trasera', 'motor', 'tablero', 'color',
                                 'packaging', 'detalle', 'aplicacion')),
  principal      BOOLEAN NOT NULL DEFAULT false,
  archivo        TEXT,                 -- ruta local servida por la app (img/...)
  url_imagen     TEXT,                 -- URL del archivo en la fuente
  url_origen     TEXT,                 -- página de la que sale
  fuente_id      INTEGER REFERENCES fuentes(id) ON DELETE SET NULL,
  autor          TEXT,
  licencia       TEXT,
  licencia_url   TEXT,
  permiso        TEXT NOT NULL DEFAULT 'pendiente' CHECK (permiso IN ('libre', 'autorizado', 'pendiente', 'no_permitido')),
  descargado_en  TIMESTAMPTZ,
  hash_sha256    TEXT,
  ancho          INTEGER,
  alto           INTEGER,
  estado         TEXT NOT NULL DEFAULT 'UNVERIFIED' CHECK (estado IN ('VERIFIED', 'UNVERIFIED', 'NEEDS_REVIEW', 'IMAGE_MISSING')),
  verificado_en  TIMESTAMPTZ,
  importacion_id INTEGER REFERENCES importaciones(id) ON DELETE SET NULL,
  notas          TEXT,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entidad, registro_id, url_imagen)
);
CREATE INDEX imagenes_registro_idx ON imagenes (entidad, registro_id);
CREATE UNIQUE INDEX imagenes_principal_key ON imagenes (entidad, registro_id) WHERE principal;

-- ---------------------------------------------------------------- vistas con los nombres de la especificación
CREATE VIEW motorcycle_brands AS
  SELECT ma.* FROM marcas_vehiculo ma
   WHERE EXISTS (SELECT 1 FROM modelos_vehiculo mo WHERE mo.marca_id = ma.id AND mo.segmento = 'moto');
CREATE VIEW motorcycle_models AS SELECT * FROM modelos_vehiculo WHERE segmento = 'moto';
CREATE VIEW motorcycle_generations AS
  SELECT g.* FROM generaciones g JOIN modelos_vehiculo mo ON mo.id = g.modelo_id WHERE mo.segmento = 'moto';
CREATE VIEW motorcycle_versions AS
  SELECT v.* FROM vehiculos v JOIN modelos_vehiculo mo ON mo.id = v.modelo_id WHERE mo.segmento = 'moto';
CREATE VIEW motorcycle_engines AS
  SELECT m.* FROM motores m
   WHERE EXISTS (SELECT 1 FROM vehiculos v JOIN modelos_vehiculo mo ON mo.id = v.modelo_id
                  WHERE v.motor_id = m.id AND mo.segmento = 'moto');
CREATE VIEW motorcycle_categories AS SELECT * FROM categorias_moto;
CREATE VIEW motorcycle_images AS
  SELECT i.* FROM imagenes i
    JOIN modelos_vehiculo mo ON i.entidad = 'modelo' AND mo.id = i.registro_id AND mo.segmento = 'moto';
CREATE VIEW part_brands AS SELECT * FROM marcas_repuesto;
CREATE VIEW part_vehicle_compatibility AS SELECT * FROM compatibilidades;
CREATE VIEW part_cross_references AS SELECT * FROM equivalencias;

-- ---------------------------------------------------------------- importación también desde XML
ALTER TABLE importaciones DROP CONSTRAINT importaciones_formato_check,
  ADD CONSTRAINT importaciones_formato_check CHECK (formato IN ('csv', 'excel', 'json', 'xml', 'api'));

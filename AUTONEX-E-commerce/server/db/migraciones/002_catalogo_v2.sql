-- AUTONEX · 002 · catálogo v2
--
-- Agrega al marketplace un catálogo escalable de vehículos y autopartes con trazabilidad de cada dato:
--   fuentes, proveedores, importaciones (+ errores), historial de verificaciones, posibles duplicados,
--   tipos de vehículo, generaciones, motores, versiones con ficha técnica, categorías en árbol,
--   marcas de repuesto, números OEM, equivalencias, códigos de proveedor y preparación para patente/VIN.
--
-- Equivalencia con los nombres de la especificación:
--   brands = marcas_vehiculo · models = modelos_vehiculo · generations = generaciones · engines = motores
--   vehicle_versions / vehicles = vehiculos · vehicle_types = tipos_vehiculo · parts = productos
--   parts_categories = categorias · part_brands = marcas_repuesto · part_oem_numbers = oem_productos
--   part_equivalences = equivalencias · vehicle_parts = compatibilidades · suppliers = proveedores
--   data_sources = fuentes · data_imports = importaciones

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Código de pieza comparable: mayúsculas y solo letras y números ("0 986 494-133" -> "0986494133").
CREATE OR REPLACE FUNCTION normalizar_codigo(t TEXT) RETURNS TEXT
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  AS $$ SELECT upper(regexp_replace(coalesce(t, ''), '[^A-Za-z0-9]', '', 'g')) $$;

-- ---------------------------------------------------------------- referencias
CREATE TABLE provincias (
  id      SERIAL PRIMARY KEY,
  nombre  TEXT NOT NULL UNIQUE,
  orden   SMALLINT NOT NULL DEFAULT 0
);
INSERT INTO provincias (nombre, orden) VALUES
  ('Buenos Aires', 1), ('Ciudad Autónoma de Buenos Aires', 2), ('Catamarca', 3), ('Chaco', 4), ('Chubut', 5),
  ('Córdoba', 6), ('Corrientes', 7), ('Entre Ríos', 8), ('Formosa', 9), ('Jujuy', 10), ('La Pampa', 11),
  ('La Rioja', 12), ('Mendoza', 13), ('Misiones', 14), ('Neuquén', 15), ('Río Negro', 16), ('Salta', 17),
  ('San Juan', 18), ('San Luis', 19), ('Santa Cruz', 20), ('Santa Fe', 21), ('Santiago del Estero', 22),
  ('Tierra del Fuego', 23), ('Tucumán', 24);

-- ---------------------------------------------------------------- fuentes, proveedores e importaciones
CREATE TABLE fuentes (
  id                       SERIAL PRIMARY KEY,
  slug                     TEXT NOT NULL UNIQUE,
  nombre                   TEXT NOT NULL,
  tipo                     TEXT NOT NULL CHECK (tipo IN ('oficial', 'fabricante_vehiculos', 'fabricante_repuestos',
                             'proveedor', 'catalogo_aftermarket', 'datos_abiertos', 'manual', 'demo')),
  url                      TEXT,
  licencia                 TEXT,
  licencia_url             TEXT,
  terminos_url             TEXT,
  -- Checklist de la regla 24: términos, licencia, API, permiso comercial, redistribución
  terminos_revisados       BOOLEAN NOT NULL DEFAULT false,
  licencia_verificada      BOOLEAN NOT NULL DEFAULT false,
  api_disponible           BOOLEAN NOT NULL DEFAULT false,
  permite_uso_comercial    BOOLEAN,
  permite_redistribucion   BOOLEAN,
  nivel_confianza          TEXT NOT NULL DEFAULT 'media' CHECK (nivel_confianza IN ('alta', 'media', 'baja')),
  atribucion               TEXT,
  notas                    TEXT,
  creado_en                TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE proveedores (
  id                   SERIAL PRIMARY KEY,
  nombre               TEXT NOT NULL UNIQUE,
  pais                 TEXT,
  sitio_web            TEXT,
  contacto             TEXT,
  api_disponible       BOOLEAN NOT NULL DEFAULT false,
  catalogo_disponible  BOOLEAN NOT NULL DEFAULT false,
  formato_catalogo     TEXT,                                  -- CSV, Excel, API, propio...
  ultima_importacion   TIMESTAMPTZ,
  fuente_id            INTEGER REFERENCES fuentes(id) ON DELETE SET NULL,
  vendedor_id          INTEGER REFERENCES vendedores(id) ON DELETE SET NULL,
  notas                TEXT,
  creado_en            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE importaciones (
  id                  SERIAL PRIMARY KEY,
  fuente_id           INTEGER REFERENCES fuentes(id) ON DELETE SET NULL,
  proveedor_id        INTEGER REFERENCES proveedores(id) ON DELETE SET NULL,
  entidad             TEXT NOT NULL,
  formato             TEXT NOT NULL CHECK (formato IN ('csv', 'excel', 'json', 'api')),
  archivo             TEXT,
  solo_validacion     BOOLEAN NOT NULL DEFAULT false,
  estado              TEXT NOT NULL DEFAULT 'en_proceso'
                      CHECK (estado IN ('en_proceso', 'completada', 'completada_con_errores', 'fallida', 'validada')),
  filas_total         INTEGER NOT NULL DEFAULT 0,
  filas_creadas       INTEGER NOT NULL DEFAULT 0,
  filas_actualizadas  INTEGER NOT NULL DEFAULT 0,
  filas_sin_cambios   INTEGER NOT NULL DEFAULT 0,
  filas_duplicadas    INTEGER NOT NULL DEFAULT 0,
  filas_error         INTEGER NOT NULL DEFAULT 0,
  opciones            JSONB NOT NULL DEFAULT '{}',
  resumen             JSONB NOT NULL DEFAULT '{}',
  usuario_id          INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  iniciada_en         TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalizada_en       TIMESTAMPTZ
);

CREATE TABLE importacion_errores (
  id              SERIAL PRIMARY KEY,
  importacion_id  INTEGER NOT NULL REFERENCES importaciones(id) ON DELETE CASCADE,
  fila            INTEGER,
  campo           TEXT,
  mensaje         TEXT NOT NULL,
  datos           JSONB
);
CREATE INDEX importacion_errores_imp_idx ON importacion_errores (importacion_id);

-- ---------------------------------------------------------------- usuarios: rol administrador
ALTER TABLE usuarios DROP CONSTRAINT usuarios_rol_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check CHECK (rol IN ('comprador', 'vendedor', 'admin'));

-- ---------------------------------------------------------------- tipos de vehículo
CREATE TABLE tipos_vehiculo (
  id      SERIAL PRIMARY KEY,
  slug    TEXT NOT NULL UNIQUE,
  nombre  TEXT NOT NULL,
  clase   TEXT NOT NULL CHECK (clase IN ('liviano', 'comercial', 'pesado', 'propulsion', 'otro')),
  orden   SMALLINT NOT NULL DEFAULT 0
);
INSERT INTO tipos_vehiculo (slug, nombre, clase, orden) VALUES
  ('auto', 'Auto', 'liviano', 1), ('hatchback', 'Hatchback', 'liviano', 2), ('sedan', 'Sedán', 'liviano', 3),
  ('coupe', 'Coupé', 'liviano', 4), ('cabrio', 'Cabrio', 'liviano', 5), ('suv', 'SUV', 'liviano', 6),
  ('crossover', 'Crossover', 'liviano', 7), ('pickup', 'Pickup', 'comercial', 8), ('utilitario', 'Utilitario', 'comercial', 9),
  ('van', 'Van', 'comercial', 10), ('furgon', 'Furgón', 'comercial', 11), ('minibus', 'Minibús', 'pesado', 12),
  ('camion', 'Camión', 'pesado', 13), ('tractor', 'Tractor', 'pesado', 14), ('bus', 'Bus', 'pesado', 15),
  ('electrico', 'Vehículo eléctrico', 'propulsion', 16), ('hibrido', 'Vehículo híbrido', 'propulsion', 17),
  ('sin_especificar', 'Sin especificar', 'otro', 18);

-- ---------------------------------------------------------------- generaciones y motores (nuevas)
CREATE TABLE generaciones (
  id          SERIAL PRIMARY KEY,
  modelo_id   INTEGER NOT NULL REFERENCES modelos_vehiculo(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,                 -- "8ª generación", "G5", "AN120"...
  numero      SMALLINT,
  codigo      TEXT,                          -- código de chasis del fabricante, si la fuente lo informa
  anio_desde  SMALLINT NOT NULL,
  anio_hasta  SMALLINT,
  UNIQUE (modelo_id, nombre),
  CHECK (anio_hasta IS NULL OR anio_hasta >= anio_desde)
);

CREATE TABLE motores (
  id                 SERIAL PRIMARY KEY,
  marca_id           INTEGER REFERENCES marcas_vehiculo(id) ON DELETE CASCADE,  -- marca del vehículo que lo usa/fabrica
  codigo             TEXT,                                                     -- código de motor (1GD-FTV, EA211...)
  nombre             TEXT NOT NULL,                                            -- "2.8 TDI", "1.6 MSI"
  cilindrada_cc      INTEGER CHECK (cilindrada_cc IS NULL OR cilindrada_cc BETWEEN 50 AND 30000),
  cilindros          SMALLINT CHECK (cilindros IS NULL OR cilindros BETWEEN 1 AND 16),
  combustible        TEXT CHECK (combustible IN ('nafta', 'diesel', 'gnc', 'hibrido', 'electrico', 'flex')),
  potencia_cv        INTEGER CHECK (potencia_cv IS NULL OR potencia_cv > 0),
  torque_nm          INTEGER CHECK (torque_nm IS NULL OR torque_nm > 0),
  aspiracion         TEXT CHECK (aspiracion IN ('atmosferico', 'turbo', 'biturbo', 'supercargado', 'electrico')),
  clave_normalizada  TEXT,
  UNIQUE (marca_id, nombre)
);

-- ---------------------------------------------------------------- marcas y modelos: ficha y estado de mercado
ALTER TABLE marcas_vehiculo
  ADD COLUMN pais_origen        TEXT,
  ADD COLUMN segmento           TEXT CHECK (segmento IN ('particular', 'comercial', 'pesado', 'mixto')),
  ADD COLUMN estado_mercado     TEXT CHECK (estado_mercado IN ('comercializado', 'discontinuado', 'usado_importado')),
  ADD COLUMN sitio_web          TEXT,
  ADD COLUMN popularidad        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN clave_normalizada  TEXT;

ALTER TABLE modelos_vehiculo
  ADD COLUMN tipo_vehiculo_id   INTEGER REFERENCES tipos_vehiculo(id),
  ADD COLUMN estado_mercado     TEXT CHECK (estado_mercado IN ('comercializado', 'discontinuado', 'usado_importado')),
  ADD COLUMN segmento           TEXT CHECK (segmento IN ('particular', 'comercial', 'pesado')),
  ADD COLUMN anio_desde         SMALLINT,
  ADD COLUMN anio_hasta         SMALLINT,
  ADD COLUMN popularidad        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN clave_normalizada  TEXT;
UPDATE modelos_vehiculo mo SET tipo_vehiculo_id = t.id
  FROM tipos_vehiculo t
 WHERE t.slug = CASE mo.tipo WHEN 'camioneta' THEN 'pickup' WHEN 'utilitario' THEN 'utilitario' ELSE 'auto' END;
ALTER TABLE modelos_vehiculo DROP COLUMN tipo;

-- ---------------------------------------------------------------- vehículos = versiones (ficha técnica completa)
ALTER TABLE vehiculos
  ADD COLUMN codigo             TEXT,
  ADD COLUMN generacion_id      INTEGER REFERENCES generaciones(id) ON DELETE SET NULL,
  ADD COLUMN motor_id           INTEGER REFERENCES motores(id) ON DELETE SET NULL,
  ADD COLUMN tipo_vehiculo_id   INTEGER REFERENCES tipos_vehiculo(id),
  ADD COLUMN carroceria         TEXT,
  ADD COLUMN transmision        TEXT CHECK (transmision IN ('manual', 'automatica')),
  ADD COLUMN velocidades        SMALLINT CHECK (velocidades IS NULL OR velocidades BETWEEN 1 AND 18),
  ADD COLUMN traccion           TEXT CHECK (traccion IN ('4x2', '4x4', '6x2', '6x4', '8x2', '8x4')),
  ADD COLUMN pais_fabricacion   TEXT,
  ADD COLUMN mercado            TEXT NOT NULL DEFAULT 'Argentina',
  ADD COLUMN estado_mercado     TEXT CHECK (estado_mercado IN ('comercializado', 'discontinuado', 'usado_importado')),
  ADD COLUMN segmento           TEXT CHECK (segmento IN ('particular', 'comercial', 'pesado')),
  ADD COLUMN carrocero          TEXT,                         -- carrocería de buses (Marcopolo, Metalpar...)
  ADD COLUMN popularidad        INTEGER NOT NULL DEFAULT 0,  -- registros en la fuente (sirve para ordenar)
  ADD COLUMN datos_fuente       JSONB NOT NULL DEFAULT '{}', -- datos originales de la fuente, tal cual
  ADD COLUMN clave_normalizada  TEXT;

-- Los motores de texto libre de la versión 1 pasan a la tabla motores
INSERT INTO motores (marca_id, nombre, combustible)
SELECT DISTINCT mo.marca_id, v.motor, v.combustible
  FROM vehiculos v JOIN modelos_vehiculo mo ON mo.id = v.modelo_id
ON CONFLICT (marca_id, nombre) DO NOTHING;
UPDATE vehiculos v SET motor_id = m.id
  FROM modelos_vehiculo mo, motores m
 WHERE mo.id = v.modelo_id AND m.marca_id = mo.marca_id AND m.nombre = v.motor;
UPDATE vehiculos v SET codigo = 'AUTONEX-V' || lpad(v.id::text, 6, '0'), tipo_vehiculo_id = mo.tipo_vehiculo_id
  FROM modelos_vehiculo mo WHERE mo.id = v.modelo_id;
ALTER TABLE vehiculos DROP COLUMN motor;
ALTER TABLE vehiculos ALTER COLUMN codigo SET NOT NULL;
ALTER TABLE vehiculos ADD CONSTRAINT vehiculos_codigo_key UNIQUE (codigo);
ALTER TABLE vehiculos DROP CONSTRAINT vehiculos_combustible_check;
ALTER TABLE vehiculos ALTER COLUMN combustible DROP NOT NULL;
ALTER TABLE vehiculos ADD CONSTRAINT vehiculos_combustible_check
  CHECK (combustible IN ('nafta', 'diesel', 'gnc', 'hibrido', 'electrico', 'flex'));
ALTER TABLE vehiculos ALTER COLUMN anio_hasta DROP NOT NULL;
ALTER TABLE vehiculos DROP CONSTRAINT vehiculos_check;
ALTER TABLE vehiculos ADD CONSTRAINT vehiculos_anios_check CHECK (anio_hasta IS NULL OR anio_hasta >= anio_desde);

-- ---------------------------------------------------------------- patente y VIN (preparación)
-- Caché de consultas a proveedores autorizados. No se carga ninguna base de patentes: queda vacía
-- hasta integrar un servicio con permiso para consultar dominios.
CREATE TABLE identificaciones_vehiculo (
  id            SERIAL PRIMARY KEY,
  tipo          TEXT NOT NULL CHECK (tipo IN ('patente', 'vin', 'chasis')),
  valor         TEXT NOT NULL,                        -- normalizado: mayúsculas sin espacios
  vehiculo_id   INTEGER REFERENCES vehiculos(id) ON DELETE SET NULL,
  proveedor     TEXT NOT NULL,
  respuesta     JSONB,
  consultado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tipo, valor, proveedor)
);

-- WMI (3 primeros caracteres del VIN) -> fabricante. Se completa importando una fuente con licencia.
CREATE TABLE vin_wmi (
  wmi         CHAR(3) PRIMARY KEY,
  marca_id    INTEGER REFERENCES marcas_vehiculo(id) ON DELETE SET NULL,
  fabricante  TEXT,
  pais        TEXT,
  fuente_id   INTEGER REFERENCES fuentes(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------- categorías en árbol
ALTER TABLE categorias
  ADD COLUMN padre_id     INTEGER REFERENCES categorias(id) ON DELETE RESTRICT,
  ADD COLUMN nivel        SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN destacada    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN prefijo_sku  TEXT;
ALTER TABLE categorias DROP CONSTRAINT categorias_nombre_key;
CREATE UNIQUE INDEX categorias_padre_nombre_key ON categorias (coalesce(padre_id, 0), nombre);
CREATE INDEX categorias_padre_idx ON categorias (padre_id);

-- ---------------------------------------------------------------- marcas de repuesto y productos
CREATE TABLE marcas_repuesto (
  id                 SERIAL PRIMARY KEY,
  nombre             TEXT NOT NULL UNIQUE,
  slug               TEXT NOT NULL UNIQUE,
  pais               TEXT,
  sitio_web          TEXT,
  clave_normalizada  TEXT
);
INSERT INTO marcas_repuesto (nombre, slug)
SELECT DISTINCT marca, regexp_replace(lower(normalizar(marca)), '[^a-z0-9]+', '-', 'g') FROM productos;

ALTER TABLE productos RENAME COLUMN codigo_pieza TO numero_pieza;
ALTER TABLE productos
  ADD COLUMN sku                 TEXT,
  ADD COLUMN marca_repuesto_id   INTEGER REFERENCES marcas_repuesto(id),
  ADD COLUMN tipo_pieza          TEXT NOT NULL DEFAULT 'aftermarket'
                                 CHECK (tipo_pieza IN ('original', 'aftermarket', 'alternativo', 'generico', 'usado', 'reacondicionado')),
  ADD COLUMN ean                 TEXT,
  ADD COLUMN codigo_aftermarket  TEXT,
  ADD COLUMN especificaciones    JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN numero_normalizado  TEXT GENERATED ALWAYS AS (normalizar_codigo(numero_pieza)) STORED;
UPDATE productos p SET marca_repuesto_id = mr.id FROM marcas_repuesto mr WHERE mr.nombre = p.marca;
ALTER TABLE productos ALTER COLUMN marca_repuesto_id SET NOT NULL;
ALTER TABLE productos DROP COLUMN marca;
ALTER TABLE productos DROP CONSTRAINT productos_codigo_pieza_key;
CREATE UNIQUE INDEX productos_marca_numero_key ON productos (marca_repuesto_id, numero_normalizado);
CREATE INDEX productos_numero_idx ON productos (numero_normalizado);
CREATE INDEX productos_marca_repuesto_idx ON productos (marca_repuesto_id);
CREATE INDEX productos_nombre_trgm ON productos USING gin (normalizar(nombre) gin_trgm_ops);

-- SKU AUTONEX: prefijo de la categoría raíz + id ("FRE-000123"). Se asigna solo si no viene informado.
CREATE OR REPLACE FUNCTION asignar_sku() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prefijo TEXT;
BEGIN
  IF NEW.sku IS NULL OR NEW.sku = '' THEN
    WITH RECURSIVE ancestros AS (
      SELECT id, padre_id, prefijo_sku FROM categorias WHERE id = NEW.categoria_id
      UNION ALL
      SELECT c.id, c.padre_id, c.prefijo_sku FROM categorias c JOIN ancestros a ON c.id = a.padre_id
    )
    SELECT prefijo_sku INTO prefijo FROM ancestros WHERE padre_id IS NULL;
    NEW.sku := coalesce(prefijo, 'GEN') || '-' || lpad(NEW.id::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER productos_sku BEFORE INSERT ON productos FOR EACH ROW EXECUTE FUNCTION asignar_sku();
UPDATE productos SET sku = 'GEN-' || lpad(id::text, 6, '0') WHERE sku IS NULL;
ALTER TABLE productos ALTER COLUMN sku SET NOT NULL;
ALTER TABLE productos ADD CONSTRAINT productos_sku_key UNIQUE (sku);

-- Números OEM: el código con el que la marca del vehículo identifica la pieza original
CREATE TABLE oem_productos (
  id                  SERIAL PRIMARY KEY,
  producto_id         INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  marca_vehiculo_id   INTEGER NOT NULL REFERENCES marcas_vehiculo(id) ON DELETE CASCADE,
  numero_oem          TEXT NOT NULL,
  numero_normalizado  TEXT GENERATED ALWAYS AS (normalizar_codigo(numero_oem)) STORED,
  UNIQUE (producto_id, marca_vehiculo_id, numero_oem)
);
CREATE INDEX oem_productos_numero_idx ON oem_productos (numero_normalizado);

-- Equivalencias con números de otras marcas (existan o no en el catálogo)
CREATE TABLE equivalencias (
  id                       SERIAL PRIMARY KEY,
  producto_id              INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  marca_repuesto_id        INTEGER NOT NULL REFERENCES marcas_repuesto(id) ON DELETE CASCADE,
  numero_pieza             TEXT NOT NULL,
  numero_normalizado       TEXT GENERATED ALWAYS AS (normalizar_codigo(numero_pieza)) STORED,
  producto_equivalente_id  INTEGER REFERENCES productos(id) ON DELETE SET NULL,
  tipo                     TEXT NOT NULL DEFAULT 'equivalente' CHECK (tipo IN ('equivalente', 'reemplaza', 'reemplazado_por')),
  UNIQUE (producto_id, marca_repuesto_id, numero_pieza)
);
CREATE INDEX equivalencias_numero_idx ON equivalencias (numero_normalizado);

-- Catálogo propio de cada proveedor: su código interno para cada producto
CREATE TABLE productos_proveedor (
  id                SERIAL PRIMARY KEY,
  proveedor_id      INTEGER NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
  producto_id       INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  codigo_proveedor  TEXT NOT NULL,
  UNIQUE (proveedor_id, codigo_proveedor)
);

ALTER TABLE compatibilidades
  ADD COLUMN posicion   TEXT,                -- delantero, trasero, izquierdo...
  ADD COLUMN notas      TEXT,
  ADD COLUMN creado_en  TIMESTAMPTZ NOT NULL DEFAULT now();

-- ---------------------------------------------------------------- trazabilidad y verificación de cada dato
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['marcas_vehiculo', 'modelos_vehiculo', 'generaciones', 'motores', 'vehiculos',
                           'marcas_repuesto', 'productos', 'compatibilidades', 'oem_productos', 'equivalencias'] LOOP
    EXECUTE format($f$
      ALTER TABLE %1$I
        ADD COLUMN fuente_id            INTEGER REFERENCES fuentes(id) ON DELETE SET NULL,
        ADD COLUMN fuente_url           TEXT,
        ADD COLUMN importacion_id       INTEGER REFERENCES importaciones(id) ON DELETE SET NULL,
        ADD COLUMN importado_en         TIMESTAMPTZ,
        ADD COLUMN verificado_en        TIMESTAMPTZ,
        ADD COLUMN estado_verificacion  TEXT NOT NULL DEFAULT 'UNVERIFIED'
                                        CHECK (estado_verificacion IN ('VERIFIED', 'UNVERIFIED', 'NEEDS_REVIEW', 'DISCONTINUED')),
        ADD COLUMN confianza            TEXT CHECK (confianza IN ('alta', 'media', 'baja')),
        ADD COLUMN actualizado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
    $f$, t);
    EXECUTE format('CREATE INDEX %I ON %I (estado_verificacion)', t || '_verificacion_idx', t);
    EXECUTE format('CREATE INDEX %I ON %I (fuente_id)', t || '_fuente_idx', t);
  END LOOP;
END $$;

-- Historial de cambios de verificación (quién, cuándo, de qué estado a cuál)
CREATE TABLE verificaciones (
  id               SERIAL PRIMARY KEY,
  entidad          TEXT NOT NULL,
  registro_id      TEXT NOT NULL,          -- id o clave compuesta ("producto:vehiculo")
  estado_anterior  TEXT,
  estado_nuevo     TEXT NOT NULL,
  fuente_id        INTEGER REFERENCES fuentes(id) ON DELETE SET NULL,
  nota             TEXT,
  usuario_id       INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX verificaciones_registro_idx ON verificaciones (entidad, registro_id);

-- ---------------------------------------------------------------- posibles duplicados
-- Nunca se fusiona ni se crea automáticamente: queda pendiente hasta que un administrador decide.
CREATE TABLE posibles_duplicados (
  id                SERIAL PRIMARY KEY,
  entidad           TEXT NOT NULL,
  registro_id       INTEGER NOT NULL,      -- registro existente
  duplicado_id      INTEGER,               -- otro registro existente (búsqueda sobre la base)
  datos_nuevos      JSONB,                 -- o una fila importada que se retuvo sin crear
  importacion_id    INTEGER REFERENCES importaciones(id) ON DELETE SET NULL,
  similitud         NUMERIC(4, 3),
  motivo            TEXT NOT NULL,
  estado            TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'fusionado', 'descartado', 'creado')),
  resuelto_por      INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  resuelto_en       TIMESTAMPTZ,
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (duplicado_id IS NOT NULL OR datos_nuevos IS NOT NULL)
);
CREATE INDEX posibles_duplicados_estado_idx ON posibles_duplicados (entidad, estado);
CREATE UNIQUE INDEX posibles_duplicados_par_key ON posibles_duplicados (entidad, least(registro_id, duplicado_id), greatest(registro_id, duplicado_id))
  WHERE duplicado_id IS NOT NULL;

-- ---------------------------------------------------------------- índices de búsqueda
CREATE INDEX marcas_vehiculo_nombre_trgm ON marcas_vehiculo USING gin (normalizar(nombre) gin_trgm_ops);
CREATE INDEX modelos_vehiculo_nombre_trgm ON modelos_vehiculo USING gin (normalizar(nombre) gin_trgm_ops);
CREATE INDEX modelos_vehiculo_marca_idx ON modelos_vehiculo (marca_id);
CREATE INDEX vehiculos_anios_idx ON vehiculos (modelo_id, anio_desde, anio_hasta);
CREATE INDEX vehiculos_motor_idx ON vehiculos (motor_id);
CREATE INDEX vehiculos_generacion_idx ON vehiculos (generacion_id);
CREATE INDEX vehiculos_clave_idx ON vehiculos (modelo_id, clave_normalizada);
CREATE INDEX vehiculos_version_trgm ON vehiculos USING gin (normalizar(version) gin_trgm_ops);
CREATE INDEX motores_marca_idx ON motores (marca_id);
CREATE INDEX compatibilidades_vehiculo_estado_idx ON compatibilidades (vehiculo_id, estado_verificacion);

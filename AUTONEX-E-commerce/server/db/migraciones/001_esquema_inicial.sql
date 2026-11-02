-- AUTONEX · 001 · esquema inicial (marketplace: usuarios, vendedores, vehículos, catálogo, compras y pagos)
-- Minúsculas y sin tildes, para buscar "bujia" y encontrar "Bujía".
CREATE OR REPLACE FUNCTION normalizar(t TEXT) RETURNS TEXT
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  AS $$ SELECT translate(lower(t), 'áàäâéèëêíìïîóòöôúùüûñç', 'aaaaeeeeiiiioooouuuunc') $$;

-- ---------------------------------------------------------------- usuarios
CREATE TABLE usuarios (
  id             SERIAL PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  nombre         TEXT NOT NULL,
  apellido       TEXT NOT NULL,
  telefono       TEXT,
  dni            TEXT,
  rol            TEXT NOT NULL CHECK (rol IN ('comprador', 'vendedor')),
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- vendedores
CREATE TABLE vendedores (
  id                SERIAL PRIMARY KEY,
  usuario_id        INTEGER UNIQUE REFERENCES usuarios(id) ON DELETE SET NULL,
  slug              TEXT NOT NULL UNIQUE,
  nombre_comercial  TEXT NOT NULL,
  descripcion       TEXT,
  direccion         TEXT NOT NULL,
  ciudad            TEXT NOT NULL,
  provincia         TEXT NOT NULL,
  telefono          TEXT,
  whatsapp          TEXT,
  horario           TEXT,
  logo              TEXT,
  es_desarmadero    BOOLEAN NOT NULL DEFAULT false,
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- vehículos
CREATE TABLE marcas_vehiculo (
  id      SERIAL PRIMARY KEY,
  nombre  TEXT NOT NULL UNIQUE,
  slug    TEXT NOT NULL UNIQUE,
  imagen  TEXT
);

CREATE TABLE modelos_vehiculo (
  id        SERIAL PRIMARY KEY,
  marca_id  INTEGER NOT NULL REFERENCES marcas_vehiculo(id) ON DELETE CASCADE,
  nombre    TEXT NOT NULL,
  tipo      TEXT NOT NULL DEFAULT 'auto' CHECK (tipo IN ('auto', 'camioneta', 'utilitario')),
  UNIQUE (marca_id, nombre)
);

CREATE TABLE vehiculos (
  id           SERIAL PRIMARY KEY,
  modelo_id    INTEGER NOT NULL REFERENCES modelos_vehiculo(id) ON DELETE CASCADE,
  version      TEXT NOT NULL,
  motor        TEXT NOT NULL,
  combustible  TEXT NOT NULL CHECK (combustible IN ('nafta', 'diesel')),
  anio_desde   SMALLINT NOT NULL,
  anio_hasta   SMALLINT NOT NULL,
  CHECK (anio_hasta >= anio_desde)
);
CREATE INDEX vehiculos_modelo_idx ON vehiculos (modelo_id);

-- ---------------------------------------------------------------- catálogo
CREATE TABLE categorias (
  id           SERIAL PRIMARY KEY,
  nombre       TEXT NOT NULL UNIQUE,
  slug         TEXT NOT NULL UNIQUE,
  descripcion  TEXT,
  imagen       TEXT,
  orden        SMALLINT NOT NULL DEFAULT 0
);

CREATE TABLE productos (
  id            SERIAL PRIMARY KEY,
  nombre        TEXT NOT NULL,
  marca         TEXT NOT NULL,              -- marca del repuesto (Bosch, Wega, ...)
  codigo_pieza  TEXT NOT NULL UNIQUE,
  descripcion   TEXT,
  categoria_id  INTEGER NOT NULL REFERENCES categorias(id),
  imagen        TEXT,
  universal     BOOLEAN NOT NULL DEFAULT false,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX productos_categoria_idx ON productos (categoria_id);
CREATE INDEX productos_marca_idx ON productos (marca);

CREATE TABLE compatibilidades (
  producto_id  INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  vehiculo_id  INTEGER NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
  PRIMARY KEY (producto_id, vehiculo_id)
);
CREATE INDEX compatibilidades_vehiculo_idx ON compatibilidades (vehiculo_id);

CREATE TABLE publicaciones (
  id              SERIAL PRIMARY KEY,
  producto_id     INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  vendedor_id     INTEGER NOT NULL REFERENCES vendedores(id) ON DELETE CASCADE,
  precio          NUMERIC(12, 2) NOT NULL CHECK (precio > 0),
  stock           INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  condicion       TEXT NOT NULL DEFAULT 'nuevo' CHECK (condicion IN ('nuevo', 'usado')),
  estado          TEXT NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'pausada')),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (producto_id, vendedor_id, condicion)
);
CREATE INDEX publicaciones_producto_idx ON publicaciones (producto_id);
CREATE INDEX publicaciones_vendedor_idx ON publicaciones (vendedor_id);

-- ---------------------------------------------------------------- compras
-- Una compra es el checkout completo del comprador; se divide en un pedido por vendedor.
CREATE TABLE compras (
  id                   SERIAL PRIMARY KEY,
  usuario_id           INTEGER NOT NULL REFERENCES usuarios(id),
  estado               TEXT NOT NULL DEFAULT 'pendiente_pago'
                       CHECK (estado IN ('pendiente_pago', 'pagada', 'pago_rechazado', 'cancelada')),
  comprador_nombre     TEXT NOT NULL,
  comprador_apellido   TEXT NOT NULL,
  comprador_email      TEXT NOT NULL,
  comprador_telefono   TEXT NOT NULL,
  comprador_dni        TEXT NOT NULL,
  subtotal_productos   NUMERIC(12, 2) NOT NULL,
  total_envios         NUMERIC(12, 2) NOT NULL,
  total                NUMERIC(12, 2) NOT NULL,
  pagada_en            TIMESTAMPTZ,
  creado_en            TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX compras_usuario_idx ON compras (usuario_id);

CREATE TABLE pedidos (
  id              SERIAL PRIMARY KEY,
  compra_id       INTEGER NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  vendedor_id     INTEGER NOT NULL REFERENCES vendedores(id),
  estado          TEXT NOT NULL DEFAULT 'pendiente_pago'
                  CHECK (estado IN ('pendiente_pago', 'pagado', 'en_preparacion', 'enviado',
                                    'listo_para_retirar', 'entregado', 'cancelado')),
  subtotal        NUMERIC(12, 2) NOT NULL,
  costo_envio     NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total           NUMERIC(12, 2) NOT NULL,
  nota            TEXT,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (compra_id, vendedor_id)
);
CREATE INDEX pedidos_vendedor_idx ON pedidos (vendedor_id);

CREATE TABLE pedido_items (
  id               SERIAL PRIMARY KEY,
  pedido_id        INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  publicacion_id   INTEGER NOT NULL REFERENCES publicaciones(id),
  producto_id      INTEGER NOT NULL REFERENCES productos(id),
  nombre_producto  TEXT NOT NULL,       -- copia al momento de la compra
  codigo_pieza     TEXT NOT NULL,
  condicion        TEXT NOT NULL,
  precio_unitario  NUMERIC(12, 2) NOT NULL,
  cantidad         INTEGER NOT NULL CHECK (cantidad > 0),
  subtotal         NUMERIC(12, 2) NOT NULL
);
CREATE INDEX pedido_items_pedido_idx ON pedido_items (pedido_id);

CREATE TABLE envios (
  id               SERIAL PRIMARY KEY,
  pedido_id        INTEGER NOT NULL UNIQUE REFERENCES pedidos(id) ON DELETE CASCADE,
  metodo           TEXT NOT NULL CHECK (metodo IN ('retiro', 'domicilio')),
  transportista    TEXT CHECK (transportista IN ('andreani', 'oca', 'correo_argentino', 'moto')),
  costo            NUMERIC(12, 2) NOT NULL DEFAULT 0,
  demora_estimada  TEXT,
  calle            TEXT,
  numero           TEXT,
  piso_depto       TEXT,
  codigo_postal    TEXT,
  localidad        TEXT,
  provincia        TEXT,
  observaciones    TEXT,
  CHECK (metodo = 'retiro' OR (transportista IS NOT NULL AND calle IS NOT NULL))
);

CREATE TABLE pagos (
  id              SERIAL PRIMARY KEY,
  compra_id       INTEGER NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  preferencia_id  TEXT NOT NULL,
  init_point      TEXT,
  mp_pago_id      TEXT UNIQUE,
  estado          TEXT NOT NULL DEFAULT 'pendiente',   -- estado de Mercado Pago (approved, pending, rejected...)
  estado_detalle  TEXT,
  monto           NUMERIC(12, 2) NOT NULL,
  medio_pago      TEXT,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX pagos_compra_idx ON pagos (compra_id);

-- AUTONEX · 005 · qué fabrica cada marca de repuestos y su logo
--
-- Una marca de repuestos tiene líneas de producto ("Brembo: pastillas, discos, pinzas…"). Cada línea apunta, si se
-- puede, a una categoría del catálogo; así la tienda muestra qué marcas fabrican un repuesto aunque todavía no haya
-- productos publicados. Una línea NO es un producto: no tiene número de parte, precio ni compatibilidades.
-- No borra ni cambia datos existentes.

CREATE TABLE marca_repuesto_lineas (
  id                   SERIAL PRIMARY KEY,
  marca_repuesto_id    INTEGER NOT NULL REFERENCES marcas_repuesto(id) ON DELETE CASCADE,
  nombre               TEXT NOT NULL,
  categoria_id         INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
  orden                SMALLINT NOT NULL DEFAULT 0,
  fuente_id            INTEGER REFERENCES fuentes(id) ON DELETE SET NULL,
  importacion_id       INTEGER REFERENCES importaciones(id) ON DELETE SET NULL,
  estado_verificacion  TEXT NOT NULL DEFAULT 'UNVERIFIED'
                       CHECK (estado_verificacion IN ('VERIFIED', 'UNVERIFIED', 'NEEDS_REVIEW', 'DISCONTINUED')),
  creado_en            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (marca_repuesto_id, nombre)
);
CREATE INDEX marca_repuesto_lineas_categoria_idx ON marca_repuesto_lineas (categoria_id);

ALTER TABLE marcas_repuesto
  ADD COLUMN logo        TEXT,
  ADD COLUMN logo_fondo  TEXT NOT NULL DEFAULT 'claro' CHECK (logo_fondo IN ('claro', 'oscuro'));

-- Nombre de la especificación
CREATE VIEW part_brand_lines AS
  SELECT l.id, l.marca_repuesto_id AS part_brand_id, mr.nombre AS part_brand, l.nombre AS line, l.categoria_id AS category_id,
         l.estado_verificacion AS verification_status, l.fuente_id AS source_id
    FROM marca_repuesto_lineas l JOIN marcas_repuesto mr ON mr.id = l.marca_repuesto_id;

-- AUTONEX · 011 · fotos y descripción propias de cada publicación
--
-- Cada local carga sus propias fotos y su descripción para cada publicación (muy útil en los repuestos usados). Las fotos
-- se guardan en la base (el servicio no escribe en disco): se reducen a 1600 px y se convierten a WebP antes de guardarlas.
-- La pieza sigue siendo una sola (misma marca y número de pieza), así en su ficha se comparan las ofertas de todas las
-- casas. No borra ni cambia datos existentes.

ALTER TABLE publicaciones
  ADD COLUMN descripcion TEXT CHECK (descripcion IS NULL OR length(descripcion) <= 2000);

CREATE TABLE archivos (
  id         SERIAL PRIMARY KEY,
  datos      BYTEA NOT NULL,
  tipo_mime  TEXT NOT NULL CHECK (tipo_mime IN ('image/webp', 'image/jpeg', 'image/png')),
  ancho      INTEGER,
  alto       INTEGER,
  bytes      INTEGER NOT NULL,
  sha256     TEXT NOT NULL,
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE publicacion_fotos (
  id              SERIAL PRIMARY KEY,
  publicacion_id  INTEGER NOT NULL REFERENCES publicaciones(id) ON DELETE CASCADE,
  archivo_id      INTEGER NOT NULL REFERENCES archivos(id) ON DELETE CASCADE,
  orden           INTEGER NOT NULL DEFAULT 0,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX publicacion_fotos_publicacion_idx ON publicacion_fotos (publicacion_id, orden);

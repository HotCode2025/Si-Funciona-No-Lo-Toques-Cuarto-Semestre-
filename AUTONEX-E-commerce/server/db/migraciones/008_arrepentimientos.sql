-- AUTONEX · 008 · botón de arrepentimiento
--
-- Pedidos de revocación de una compra (art. 34 de la Ley 24.240, art. 1110 del Código Civil y Comercial y
-- Resolución 424/2020 de la Secretaría de Comercio Interior). El comprador lo pide con el número de compra y su email y
-- recibe en el momento un código de identificación. Los vendedores de la compra lo ven en su panel.
-- No borra ni cambia datos existentes.

CREATE TABLE arrepentimientos (
  id          SERIAL PRIMARY KEY,
  codigo      TEXT NOT NULL UNIQUE,
  compra_id   INTEGER NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  motivo      TEXT CHECK (motivo IS NULL OR length(motivo) <= 500),
  estado      TEXT NOT NULL DEFAULT 'recibido' CHECK (estado IN ('recibido', 'resuelto')),
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Una solicitud abierta por compra: pedirla de nuevo devuelve el mismo código
CREATE UNIQUE INDEX arrepentimientos_abierto_idx ON arrepentimientos (compra_id) WHERE estado = 'recibido';

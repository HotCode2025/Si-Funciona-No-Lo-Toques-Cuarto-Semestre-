-- AUTONEX · 012 · horarios de los locales por día y reintegros por arrepentimiento
--
-- 1) Horario de atención estructurado: 7 días (lunes a domingo), cada uno abierto o cerrado y con hasta dos turnos.
--    La columna horario (texto) se sigue usando para mostrarlo y se arma a partir de esta.
-- 2) Botón de arrepentimiento: con una solicitud abierta el vendedor no puede avanzar el pedido; lo cancela y AUTONEX
--    reintegra el total del pedido (productos + envío) con Mercado Pago. Cada reintegro queda registrado.
-- No borra ni cambia datos existentes.

ALTER TABLE vendedores
  ADD COLUMN horarios JSONB CHECK (horarios IS NULL OR (jsonb_typeof(horarios) = 'array' AND jsonb_array_length(horarios) = 7));

ALTER TABLE arrepentimientos ADD COLUMN resuelto_en TIMESTAMPTZ;

CREATE TABLE reintegros (
  id                 SERIAL PRIMARY KEY,
  pedido_id          INTEGER NOT NULL UNIQUE REFERENCES pedidos(id) ON DELETE CASCADE,
  compra_id          INTEGER NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  arrepentimiento_id INTEGER REFERENCES arrepentimientos(id) ON DELETE SET NULL,
  monto              NUMERIC(12, 2) NOT NULL CHECK (monto > 0),
  estado             TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'error')),
  mp_pago_id         TEXT,
  mp_reintegro_id    TEXT,
  detalle            TEXT,
  creado_en          TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX reintegros_compra_idx ON reintegros (compra_id);

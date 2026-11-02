-- AUTONEX · 007 · número de seguimiento del envío
--
-- Cuando despacha un pedido con envío a domicilio, el vendedor carga el número de seguimiento que le dio el
-- transportista (Andreani, OCA, Correo Argentino). El comprador lo ve en su compra y en el comprobante.
-- No borra ni cambia datos existentes.

ALTER TABLE envios
  ADD COLUMN numero_seguimiento TEXT
    CHECK (numero_seguimiento IS NULL OR length(numero_seguimiento) BETWEEN 4 AND 40),
  ADD COLUMN despachado_en TIMESTAMPTZ;

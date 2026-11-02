-- AUTONEX · 006 · comprar sin cuenta
--
-- Una compra puede hacerse sin iniciar sesión (invitado): queda sin usuario y con un código de acceso secreto, que el
-- navegador del comprador guarda para ver la compra, pagarla o reintentar el pago. También se puede recuperar con el
-- número de compra y el email. Las compras de siempre (con cuenta) no cambian. No borra ni cambia datos existentes.

ALTER TABLE compras ALTER COLUMN usuario_id DROP NOT NULL;
ALTER TABLE compras
  ADD COLUMN codigo_acceso TEXT,
  ADD CONSTRAINT compras_comprador_check CHECK (usuario_id IS NOT NULL OR codigo_acceso IS NOT NULL);
CREATE UNIQUE INDEX compras_codigo_acceso_key ON compras (codigo_acceso) WHERE codigo_acceso IS NOT NULL;

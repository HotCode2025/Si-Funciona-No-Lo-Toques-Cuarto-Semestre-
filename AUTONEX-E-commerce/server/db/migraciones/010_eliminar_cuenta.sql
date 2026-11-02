-- AUTONEX · 010 · eliminar la cuenta
--
-- Un comprador o un vendedor puede eliminar su cuenta. Se borran sus datos personales (el email, el nombre, el teléfono
-- y el DNI se reemplazan) y la cuenta queda sin acceso. Las compras y los pedidos se conservan con los datos de cada
-- compra, porque hacen falta para las facturas, las garantías y los reclamos. No borra ni cambia datos existentes.

ALTER TABLE usuarios ADD COLUMN eliminado_en TIMESTAMPTZ;

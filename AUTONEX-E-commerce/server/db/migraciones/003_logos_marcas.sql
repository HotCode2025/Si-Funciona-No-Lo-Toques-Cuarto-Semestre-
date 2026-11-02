-- AUTONEX · 003 · logos de las marcas de vehículos
-- La ruta local del logo (img/marcas/logos/<slug>.png) y si conviene mostrarlo sobre fondo oscuro (logos blancos).
-- Fuente, autor y licencia de cada logo: client/public/img/marcas/logos/logos.json.

ALTER TABLE marcas_vehiculo
  ADD COLUMN logo        TEXT,
  ADD COLUMN logo_fondo  TEXT NOT NULL DEFAULT 'claro' CHECK (logo_fondo IN ('claro', 'oscuro'));

-- AUTONEX · 013 · logo de los locales y foto de perfil de los usuarios
--
-- Los locales pueden subir su logo y cualquier usuario una foto de perfil (opcional). Se guardan en la tabla archivos,
-- igual que las fotos de las publicaciones. La foto de perfil es un dato personal: su archivo lleva una clave al azar y
-- solo se sirve con esa clave en el link (no se puede recorrer por número). Al eliminar la cuenta se borra.
-- No borra ni cambia datos existentes.

ALTER TABLE archivos ADD COLUMN clave TEXT;

ALTER TABLE usuarios ADD COLUMN avatar_archivo_id INTEGER REFERENCES archivos(id) ON DELETE SET NULL;
ALTER TABLE vendedores ADD COLUMN logo_archivo_id INTEGER REFERENCES archivos(id) ON DELETE SET NULL;

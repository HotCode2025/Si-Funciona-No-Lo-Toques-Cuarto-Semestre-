-- AUTONEX · 009 · confirmación de email y recuperación de contraseña
--
-- Cada cuenta nueva recibe un mail con un link para confirmar su email, y quien olvidó su contraseña recibe un link para
-- elegir una nueva. Los links llevan un token aleatorio; en la base se guarda solo su hash (SHA-256), con vencimiento y
-- uso único. Las cuentas que ya existían se toman como confirmadas.

ALTER TABLE usuarios ADD COLUMN email_verificado_en TIMESTAMPTZ;
UPDATE usuarios SET email_verificado_en = creado_en WHERE email_verificado_en IS NULL;

CREATE TABLE tokens_usuario (
  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL CHECK (tipo IN ('verificacion', 'recuperacion')),
  token_hash  TEXT NOT NULL UNIQUE,
  expira_en   TIMESTAMPTZ NOT NULL,
  usado_en    TIMESTAMPTZ,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tokens_usuario_usuario_idx ON tokens_usuario (usuario_id, tipo);

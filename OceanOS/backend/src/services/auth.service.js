import bcrypt from 'bcryptjs';
import { one } from '../db/index.js';
import { conflict, unauthorized } from '../utils/errors.js';

const PUBLICO = 'id, email, full_name, role, home_zone_id, reputation, streak_days, created_at';

export async function registrar({ email, password, fullName, homeZoneSlug }) {
  const existente = await one('SELECT 1 FROM users WHERE email = $1', [email]);
  if (existente) throw conflict('Ya hay una cuenta con ese correo');

  const zona = homeZoneSlug
    ? await one('SELECT id FROM zones WHERE slug = $1', [homeZoneSlug])
    : null;

  const hash = await bcrypt.hash(password, 10);
  return one(
    `INSERT INTO users (email, password_hash, full_name, home_zone_id)
     VALUES ($1, $2, $3, $4) RETURNING ${PUBLICO}`,
    [email, hash, fullName, zona?.id ?? null],
  );
}

export async function iniciarSesion({ email, password }) {
  const usuario = await one('SELECT * FROM users WHERE email = $1', [email]);
  // Mismo mensaje para usuario inexistente y contraseña incorrecta: no le
  // decimos a un atacante cuáles correos están registrados.
  if (!usuario) throw unauthorized('Correo o contraseña incorrectos');

  const coincide = await bcrypt.compare(password, usuario.password_hash);
  if (!coincide) throw unauthorized('Correo o contraseña incorrectos');

  delete usuario.password_hash;
  return usuario;
}

export async function perfil(userId) {
  return one(
    `SELECT u.id, u.email, u.full_name, u.role, u.home_zone_id,
            u.reputation, u.streak_days, u.created_at,
            b.balance_okn, b.ganados_okn, b.reportes, b.reportes_verificados,
            z.slug AS home_zone_slug, z.name AS home_zone_name,
            COALESCE(
              (SELECT json_agg(json_build_object(
                        'id', o.id, 'name', o.name, 'slug', o.slug,
                        'plan', o.plan, 'kind', o.kind, 'isOwner', m.is_owner))
                 FROM org_members m
                 JOIN organizations o ON o.id = m.org_id
                WHERE m.user_id = u.id), '[]'::json) AS organizaciones
       FROM users u
       JOIN user_balances b ON b.user_id = u.id
       LEFT JOIN zones z ON z.id = u.home_zone_id
      WHERE u.id = $1`,
    [userId],
  );
}

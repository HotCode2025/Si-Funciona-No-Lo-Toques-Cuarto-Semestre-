import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import { config, isProd } from '../config.js';
import { one } from '../db/index.js';
import { unauthorized, forbidden } from '../utils/errors.js';

const COOKIE = 'oceanos_sesion';

/**
 * Sesión por JWT guardado en cookie httpOnly. El token nunca toca
 * JavaScript del navegador, así que un XSS no puede robarlo.
 */
async function authPlugin(app) {
  await app.register(cookie);
  await app.register(jwt, {
    secret: config.jwtSecret,
    cookie: { cookieName: COOKIE, signed: false },
    sign: { expiresIn: '7d' },
  });

  app.decorate('darSesion', (reply, usuario) => {
    const token = app.jwt.sign({ id: usuario.id, role: usuario.role });
    reply.setCookie(COOKIE, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
  });

  app.decorate('cerrarSesion', (reply) => reply.clearCookie(COOKIE, { path: '/' }));

  /** Exige sesión válida y carga el usuario completo en request.user. */
  app.decorate('requiereSesion', async (request) => {
    try {
      await request.jwtVerify();
    } catch {
      throw unauthorized();
    }
    const usuario = await one(
      `SELECT id, email, full_name, role, home_zone_id, reputation, streak_days
         FROM users WHERE id = $1`,
      [request.user.id],
    );
    if (!usuario) throw unauthorized('Tu sesión ya no es válida');
    request.user = usuario;
  });

  /** Exige uno de los roles indicados. Se usa después de requiereSesion. */
  app.decorate('requiereRol', (...roles) => async (request) => {
    if (!request.user?.role) throw unauthorized();
    if (!roles.includes(request.user.role)) {
      throw forbidden(`Esta sección es para: ${roles.join(', ')}`);
    }
  });

  /**
   * Exige que el usuario pertenezca a la organización del parámetro
   * :orgId. Un admin pasa siempre. Deja request.org listo para usar.
   */
  app.decorate('requiereOrg', async (request) => {
    const { orgId } = request.params;
    const org = await one(
      `SELECT o.*, pl.max_projects, pl.has_iot, pl.has_reports, pl.has_carbon, pl.has_api
         FROM organizations o
         JOIN plan_limits pl ON pl.plan = o.plan
        WHERE o.id = $1`,
      [orgId],
    );
    if (!org) throw forbidden('Esa organización no existe o no es tuya');

    if (request.user.role !== 'admin') {
      const miembro = await one(
        'SELECT 1 FROM org_members WHERE org_id = $1 AND user_id = $2',
        [orgId, request.user.id],
      );
      if (!miembro) throw forbidden('No sos miembro de esa organización');
    }
    request.org = org;
  });
}

export default fp(authPlugin, { name: 'auth' });

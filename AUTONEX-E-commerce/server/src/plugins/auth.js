import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import { config } from '../config.js';
import { ErrorApi } from '../errores.js';
import { query } from '../db.js';

/**
 * JWT en el header Authorization: Bearer <token>.
 * Agrega los preHandlers `app.autenticar`, `app.autenticarOpcional`, `app.soloVendedor` y `app.soloAdmin`.
 */
async function autenticacion(app) {
  await app.register(jwt, {
    secret: config.jwtSecret,
    sign: { expiresIn: config.jwtExpira },
  });

  app.decorate('firmarToken', (usuario) =>
    app.jwt.sign({ id: usuario.id, email: usuario.email, rol: usuario.rol, vendedor_id: usuario.vendedor_id ?? null }));

  app.decorate('autenticar', async (request) => {
    try {
      await request.jwtVerify();
    } catch (error) {
      const vencido = error.code === 'FST_JWT_AUTHORIZATION_TOKEN_EXPIRED';
      throw new ErrorApi(401, vencido
        ? 'Tu sesión venció. Volvé a iniciar sesión.'
        : 'Tenés que iniciar sesión para continuar.');
    }
    // El token tiene que seguir correspondiendo a la misma cuenta (por ejemplo, después de recrear la base los ids
    // cambian): mismo usuario, mismo email y mismo rol que en la base.
    const { rows: [u] } = await query(
      'SELECT u.email, u.rol, v.id AS vendedor_id FROM usuarios u LEFT JOIN vendedores v ON v.usuario_id = u.id WHERE u.id = $1 AND u.eliminado_en IS NULL',
      [request.user.id]);
    const t = request.user;
    if (!u || u.rol !== t.rol || (t.email && u.email !== t.email) || (u.vendedor_id ?? null) !== (t.vendedor_id ?? null)) {
      throw new ErrorApi(401, 'Tu sesión ya no es válida. Volvé a iniciar sesión.');
    }
  });

  // Rutas que también acepta un invitado (comprar sin cuenta): si viene un token se valida igual que siempre;
  // si no viene, request.user queda vacío.
  app.decorate('autenticarOpcional', async (request) => {
    if (request.headers.authorization) await app.autenticar(request);
  });

  app.decorate('soloVendedor', async (request) => {
    await app.autenticar(request);
    if (request.user.rol !== 'vendedor' || !request.user.vendedor_id) {
      throw new ErrorApi(403, 'Esta sección es solo para cuentas de vendedor.');
    }
  });

  app.decorate('soloAdmin', async (request) => {
    await app.autenticar(request);
    if (request.user.rol !== 'admin') throw new ErrorApi(403, 'Esta sección es solo para administradores del catálogo.');
  });
}

export default fp(autenticacion, { name: 'autenticacion' });

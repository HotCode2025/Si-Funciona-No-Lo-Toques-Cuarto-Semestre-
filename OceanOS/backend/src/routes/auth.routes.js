import * as auth from '../services/auth.service.js';

const credenciales = {
  type: 'object',
  required: ['email', 'password'],
  properties: {
    email:    { type: 'string', format: 'email', maxLength: 160 },
    password: { type: 'string', minLength: 8, maxLength: 200 },
  },
};

export default async function rutas(app) {
  app.post('/registro', {
    config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password', 'fullName'],
        properties: {
          ...credenciales.properties,
          fullName:     { type: 'string', minLength: 2, maxLength: 120 },
          homeZoneSlug: { type: 'string', maxLength: 80 },
        },
      },
    },
  }, async (request, reply) => {
    const usuario = await auth.registrar(request.body);
    app.darSesion(reply, usuario);
    return reply.code(201).send({ user: usuario });
  });

  app.post('/sesion', {
    config: { rateLimit: { max: 20, timeWindow: '15 minutes' } },
    schema: { body: credenciales },
  }, async (request, reply) => {
    const usuario = await auth.iniciarSesion(request.body);
    app.darSesion(reply, usuario);
    return { user: usuario };
  });

  app.delete('/sesion', async (request, reply) => {
    app.cerrarSesion(reply);
    return { ok: true };
  });

  app.get('/yo', { onRequest: [app.requiereSesion] }, async (request) => ({
    user: await auth.perfil(request.user.id),
  }));
}

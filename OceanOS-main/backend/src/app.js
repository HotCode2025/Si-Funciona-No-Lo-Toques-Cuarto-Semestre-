import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import rateLimit from '@fastify/rate-limit';
import authPlugin from './plugins/auth.js';
import rutas from './routes/index.js';
import { config, isProd } from './config.js';
import { AppError } from './utils/errors.js';

export async function buildApp(opciones = {}) {
  const app = Fastify({
    logger: isProd
      ? true
      : { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } },
    ajv: {
      customOptions: { removeAdditional: 'all', coerceTypes: true, useDefaults: true },
    },
    ...opciones,
  });

  await app.register(sensible);
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: config.corsOrigin, credentials: true });
  await app.register(rateLimit, { global: false, max: 200, timeWindow: '1 minute' });
  await app.register(authPlugin);

  // OJO con el orden: `await app.register(...)` hace que Fastify construya
  // ese subárbol en el acto. Si los handlers se definen DESPUÉS de
  // registrar las rutas, no las alcanzan y se filtran los errores crudos
  // de Postgres al cliente. Por eso van primero.
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        error: { code: error.code, message: error.message },
      });
    }
    if (error.validation) {
      return reply.code(400).send({
        error: { code: 'BAD_REQUEST', message: 'Revisá los datos del formulario' },
      });
    }
    if (error.statusCode && error.statusCode < 500) {
      return reply.code(error.statusCode).send({
        error: { code: error.code ?? 'ERROR', message: error.message },
      });
    }
    request.log.error({ err: error }, 'error no controlado');
    return reply.code(500).send({
      error: { code: 'INTERNAL', message: 'Algo se rompió de nuestro lado' },
    });
  });

  app.setNotFoundHandler((request, reply) =>
    reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Esa ruta no existe' } }));

  await app.register(rutas, { prefix: '/api' });

  return app;
}

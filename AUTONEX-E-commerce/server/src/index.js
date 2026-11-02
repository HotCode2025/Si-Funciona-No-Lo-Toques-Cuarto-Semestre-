import { construirApp } from './app.js';
import { config, mercadoPagoConfigurado } from './config.js';
import { pool } from './db.js';

const app = await construirApp({
  logger: { level: config.entorno === 'production' ? 'info' : 'debug' },
});

try {
  await pool.query('SELECT 1');
} catch (error) {
  app.log.error(`No se pudo conectar a PostgreSQL (${error.message}). Revisá DATABASE_URL en server/.env.`);
  process.exit(1);
}

await app.listen({ port: config.puerto, host: config.host });
app.log.info(`AUTONEX API escuchando en http://${config.host}:${config.puerto}${config.basePath}/api`);
if (!mercadoPagoConfigurado()) {
  app.log.warn('Mercado Pago no está configurado: completá MP_ACCESS_TOKEN en server/.env para poder cobrar.');
}

for (const senal of ['SIGINT', 'SIGTERM']) {
  process.on(senal, async () => {
    app.log.info(`Recibido ${senal}, cerrando...`);
    await app.close();
    await pool.end();
    process.exit(0);
  });
}

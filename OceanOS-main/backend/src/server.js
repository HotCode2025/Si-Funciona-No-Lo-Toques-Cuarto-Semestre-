import { buildApp } from './app.js';
import { config } from './config.js';
import { closePool } from './db/index.js';

const app = await buildApp();

try {
  await app.listen({ port: config.port, host: config.host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

for (const senal of ['SIGINT', 'SIGTERM']) {
  process.on(senal, async () => {
    app.log.info('cerrando...');
    await app.close();
    await closePool();
    process.exit(0);
  });
}

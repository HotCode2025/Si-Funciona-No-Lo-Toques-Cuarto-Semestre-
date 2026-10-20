import authRoutes        from './auth.routes.js';
import ecosystemRoutes   from './ecosystem.routes.js';
import sightingsRoutes   from './sightings.routes.js';
import tokensRoutes      from './tokens.routes.js';
import orgsRoutes        from './orgs.routes.js';
import marketplaceRoutes from './marketplace.routes.js';
import automationsRoutes  from './automations.routes.js';

/**
 * Mapa de la API, ordenado por capa del producto.
 *   Capa 1 · /avistamientos, /tokens
 *   Capa 2 · /ecosistema (público), /organizaciones (clientes)
 *   Capa 3 · /mercado
 */
export default async function rutas(app) {
  app.get('/salud', async () => ({ ok: true, ts: new Date().toISOString() }));

  await app.register(authRoutes,        { prefix: '/auth' });
  await app.register(ecosystemRoutes,   { prefix: '/ecosistema' });
  await app.register(sightingsRoutes,   { prefix: '/avistamientos' });
  await app.register(tokensRoutes,      { prefix: '/tokens' });
  await app.register(orgsRoutes,        { prefix: '/organizaciones' });
  await app.register(marketplaceRoutes, { prefix: '/mercado' });
  await app.register(automationsRoutes,  { prefix: '/automatizaciones' });
}

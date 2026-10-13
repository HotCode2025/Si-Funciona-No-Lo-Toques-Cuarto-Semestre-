import * as eco from '../services/ecosystem.service.js';

// Capa 2 en su cara pública: el dashboard que se le muestra a pesqueras
// y ONGs antes de que sean clientes. Todo abierto, sin sesión.
export default async function rutas(app) {
  app.get('/indicadores', async () => ({ indicadores: await eco.indicadoresGlobales() }));
  app.get('/zonas',       async () => ({ zonas: await eco.saludDeZonas() }));
  app.get('/especies',    async () => ({ especies: await eco.especies() }));
  app.get('/ranking',     async () => ({ ranking: await eco.ranking() }));

  app.get('/zonas/:slug', {
    schema: {
      params: {
        type: 'object',
        required: ['slug'],
        properties: { slug: { type: 'string', maxLength: 80 } },
      },
    },
  }, async (request) => ({ zona: await eco.zona(request.params.slug) }));
}

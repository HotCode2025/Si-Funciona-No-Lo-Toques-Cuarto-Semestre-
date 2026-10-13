import * as market from '../services/marketplace.service.js';

export default async function rutas(app) {
  app.get('/indicadores', async () => ({ indicadores: await market.indicadores() }));

  app.get('/', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          tipo: { type: 'string', enum: ['credito_carbono', 'hectarea_viva', 'bono_restauracion'] },
          zona: { type: 'string', maxLength: 80 },
        },
      },
    },
  }, async (request) => ({
    activos: await market.listar({ assetKind: request.query.tipo, zoneSlug: request.query.zona }),
  }));

  app.get('/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
    },
  }, async (request) => ({ activo: await market.obtener(request.params.id) }));

  app.post('/:id/ordenes', {
    config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        required: ['buyerName', 'buyerEmail', 'units'],
        properties: {
          buyerName:  { type: 'string', minLength: 2, maxLength: 160 },
          buyerEmail: { type: 'string', format: 'email', maxLength: 160 },
          units:      { type: 'number', exclusiveMinimum: 0 },
          buyerOrgId: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (request, reply) => {
    const resultado = await market.comprar(request.params.id, request.body);
    return reply.code(201).send(resultado);
  });
}

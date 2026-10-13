import * as sightings from '../services/sightings.service.js';

const KINDS = ['tiburon', 'kelp', 'fauna', 'amenaza'];

export default async function rutas(app) {
  // Lectura pública: el mapa en vivo se ve sin cuenta.
  app.get('/', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          zone:   { type: 'string', maxLength: 80 },
          kind:   { type: 'string', enum: KINDS },
          status: { type: 'string', enum: ['pendiente', 'en_votacion', 'verificado', 'rechazado'] },
          desde:  { type: 'string' },
          limite: { type: 'integer', minimum: 1, maximum: 500, default: 200 },
        },
      },
    },
  }, async (request) => ({
    avistamientos: await sightings.listar({
      zoneSlug: request.query.zone,
      kind:     request.query.kind,
      status:   request.query.status,
      desde:    request.query.desde,
      limite:   request.query.limite,
    }),
  }));

  app.get('/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
    },
  }, async (request) => ({ avistamiento: await sightings.obtener(request.params.id) }));

  app.post('/', {
    onRequest: [app.requiereSesion],
    config: { rateLimit: { max: 60, timeWindow: '1 hour' } },
    schema: {
      body: {
        type: 'object',
        required: ['zoneSlug', 'kind', 'lat', 'lng'],
        properties: {
          zoneSlug:     { type: 'string', maxLength: 80 },
          kind:         { type: 'string', enum: KINDS },
          lat:          { type: 'number', minimum: -90,  maximum: 90 },
          lng:          { type: 'number', minimum: -180, maximum: 180 },
          speciesId:    { type: 'string', format: 'uuid' },
          depthM:       { type: 'number', minimum: 0, maximum: 2000 },
          individuals:  { type: 'integer', minimum: 1, maximum: 10000 },
          kelpCoverPct: { type: 'number', minimum: 0, maximum: 100 },
          photoUrl:     { type: 'string', maxLength: 500 },
          aiConfidence: { type: 'number', minimum: 0, maximum: 1 },
          aiLabel:      { type: 'string', maxLength: 160 },
          notes:        { type: 'string', maxLength: 1000 },
          observedAt:   { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const resultado = await sightings.crear(request.user.id, request.body);
    return reply.code(201).send(resultado);
  });

  app.get('/cola/verificacion', { onRequest: [app.requiereSesion] }, async (request) => ({
    cola: await sightings.colaDeVerificacion(request.user.id),
  }));

  app.post('/:id/voto', {
    onRequest: [app.requiereSesion],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        required: ['agrees'],
        properties: {
          agrees:    { type: 'boolean' },
          speciesId: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (request) => sightings.votar(request.user.id, request.params.id, request.body));
}

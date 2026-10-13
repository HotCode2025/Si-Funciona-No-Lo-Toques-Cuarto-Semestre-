import * as projects from '../services/projects.service.js';

const ESTADOS = ['planificado', 'en_curso', 'monitoreo', 'finalizado', 'suspendido'];
const paramsOrg = {
  type: 'object',
  required: ['orgId'],
  properties: { orgId: { type: 'string', format: 'uuid' } },
};

export default async function rutas(app) {
  // Toda esta rama exige sesión y pertenencia a la organización.
  app.addHook('onRequest', app.requiereSesion);
  app.addHook('preHandler', app.requiereOrg);

  app.get('/:orgId/panel', { schema: { params: paramsOrg } },
    async (request) => projects.panel(request.org.id));

  app.get('/:orgId/sensores', { schema: { params: paramsOrg } },
    async (request) => projects.sensores(request.org));

  app.get('/:orgId/proyectos', { schema: { params: paramsOrg } },
    async (request) => ({ proyectos: await projects.listar(request.org.id) }));

  app.get('/:orgId/proyectos/:projectId', {
    schema: {
      params: {
        type: 'object',
        required: ['orgId', 'projectId'],
        properties: {
          orgId:     { type: 'string', format: 'uuid' },
          projectId: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (request) => ({
    proyecto: await projects.obtener(request.org.id, request.params.projectId),
  }));

  app.post('/:orgId/proyectos', {
    schema: {
      params: paramsOrg,
      body: {
        type: 'object',
        required: ['name', 'zoneSlug'],
        properties: {
          name:            { type: 'string', minLength: 2, maxLength: 160 },
          zoneSlug:        { type: 'string', maxLength: 80 },
          description:     { type: 'string', maxLength: 2000 },
          status:          { type: 'string', enum: ESTADOS },
          hectares:        { type: 'number', minimum: 0 },
          targetHectares:  { type: 'number', minimum: 0 },
          startedOn:       { type: 'string' },
          endsOn:          { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const proyecto = await projects.crear(request.org, request.body);
    return reply.code(201).send({ proyecto });
  });

  app.patch('/:orgId/proyectos/:projectId', {
    schema: {
      params: {
        type: 'object',
        required: ['orgId', 'projectId'],
        properties: {
          orgId:     { type: 'string', format: 'uuid' },
          projectId: { type: 'string', format: 'uuid' },
        },
      },
      body: {
        type: 'object',
        properties: {
          name:           { type: 'string', minLength: 2, maxLength: 160 },
          description:    { type: 'string', maxLength: 2000 },
          status:         { type: 'string', enum: ESTADOS },
          hectares:       { type: 'number', minimum: 0 },
          targetHectares: { type: 'number', minimum: 0 },
          startedOn:      { type: 'string' },
          endsOn:         { type: 'string' },
        },
      },
    },
  }, async (request) => ({
    proyecto: await projects.actualizar(request.org.id, request.params.projectId, request.body),
  }));

  app.post('/:orgId/proyectos/:projectId/hitos', {
    schema: {
      params: {
        type: 'object',
        required: ['orgId', 'projectId'],
        properties: {
          orgId:     { type: 'string', format: 'uuid' },
          projectId: { type: 'string', format: 'uuid' },
        },
      },
      body: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string', minLength: 2, maxLength: 200 },
          dueOn: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const hito = await projects.agregarHito(request.org.id, request.params.projectId, request.body);
    return reply.code(201).send({ hito });
  });

  app.patch('/:orgId/hitos/:milestoneId', {
    schema: {
      params: {
        type: 'object',
        required: ['orgId', 'milestoneId'],
        properties: {
          orgId:       { type: 'string', format: 'uuid' },
          milestoneId: { type: 'string', format: 'uuid' },
        },
      },
      body: {
        type: 'object',
        required: ['done'],
        properties: { done: { type: 'boolean' } },
      },
    },
  }, async (request) => ({
    hito: await projects.marcarHito(request.org.id, request.params.milestoneId, request.body.done),
  }));
}

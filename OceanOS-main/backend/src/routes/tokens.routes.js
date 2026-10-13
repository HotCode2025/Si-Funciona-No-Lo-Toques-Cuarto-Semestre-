import * as tokens from '../services/tokens.service.js';
import {
  PREMIOS, UMBRAL_IA, VOTOS_PARA_RESOLVER, DIAS_ZONA_NUEVA, DIAS_BONO_RACHA, REPUTACION,
} from '../services/sightings.service.js';

export default async function rutas(app) {
  app.addHook('onRequest', app.requiereSesion);

  // Las reglas que aplica sightings.service.js, para la página que las
  // explica. Se leen de las constantes, así la explicación no puede quedar
  // desactualizada respecto de lo que se cobra.
  app.get('/reglas', async () => ({
    reglas: {
      premios: PREMIOS,
      umbralIa: UMBRAL_IA,
      votosParaResolver: VOTOS_PARA_RESOLVER,
      diasZonaNueva: DIAS_ZONA_NUEVA,
      diasBonoRacha: DIAS_BONO_RACHA,
      reputacion: REPUTACION,
    },
  }));

  app.get('/billetera', async (request) => tokens.billetera(request.user.id));
  app.get('/recompensas', async () => ({ recompensas: await tokens.recompensas() }));
  app.get('/canjes', async (request) => ({ canjes: await tokens.misCanjes(request.user.id) }));

  app.post('/canjes', {
    schema: {
      body: {
        type: 'object',
        required: ['rewardId'],
        properties: { rewardId: { type: 'string', format: 'uuid' } },
      },
    },
  }, async (request, reply) => {
    const resultado = await tokens.canjear(request.user.id, request.body.rewardId);
    return reply.code(201).send(resultado);
  });
}

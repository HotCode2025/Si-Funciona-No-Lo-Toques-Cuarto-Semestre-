import * as automatizaciones from '../services/automations.service.js';
import { UMBRAL_IA } from '../services/sightings.service.js';

export default async function rutas(app) {
  app.addHook('onRequest', app.requiereSesion);

  app.get('/', async () => ({
    flujos: await automatizaciones.flujos(),
    condicion: { umbral: UMBRAL_IA, estados: automatizaciones.ESTADOS_AMENAZA },
    registro: await automatizaciones.registro(),
  }));
}

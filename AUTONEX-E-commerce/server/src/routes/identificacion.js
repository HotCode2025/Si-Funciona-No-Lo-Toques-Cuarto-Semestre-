import { identificarPatente, identificarVin } from '../services/identificacion.js';

// Preparado para una integración futura con un servicio autorizado (ver services/identificacion.js).
export default async function rutasIdentificacion(app) {
  const params = { type: 'object', required: ['valor'], properties: { valor: { type: 'string', minLength: 5, maxLength: 25 } } };
  app.get('/identificar/patente/:valor', { schema: { params } }, async (request) => identificarPatente(request.params.valor));
  app.get('/identificar/vin/:valor', { schema: { params } }, async (request) => identificarVin(request.params.valor));
}

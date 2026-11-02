import { pool } from '../db.js';
import { validarCarrito } from '../services/carrito.js';

export const esquemaItems = {
  type: 'array',
  minItems: 1,
  maxItems: 60,
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['publicacion_id', 'cantidad'],
    properties: {
      publicacion_id: { type: 'integer', minimum: 1 },
      cantidad: { type: 'integer', minimum: 1, maximum: 999 },
    },
  },
};

export default async function rutasCarrito(app) {
  // El frontend sincroniza el carrito guardado en localStorage con precios y stock reales.
  app.post('/carrito/validar', {
    schema: {
      body: { type: 'object', additionalProperties: false, required: ['items'], properties: { items: esquemaItems } },
    },
  }, async (request) => ({ items: await validarCarrito(pool, request.body.items) }));
}

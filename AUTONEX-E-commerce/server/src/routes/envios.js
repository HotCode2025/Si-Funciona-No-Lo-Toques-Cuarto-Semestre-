import { query } from '../db.js';
import { ErrorApi } from '../errores.js';
import { id, provincia, texto } from '../esquemas.js';
import { cotizarEnvio, TARIFAS } from '../services/envios.js';

export default async function rutasEnvios(app) {
  // Tabla de tarifas (para mostrarla en el frontend / README).
  app.get('/envios/tarifas', async () => TARIFAS);

  app.post('/envios/cotizar', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['vendedor_id', 'provincia', 'localidad'],
        properties: {
          vendedor_id: id,
          provincia,
          localidad: texto(80, 2),
          unidades: { type: 'integer', minimum: 1, maximum: 999 },
        },
      },
    },
  }, async (request) => {
    const { vendedor_id: vendedorId, provincia: prov, localidad, unidades = 1 } = request.body;
    const { rows: [vendedor] } = await query(
      'SELECT id, nombre_comercial, ciudad, provincia FROM vendedores WHERE id = $1', [vendedorId]);
    if (!vendedor) throw new ErrorApi(404, 'No encontramos ese vendedor.');
    return { vendedor, ...cotizarEnvio(vendedor, { provincia: prov, localidad }, unidades) };
  });
}

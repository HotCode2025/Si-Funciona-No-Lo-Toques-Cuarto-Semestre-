/**
 * Cliente de la API. Un solo lugar donde se arma el pedido y se normaliza
 * el error para toda la app.
 *
 * Por ahora el sitio corre en modo demostración: en vez de ir por fetch a
 * /api, cada pedido lo atiende services/demo/servidor.js dentro del
 * navegador. Las páginas no se enteran, porque las rutas y las respuestas
 * tienen la misma forma que las del backend.
 */
import { atender } from './demo/servidor.js';
import { ApiError } from './errores.js';

export { ApiError };

// Las lecturas vuelven al instante. Las escrituras esperan un momento para
// que el botón muestre que está enviando: sin eso, la confirmación aparece
// tan rápido que no se nota que pasó algo.
const PAUSA_ESCRITURA_MS = 350;
const pausa = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

async function pedir(metodo, ruta, body) {
  if (metodo !== 'GET') await pausa(PAUSA_ESCRITURA_MS);
  try {
    return await atender(metodo, ruta, body);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    // Un error de programación en el servidor de demo no debería romper
    // la pantalla entera: llega como cualquier otro error de la API.
    console.error(error);
    throw new ApiError('Algo salió mal', 'ERROR', 500);
  }
}

export const api = {
  get:    (ruta)       => pedir('GET', ruta),
  post:   (ruta, body) => pedir('POST', ruta, body),
  patch:  (ruta, body) => pedir('PATCH', ruta, body),
  delete: (ruta)       => pedir('DELETE', ruta),
};

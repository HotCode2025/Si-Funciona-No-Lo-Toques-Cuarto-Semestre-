import crypto from 'node:crypto';
import { query } from '../db.js';
import { ErrorApi } from '../errores.js';

const iguales = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Sirve las imágenes guardadas en la base (fotos de las publicaciones, logos y fotos de perfil). No cambian nunca: se
 * cachean un año. Las privadas (fotos de perfil) tienen clave y solo se sirven con ?k=clave.
 */
export default async function rutasArchivos(app) {
  app.get('/archivos/:id', {
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string', pattern: '^[0-9]{1,10}$' } } },
      querystring: { type: 'object', properties: { k: { type: 'string', maxLength: 64 } } },
    },
  }, async (request, reply) => {
    const { rows: [archivo] } = await query('SELECT datos, tipo_mime, sha256, clave FROM archivos WHERE id = $1', [Number(request.params.id)]);
    if (!archivo || (archivo.clave && !iguales(archivo.clave, request.query.k || ''))) throw new ErrorApi(404, 'No encontramos esa imagen.');
    return reply
      .header('Cache-Control', `${archivo.clave ? 'private' : 'public'}, max-age=31536000, immutable`)
      .header('ETag', `"${archivo.sha256}"`)
      .type(archivo.tipo_mime)
      .send(archivo.datos);
  });
}

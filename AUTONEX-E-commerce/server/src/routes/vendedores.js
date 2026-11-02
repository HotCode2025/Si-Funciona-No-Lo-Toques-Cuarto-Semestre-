import { query } from '../db.js';
import { ErrorApi } from '../errores.js';
import { leerHorarioTexto } from '../horarios.js';

const CAMPOS_PUBLICOS = `ve.id, ve.slug, ve.nombre_comercial, ve.descripcion, ve.direccion, ve.ciudad, ve.provincia,
  ve.telefono, ve.whatsapp, ve.horario, ve.horarios, ve.logo, ve.es_desarmadero`;

export default async function rutasVendedores(app) {
  app.get('/vendedores', async () => {
    const { rows } = await query(`
      SELECT ${CAMPOS_PUBLICOS},
             count(pu.id) FILTER (WHERE pu.estado = 'activa' AND pu.stock > 0) AS publicaciones
        FROM vendedores ve
        JOIN usuarios us ON us.id = ve.usuario_id AND us.email_verificado_en IS NOT NULL
        LEFT JOIN publicaciones pu ON pu.vendedor_id = ve.id
       GROUP BY ve.id ORDER BY ve.es_desarmadero, ve.nombre_comercial`);
    return rows;
  });

  app.get('/vendedores/:slug', {
    schema: { params: { type: 'object', properties: { slug: { type: 'string', maxLength: 80 } } } },
  }, async (request) => {
    const { rows: [vendedor] } = await query(`
      SELECT ${CAMPOS_PUBLICOS},
             (SELECT count(*) FROM publicaciones pu
               WHERE pu.vendedor_id = ve.id AND pu.estado = 'activa' AND pu.stock > 0) AS publicaciones,
             (SELECT coalesce(json_agg(c ORDER BY c.orden), '[]') FROM (
                SELECT DISTINCT ca.nombre, ca.slug, ca.orden
                  FROM publicaciones pu
                  JOIN productos pr ON pr.id = pu.producto_id
                  JOIN categorias ca ON ca.id = pr.categoria_id
                 WHERE pu.vendedor_id = ve.id AND pu.estado = 'activa') c) AS categorias
        FROM vendedores ve JOIN usuarios us ON us.id = ve.usuario_id AND us.email_verificado_en IS NOT NULL
       WHERE ve.slug = $1`, [request.params.slug]);
    if (!vendedor) throw new ErrorApi(404, 'No encontramos ese vendedor.');
    return { ...vendedor, horarios: vendedor.horarios ?? leerHorarioTexto(vendedor.horario) };
  });
}

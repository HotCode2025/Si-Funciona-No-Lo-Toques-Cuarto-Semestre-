import { query } from '../db.js';
import { ErrorApi } from '../errores.js';
import { id, paramsId } from '../esquemas.js';
import { normalizarTexto } from '../catalogo/normalizacion.js';

// Selector "Mi vehículo": marca -> modelo -> año -> generación -> versión -> motor.
// Todo sale de la base (no hay listas fijas en el frontend).

const anio = { type: 'integer', minimum: 1900, maximum: 2100 };
const segmento = { type: 'string', enum: ['particular', 'comercial', 'pesado', 'moto'] };
const categoriaMoto = { type: 'string', pattern: '^[A-Z_]{2,20}$' };

// Presencia en Argentina de una marca o modelo (NULL = sin datos)
const PRESENCIA = (t) => `json_build_object('disponible_argentina', ${t}.disponible_argentina, 'oficial_argentina', ${t}.oficial_argentina,
  'importado', ${t}.importado, 'historico_argentina', ${t}.historico_argentina, 'internacional', ${t}.internacional)`;

// Foto principal de un modelo (real, con licencia libre o autorizada) y su crédito
const FOTO_MODELO = `(SELECT json_build_object('archivo', i.archivo, 'autor', i.autor, 'licencia', i.licencia,
                            'licencia_url', i.licencia_url, 'url_origen', i.url_origen)
                       FROM imagenes i
                      WHERE i.entidad = 'modelo' AND i.registro_id = mo.id AND i.archivo IS NOT NULL
                        AND i.estado <> 'IMAGE_MISSING' AND i.permiso IN ('libre', 'autorizado')
                      ORDER BY i.principal DESC, i.id LIMIT 1)`;

export default async function rutasVehiculos(app) {
  app.get('/vehiculos/marcas', {
    schema: {
      querystring: {
        type: 'object',
        properties: { segmento, q: { type: 'string', maxLength: 60 } },
      },
    },
  }, async (request) => {
    const { segmento: seg, q } = request.query;
    // Motos: primero las marcas con presencia oficial en Argentina y después las de más modelos
    const orden = seg === 'moto'
      ? 'ma.oficial_argentina IS TRUE DESC, ma.disponible_argentina IS TRUE DESC, ma.popularidad DESC, count(mo.id) DESC, ma.nombre'
      : 'ma.popularidad DESC, ma.nombre';
    const { rows } = await query(`
      SELECT ma.id, ma.nombre, ma.slug, ma.imagen, ma.logo, ma.logo_fondo, ma.segmento, ma.estado_mercado, ma.popularidad,
             ${PRESENCIA('ma')} AS presencia, count(mo.id) AS modelos
        FROM marcas_vehiculo ma LEFT JOIN modelos_vehiculo mo ON mo.marca_id = ma.id AND ($1::text IS DISTINCT FROM 'moto' OR mo.segmento = 'moto')
       WHERE ($1::text IS NULL OR EXISTS (SELECT 1 FROM modelos_vehiculo x WHERE x.marca_id = ma.id AND x.segmento = $1))
         AND ($2::text IS NULL OR normalizar(ma.nombre) LIKE '%' || normalizar($2) || '%')
       GROUP BY ma.id
      HAVING count(mo.id) > 0
       ORDER BY ${orden}`, [seg ?? null, q ?? null]);
    return rows;
  });

  app.get('/vehiculos/marcas/:id/modelos', {
    schema: {
      params: paramsId,
      querystring: { type: 'object', properties: { segmento, categoria: categoriaMoto } },
    },
  }, async (request) => {
    const { segmento: seg, categoria } = request.query;
    // Sin segmento ("Todos") las motos van después de los autos de la marca
    const { rows } = await query(`
      SELECT mo.id, mo.nombre, mo.segmento, mo.estado_mercado, mo.anio_desde, mo.anio_hasta, mo.popularidad,
             mo.estado_verificacion, t.slug AS tipo, t.nombre AS tipo_nombre,
             (SELECT count(*) FROM vehiculos v WHERE v.modelo_id = mo.id) AS versiones,
             CASE WHEN mo.segmento = 'moto' THEN ${PRESENCIA('mo')} END AS presencia,
             CASE WHEN mo.segmento = 'moto' THEN coalesce((
               SELECT json_agg(cm.codigo ORDER BY cm.orden) FROM modelo_categorias_moto mc
                 JOIN categorias_moto cm ON cm.id = mc.categoria_id
                WHERE mc.modelo_id = mo.id AND mc.estado_verificacion <> 'DISCONTINUED'), '[]'::json) END AS categorias,
             CASE WHEN mo.segmento = 'moto' THEN ${FOTO_MODELO} END AS foto
        FROM modelos_vehiculo mo LEFT JOIN tipos_vehiculo t ON t.id = mo.tipo_vehiculo_id
       WHERE mo.marca_id = $1 AND ($2::text IS NULL OR mo.segmento = $2)
         AND ($3::text IS NULL OR EXISTS (SELECT 1 FROM modelo_categorias_moto mc JOIN categorias_moto cm ON cm.id = mc.categoria_id
                                          WHERE mc.modelo_id = mo.id AND cm.codigo = $3))
       ORDER BY ($2::text IS NULL AND mo.segmento = 'moto'), mo.nombre`, [request.params.id, seg ?? null, categoria ?? null]);
    return rows;
  });

  // Ficha de un modelo (sobre todo para motos, que pueden no tener años ni versiones cargadas todavía)
  app.get('/vehiculos/modelos/:id', { schema: { params: paramsId } }, async (request) => {
    const { rows: [modelo] } = await query(`
      SELECT mo.id, mo.nombre, mo.segmento, mo.estado_mercado, mo.anio_desde, mo.anio_hasta, mo.estado_verificacion,
             mo.confianza, mo.wikidata, t.slug AS tipo, t.nombre AS tipo_nombre, ${PRESENCIA('mo')} AS presencia,
             json_build_object('id', ma.id, 'nombre', ma.nombre, 'slug', ma.slug, 'logo', ma.logo, 'logo_fondo', ma.logo_fondo) AS marca,
             CASE WHEN f.id IS NULL THEN NULL ELSE json_build_object('nombre', f.nombre, 'url', f.url, 'licencia', f.licencia) END AS fuente,
             (SELECT count(*) FROM vehiculos v WHERE v.modelo_id = mo.id) AS versiones,
             coalesce((SELECT json_agg(json_build_object('nombre', g.nombre, 'anio_desde', g.anio_desde, 'anio_hasta', g.anio_hasta,
                                                         'estado', g.estado_verificacion) ORDER BY g.anio_desde)
                         FROM generaciones g WHERE g.modelo_id = mo.id), '[]'::json) AS generaciones,
             (SELECT min(v.anio_desde) FROM vehiculos v WHERE v.modelo_id = mo.id) AS primer_anio_versiones,
             (SELECT max(coalesce(v.anio_hasta, v.anio_desde)) FROM vehiculos v WHERE v.modelo_id = mo.id) AS ultimo_anio_versiones,
             coalesce((SELECT json_agg(json_build_object('codigo', cm.codigo, 'nombre', cm.nombre, 'estado', mc.estado_verificacion) ORDER BY cm.orden)
                         FROM modelo_categorias_moto mc JOIN categorias_moto cm ON cm.id = mc.categoria_id
                        WHERE mc.modelo_id = mo.id AND mc.estado_verificacion <> 'DISCONTINUED'), '[]'::json) AS categorias,
             coalesce((SELECT json_agg(json_build_object('tipo', i.tipo, 'principal', i.principal, 'archivo', i.archivo,
                                                         'autor', i.autor, 'licencia', i.licencia, 'licencia_url', i.licencia_url,
                                                         'url_origen', i.url_origen, 'estado', i.estado) ORDER BY i.principal DESC, i.id)
                         FROM imagenes i
                        WHERE i.entidad = 'modelo' AND i.registro_id = mo.id AND i.archivo IS NOT NULL
                          AND i.estado <> 'IMAGE_MISSING' AND i.permiso IN ('libre', 'autorizado')), '[]'::json) AS imagenes
        FROM modelos_vehiculo mo
        JOIN marcas_vehiculo ma ON ma.id = mo.marca_id
        LEFT JOIN tipos_vehiculo t ON t.id = mo.tipo_vehiculo_id
        LEFT JOIN fuentes f ON f.id = mo.fuente_id
       WHERE mo.id = $1`, [request.params.id]);
    if (!modelo) throw new ErrorApi(404, 'No encontramos ese modelo.');
    // Sin foto real: IMAGE_MISSING (nunca se usa la foto de otro modelo parecido)
    return { ...modelo, imagen_estado: modelo.imagenes.length ? 'OK' : 'IMAGE_MISSING' };
  });

  app.get('/vehiculos/modelos/:id/anios', { schema: { params: paramsId } }, async (request) => {
    const { rows } = await query(`
      SELECT DISTINCT generate_series(anio_desde::int, coalesce(anio_hasta, anio_desde)::int) AS anio
        FROM vehiculos WHERE modelo_id = $1 ORDER BY anio DESC`, [request.params.id]);
    return rows.map((r) => r.anio);
  });

  app.get('/vehiculos/modelos/:id/generaciones', {
    schema: { params: paramsId, querystring: { type: 'object', properties: { anio } } },
  }, async (request) => {
    const { rows } = await query(`
      SELECT g.id, g.nombre, g.numero, g.codigo, g.anio_desde, g.anio_hasta, g.estado_verificacion,
             (SELECT count(*) FROM vehiculos v WHERE v.generacion_id = g.id) AS versiones
        FROM generaciones g
       WHERE g.modelo_id = $1 AND ($2::int IS NULL OR $2 BETWEEN g.anio_desde AND coalesce(g.anio_hasta, 9999))
       ORDER BY g.anio_desde`, [request.params.id, request.query.anio ?? null]);
    return rows;
  });

  app.get('/vehiculos/modelos/:id/versiones', {
    schema: { params: paramsId, querystring: { type: 'object', properties: { anio, generacion: id } } },
  }, async (request) => {
    const { anio: a, generacion } = request.query;
    const { rows } = await query(`
      SELECT v.id, v.codigo, v.version, v.anio_desde, v.anio_hasta, v.carroceria, v.transmision, v.velocidades,
             v.traccion, v.combustible, v.estado_mercado, v.estado_verificacion, v.popularidad, v.generacion_id,
             t.nombre AS tipo, m.id AS motor_id, m.nombre AS motor, m.cilindrada_cc, m.potencia_cv, m.tiempos, m.alimentacion,
             coalesce(v.combustible, m.combustible) AS combustible_motor
        FROM vehiculos v
        LEFT JOIN motores m ON m.id = v.motor_id
        LEFT JOIN tipos_vehiculo t ON t.id = v.tipo_vehiculo_id
       WHERE v.modelo_id = $1
         AND ($2::int IS NULL OR $2 BETWEEN v.anio_desde AND coalesce(v.anio_hasta, v.anio_desde))
         AND ($3::int IS NULL OR v.generacion_id = $3)
       ORDER BY v.popularidad DESC, v.version`, [request.params.id, a ?? null, generacion ?? null]);
    return rows;
  });

  // Buscador de vehículos: "hilux 2018", "gol trend", "ranger 3.2"
  app.get('/vehiculos/buscar', {
    schema: { querystring: { type: 'object', required: ['q'], properties: { q: { type: 'string', minLength: 2, maxLength: 80 } } } },
  }, async (request) => {
    const texto = normalizarTexto(request.query.q);
    const anioActual = new Date().getFullYear() + 1;
    const anioBuscado = texto.split(' ').map(Number).find((n) => Number.isInteger(n) && n >= 1950 && n <= anioActual) || null;
    const sinAnio = texto.split(' ').filter((t) => t !== String(anioBuscado)).join(' ');
    const { rows } = await query(`
      SELECT mo.id AS modelo_id, mo.nombre AS modelo, ma.id AS marca_id, ma.nombre AS marca, ma.imagen, ma.logo, ma.logo_fondo,
             mo.anio_desde, mo.anio_hasta, mo.estado_mercado, t.nombre AS tipo,
             greatest(similarity(normalizar(ma.nombre || ' ' || mo.nombre), $1), similarity(normalizar(mo.nombre), $1)) AS similitud,
             (SELECT count(*) FROM vehiculos v WHERE v.modelo_id = mo.id
                AND ($2::int IS NULL OR $2 BETWEEN v.anio_desde AND coalesce(v.anio_hasta, v.anio_desde))) AS versiones
        FROM modelos_vehiculo mo
        JOIN marcas_vehiculo ma ON ma.id = mo.marca_id
        LEFT JOIN tipos_vehiculo t ON t.id = mo.tipo_vehiculo_id
       WHERE normalizar(ma.nombre || ' ' || mo.nombre) % $1 OR normalizar(mo.nombre) % $1
          OR normalizar(ma.nombre || ' ' || mo.nombre) LIKE '%' || $1 || '%'
       ORDER BY similitud DESC, mo.popularidad DESC
       LIMIT 12`, [sinAnio || texto, anioBuscado]);
    return { anio: anioBuscado, resultados: rows.filter((r) => !anioBuscado || r.versiones > 0) };
  });

  app.get('/vehiculos/:id', { schema: { params: { type: 'object', properties: { id } } } }, async (request) => {
    const vehiculo = await obtenerVehiculo(request.params.id);
    if (!vehiculo) throw new ErrorApi(404, 'No encontramos ese vehículo.');
    return vehiculo;
  });
}

export async function obtenerVehiculo(vehiculoId) {
  const { rows } = await query(`
    SELECT v.id, v.codigo, v.version, v.anio_desde, v.anio_hasta, v.carroceria, v.transmision, v.velocidades, v.traccion,
           v.combustible, v.pais_fabricacion, v.mercado, v.estado_mercado, v.segmento, v.carrocero,
           v.estado_verificacion, v.confianza, v.verificado_en, v.importado_en, v.fuente_url, v.datos_fuente,
           m.nombre AS motor,
           json_build_object('id', m.id, 'nombre', m.nombre, 'codigo', m.codigo, 'cilindrada_cc', m.cilindrada_cc,
                             'cilindros', m.cilindros, 'combustible', m.combustible, 'potencia_cv', m.potencia_cv,
                             'torque_nm', m.torque_nm, 'aspiracion', m.aspiracion, 'tiempos', m.tiempos,
                             'alimentacion', m.alimentacion) AS motor_ficha,
           CASE WHEN g.id IS NULL THEN NULL ELSE json_build_object('id', g.id, 'nombre', g.nombre, 'anio_desde', g.anio_desde, 'anio_hasta', g.anio_hasta) END AS generacion,
           json_build_object('id', t.id, 'slug', t.slug, 'nombre', t.nombre) AS tipo,
           json_build_object('id', mo.id, 'nombre', mo.nombre) AS modelo,
           json_build_object('id', ma.id, 'nombre', ma.nombre, 'slug', ma.slug, 'logo', ma.logo, 'logo_fondo', ma.logo_fondo) AS marca,
           CASE WHEN f.id IS NULL THEN NULL ELSE json_build_object('slug', f.slug, 'nombre', f.nombre, 'url', f.url, 'licencia', f.licencia, 'tipo', f.tipo, 'atribucion', f.atribucion) END AS fuente
      FROM vehiculos v
      JOIN modelos_vehiculo mo ON mo.id = v.modelo_id
      JOIN marcas_vehiculo ma ON ma.id = mo.marca_id
      LEFT JOIN motores m ON m.id = v.motor_id
      LEFT JOIN generaciones g ON g.id = v.generacion_id
      LEFT JOIN tipos_vehiculo t ON t.id = v.tipo_vehiculo_id
      LEFT JOIN fuentes f ON f.id = v.fuente_id
     WHERE v.id = $1`, [vehiculoId]);
  return rows[0] || null;
}

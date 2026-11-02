import { pool, query } from '../db.js';
import { ErrorApi } from '../errores.js';
import { id, paramsId, provincia } from '../esquemas.js';
import { SQL_IMAGEN_PRODUCTO, buscarProductos, detectarVehiculo, esCodigoDeRepuesto } from '../services/catalogo.js';
import { normalizarCodigo } from '../catalogo/normalizacion.js';
import { obtenerVehiculo } from './vehiculos.js';

const filtrosCatalogo = {
  type: 'object',
  properties: {
    q: { type: 'string', maxLength: 80 },
    categoria: { type: 'string', maxLength: 60 },
    marca: { type: 'string', maxLength: 300 },          // una o varias separadas por coma
    condicion: { type: 'string', enum: ['nuevo', 'usado'] },
    provincia,
    precio_min: { type: 'number', minimum: 0 },
    precio_max: { type: 'number', minimum: 0 },
    vehiculo: id,
    modelo: id,                                          // todas las versiones de un modelo (búsqueda sin versión)
    marca_vehiculo: id,                                  // todos los modelos de una marca ("pastillas Honda")
    anio: { type: 'integer', minimum: 1900, maximum: 2100 },
    vendedor: id,
    tipo_pieza: { type: 'string', enum: ['original', 'aftermarket', 'alternativo', 'generico', 'usado', 'reacondicionado'] },
    solo_verificados: { type: 'boolean' },
    sin_stock: { type: 'boolean' },                      // incluir publicaciones sin stock
    codigo: { type: 'string', maxLength: 60 },           // N° de parte, OEM, SKU, EAN/UPC o equivalencia
    rubro: { type: 'string', enum: ['autos', 'motos', 'general'] },
    detectar_vehiculo: { type: 'boolean', default: true },
    orden: { type: 'string', enum: ['relevancia', 'precio_asc', 'precio_desc', 'nombre'] },
    pagina: { type: 'integer', minimum: 1, maximum: 500 },
    por_pagina: { type: 'integer', minimum: 1, maximum: 60 },
  },
};

export default async function rutasCatalogo(app) {
  // Árbol de categorías con la cantidad de repuestos (de toda la rama) que tienen ofertas
  app.get('/categorias', {
    schema: { querystring: { type: 'object', properties: { vehiculo: id, destacadas: { type: 'boolean' } } } },
  }, async (request) => {
    const { vehiculo, destacadas } = request.query;
    const { rows } = await query(`
      WITH RECURSIVE con_ofertas AS (
        SELECT p.categoria_id, p.id FROM productos p
         WHERE EXISTS (SELECT 1 FROM publicaciones pu WHERE pu.producto_id = p.id AND pu.estado = 'activa' AND pu.stock > 0)
           AND ($1::int IS NULL
                OR (p.universal AND (SELECT c.rubro FROM categorias c WHERE c.id = p.categoria_id) IN ('general',
                      (SELECT CASE WHEN mo.segmento = 'moto' THEN 'motos' ELSE 'autos' END
                         FROM vehiculos v JOIN modelos_vehiculo mo ON mo.id = v.modelo_id WHERE v.id = $1)))
                OR EXISTS (
                 SELECT 1 FROM compatibilidades co WHERE co.producto_id = p.id AND co.vehiculo_id = $1
                    AND co.estado_verificacion <> 'DISCONTINUED'))
      ),
      ramas AS (
        SELECT id, id AS raiz FROM categorias
        UNION ALL SELECT c.id, r.raiz FROM categorias c JOIN ramas r ON c.padre_id = r.id
      )
      SELECT c.id, c.nombre, c.slug, c.descripcion, c.imagen, c.padre_id, c.nivel, c.destacada, c.orden, c.rubro,
             count(DISTINCT co.id) AS cantidad
        FROM categorias c
        JOIN ramas r ON r.raiz = c.id
        LEFT JOIN con_ofertas co ON co.categoria_id = r.id
       WHERE ($2::boolean IS NOT TRUE OR c.destacada)
       GROUP BY c.id ORDER BY c.orden`, [vehiculo ?? null, destacadas ?? null]);
    return rows;
  });

  app.get('/productos', { schema: { querystring: filtrosCatalogo } }, async (request) => {
    const f = { ...request.query };
    if (f.precio_min != null && f.precio_max != null && f.precio_min > f.precio_max) {
      throw new ErrorApi(400, 'El precio mínimo no puede ser mayor que el precio máximo.');
    }
    // "pastillas hilux 2018" / "cadena KTM 300 EXC": se detecta el modelo en el texto ("pastillas Honda": solo la marca).
    // Si nombra el mismo modelo (o la misma marca) del vehículo elegido se usa la versión exacta; si nombra otro,
    // manda el texto (y se avisa que no se filtró por el vehículo elegido).
    let vehiculoDetectado = null;
    const original = { ...f };
    if (f.q && f.detectar_vehiculo !== false && !f.modelo && !f.marca_vehiculo && !(await esCodigoDeRepuesto(pool, f.q))) {
      const detectado = await detectarVehiculo(pool, f.q);
      if (detectado) {
        const { rows: [elegido] } = f.vehiculo
          ? await query(`SELECT v.modelo_id, mo.marca_id FROM vehiculos v JOIN modelos_vehiculo mo ON mo.id = v.modelo_id
                          WHERE v.id = $1`, [f.vehiculo]) : { rows: [] };
        const mismo = detectado.modelo_id ? elegido?.modelo_id === detectado.modelo_id : elegido?.marca_id === detectado.marca_id;
        if (mismo) {
          f.q = detectado.texto_restante || undefined;
        } else {
          vehiculoDetectado = { ...detectado, reemplaza_vehiculo: Boolean(f.vehiculo) };
          delete f.vehiculo;
          if (detectado.modelo_id) f.modelo = detectado.modelo_id;
          else f.marca_vehiculo = detectado.marca_id;
          f.anio = detectado.anio || f.anio;
          f.q = detectado.texto_restante || undefined;
        }
      }
    }
    // ?modelo= o ?marca_vehiculo= elegidos (ej. "Ver repuestos" de una moto): nombre para mostrarlo en la página
    let filtroVehiculo = null;
    if (!vehiculoDetectado && (f.modelo || f.marca_vehiculo)) {
      const { rows: [fv] } = f.modelo
        ? await query(`SELECT mo.id AS modelo_id, mo.nombre AS modelo, mo.segmento, ma.id AS marca_id, ma.nombre AS marca
                         FROM modelos_vehiculo mo JOIN marcas_vehiculo ma ON ma.id = mo.marca_id WHERE mo.id = $1`, [f.modelo])
        : await query('SELECT NULL AS modelo_id, NULL AS modelo, segmento, id AS marca_id, nombre AS marca FROM marcas_vehiculo WHERE id = $1', [f.marca_vehiculo]);
      if (fv) filtroVehiculo = { ...fv, anio: f.anio ?? null };
    }
    const marcas = f.marca ? f.marca.split(',').map((m) => m.trim()).filter(Boolean) : [];
    let resultado = await buscarProductos(pool, { ...f, marcas });
    // "filtro de aceite gol": si el vehículo detectado no tiene nada, se busca el texto tal cual (el repuesto puede estar
    // cargado para otro modelo con un nombre parecido, como el Gol Trend) y se avisa
    let vehiculoSinResultados = null;
    if (vehiculoDetectado && resultado.total === 0) {
      const literal = await buscarProductos(pool, { ...original, marcas });
      if (literal.total > 0) {
        vehiculoSinResultados = vehiculoDetectado;
        vehiculoDetectado = null;
        resultado = literal;
      }
    }
    return {
      ...resultado, vehiculo_detectado: vehiculoDetectado, filtro_vehiculo: filtroVehiculo,
      vehiculo_sin_resultados: vehiculoSinResultados,
    };
  });

  app.get('/productos/:id', {
    schema: { params: paramsId, querystring: { type: 'object', properties: { vehiculo: id } } },
  }, async (request) => {
    const productoId = request.params.id;
    const { vehiculo: vehiculoId } = request.query;

    const { rows: [producto] } = await query(`
      SELECT p.id, p.nombre, mr.nombre AS marca, p.numero_pieza, p.sku, p.ean, p.upc, p.codigo_aftermarket, p.tipo_pieza,
             p.descripcion, p.imagen, p.universal, p.especificaciones, p.estado_verificacion, p.confianza,
             p.verificado_en, p.importado_en, p.actualizado_en, p.fuente_url,
             json_build_object('id', c.id, 'nombre', c.nombre, 'slug', c.slug, 'rubro', c.rubro) AS categoria,
             CASE WHEN f.id IS NULL THEN NULL ELSE json_build_object('nombre', f.nombre, 'tipo', f.tipo, 'url', f.url) END AS fuente,
             (WITH RECURSIVE ruta AS (
                SELECT id, padre_id, nombre, slug, 0 AS n FROM categorias WHERE id = p.categoria_id
                UNION ALL SELECT x.id, x.padre_id, x.nombre, x.slug, r.n + 1 FROM categorias x JOIN ruta r ON x.id = r.padre_id)
              SELECT json_agg(json_build_object('nombre', nombre, 'slug', slug) ORDER BY n DESC) FROM ruta) AS ruta_categoria
        FROM productos p
        JOIN categorias c ON c.id = p.categoria_id
        JOIN marcas_repuesto mr ON mr.id = p.marca_repuesto_id
        LEFT JOIN fuentes f ON f.id = p.fuente_id
       WHERE p.id = $1`, [productoId]);
    if (!producto) throw new ErrorApi(404, 'No encontramos ese repuesto.');

    const [compatibles, ofertas, oem, equivalencias, imagenes] = await Promise.all([
      query(`
        SELECT ma.nombre AS marca, mo.nombre AS modelo, v.id, v.version, v.anio_desde, v.anio_hasta,
               m.nombre AS motor, co.estado_verificacion, co.posicion,
               co.anio_desde AS compat_anio_desde, co.anio_hasta AS compat_anio_hasta
          FROM compatibilidades co
          JOIN vehiculos v ON v.id = co.vehiculo_id
          JOIN modelos_vehiculo mo ON mo.id = v.modelo_id
          JOIN marcas_vehiculo ma ON ma.id = mo.marca_id
          LEFT JOIN motores m ON m.id = v.motor_id
         WHERE co.producto_id = $1 AND co.estado_verificacion <> 'DISCONTINUED'
         ORDER BY ma.nombre, mo.nombre, v.anio_desde, v.version`, [productoId]),
      query(`
        SELECT pu.id AS publicacion_id, pu.precio, pu.stock, pu.condicion, pu.descripcion,
               (SELECT coalesce(json_agg(json_build_object('id', pf.id, 'url', 'api/archivos/' || pf.archivo_id) ORDER BY pf.orden, pf.id), '[]')
                  FROM publicacion_fotos pf WHERE pf.publicacion_id = pu.id) AS fotos,
               json_build_object('id', ve.id, 'slug', ve.slug, 'nombre_comercial', ve.nombre_comercial,
                                 'ciudad', ve.ciudad, 'provincia', ve.provincia, 'logo', ve.logo,
                                 'es_desarmadero', ve.es_desarmadero) AS vendedor
          FROM publicaciones pu JOIN vendedores ve ON ve.id = pu.vendedor_id
         WHERE pu.producto_id = $1 AND pu.estado = 'activa'
         ORDER BY (pu.stock > 0) DESC, pu.precio ASC`, [productoId]),
      query(`
        SELECT ma.nombre AS marca, o.numero_oem, o.estado_verificacion
          FROM oem_productos o JOIN marcas_vehiculo ma ON ma.id = o.marca_vehiculo_id
         WHERE o.producto_id = $1 ORDER BY ma.nombre, o.numero_oem`, [productoId]),
      query(`
        SELECT mr.nombre AS marca, e.numero_pieza, e.tipo, e.estado_verificacion, e.producto_equivalente_id
          FROM equivalencias e JOIN marcas_repuesto mr ON mr.id = e.marca_repuesto_id
         WHERE e.producto_id = $1
        UNION
        SELECT mr.nombre, p.numero_pieza, 'equivalente', e.estado_verificacion, p.id
          FROM equivalencias e JOIN productos p ON p.id = e.producto_id
          JOIN marcas_repuesto mr ON mr.id = p.marca_repuesto_id
         WHERE e.producto_equivalente_id = $1
         ORDER BY 1, 2`, [productoId]),
      // Fotos reales del repuesto (principal, packaging, frontal...), con su origen y licencia
      query(`
        SELECT i.id, i.tipo, i.principal, i.archivo, i.url_imagen, i.url_origen, i.autor, i.licencia, i.licencia_url,
               i.permiso, i.estado, f.nombre AS fuente
          FROM imagenes i LEFT JOIN fuentes f ON f.id = i.fuente_id
         WHERE i.entidad = 'producto' AND i.registro_id = $1 AND i.estado <> 'IMAGE_MISSING'
           AND i.permiso IN ('libre', 'autorizado')
         ORDER BY i.principal DESC, i.tipo, i.id`, [productoId]),
    ]);

    // Versiones compatibles agrupadas por marca y modelo
    const grupos = new Map();
    for (const v of compatibles.rows) {
      const clave = `${v.marca}|${v.modelo}`;
      if (!grupos.has(clave)) grupos.set(clave, { marca: v.marca, modelo: v.modelo, versiones: [] });
      grupos.get(clave).versiones.push({
        id: v.id, version: v.version, motor: v.motor, anio_desde: v.anio_desde, anio_hasta: v.anio_hasta,
        estado_verificacion: v.estado_verificacion, posicion: v.posicion,
        // Si la pieza sirve solo para algunos años de la versión
        compat_anio_desde: v.compat_anio_desde, compat_anio_hasta: v.compat_anio_hasta,
      });
    }
    const resumenEstados = {};
    for (const v of compatibles.rows) resumenEstados[v.estado_verificacion] = (resumenEstados[v.estado_verificacion] || 0) + 1;

    let compatibilidad = null;
    if (vehiculoId) {
      const vehiculo = await obtenerVehiculo(vehiculoId);
      if (vehiculo) {
        const rel = compatibles.rows.find((v) => v.id === vehiculoId);
        // Una compatibilidad solo se presenta como confirmada si está VERIFIED:
        //   universal · compatible (verificada) · sin_verificar (cargada pero no confirmada) · no_compatible (sin datos)
        let estado = 'no_compatible';
        if (producto.universal) estado = 'universal';
        else if (rel) estado = rel.estado_verificacion === 'VERIFIED' ? 'compatible' : 'sin_verificar';
        compatibilidad = {
          vehiculo,
          estado,
          compatible: producto.universal || Boolean(rel),
          confirmada: producto.universal || rel?.estado_verificacion === 'VERIFIED',
          verificacion: producto.universal ? producto.estado_verificacion : rel?.estado_verificacion ?? null,
        };
      }
    }

    const { rows: relacionados } = await query(`
      SELECT p.id, p.nombre, mr.nombre AS marca, p.numero_pieza, p.sku, ${SQL_IMAGEN_PRODUCTO} AS imagen, p.universal, p.estado_verificacion,
             min(pu.precio) AS precio_desde, count(pu.id) AS ofertas
        FROM productos p
        JOIN marcas_repuesto mr ON mr.id = p.marca_repuesto_id
        JOIN publicaciones pu ON pu.producto_id = p.id AND pu.estado = 'activa' AND pu.stock > 0
       WHERE p.categoria_id = $1 AND p.id <> $2
         AND ($3::int IS NULL OR p.universal OR EXISTS (
               SELECT 1 FROM compatibilidades co WHERE co.producto_id = p.id AND co.vehiculo_id = $3))
       GROUP BY p.id, mr.id
       ORDER BY p.universal, count(pu.id) DESC, p.id
       LIMIT 4`, [producto.categoria.id, productoId, vehiculoId ?? null]);

    // Sin foto real del repuesto: IMAGE_MISSING (no se reemplaza por una pieza parecida)
    // Fotos de los vendedores (de sus publicaciones activas), después de las del catálogo
    const fotosVendedores = ofertas.rows.flatMap((o) => o.fotos.map((f) => ({
      id: `v${f.id}`, tipo: 'principal', archivo: f.url, autor: o.vendedor.nombre_comercial, de_vendedor: true,
    })));
    imagenes.rows.push(...fotosVendedores);
    const imagenEstado = imagenes.rows.length || producto.imagen ? 'OK' : 'IMAGE_MISSING';
    return {
      producto: { ...producto, imagenes: imagenes.rows, imagen_estado: imagenEstado },
      compatibilidad,
      vehiculos_compatibles: [...grupos.values()],
      total_versiones_compatibles: compatibles.rows.length,
      compatibilidades_por_estado: resumenEstados,
      oem: oem.rows,
      equivalencias: equivalencias.rows,
      ofertas: ofertas.rows,
      relacionados,
    };
  });

  // Marcas de repuestos y qué fabrica cada una (líneas de producto, no productos).
  // ?rubro=motos: las que hacen repuestos para motos · ?categoria=slug: solo las que fabrican algo de esa rama.
  app.get('/marcas-repuesto', {
    schema: {
      querystring: {
        type: 'object',
        properties: { rubro: { type: 'string', enum: ['autos', 'motos', 'general'] }, categoria: { type: 'string', maxLength: 80 } },
      },
    },
  }, async (request) => {
    const { rubro, categoria } = request.query;
    const { rows } = await query(`
      WITH RECURSIVE rama AS (
        SELECT id FROM categorias WHERE slug = $2
        UNION ALL SELECT c.id FROM categorias c JOIN rama r ON c.padre_id = r.id)
      SELECT mr.id, mr.nombre, mr.slug, mr.logo, mr.logo_fondo, mr.para_autos, mr.para_motos,
             (SELECT count(DISTINCT p.id) FROM productos p JOIN publicaciones pu ON pu.producto_id = p.id AND pu.estado = 'activa'
               WHERE p.marca_repuesto_id = mr.id) AS productos,
             coalesce(json_agg(json_build_object('nombre', l.nombre,
                        'categoria', CASE WHEN c.id IS NULL THEN NULL ELSE json_build_object('nombre', c.nombre, 'slug', c.slug) END)
                      ORDER BY l.orden, l.id) FILTER (WHERE l.id IS NOT NULL), '[]'::json) AS lineas
        FROM marcas_repuesto mr
        LEFT JOIN marca_repuesto_lineas l ON l.marca_repuesto_id = mr.id AND l.estado_verificacion <> 'DISCONTINUED'
             AND ($2::text IS NULL OR l.categoria_id IN (SELECT id FROM rama))
        LEFT JOIN categorias c ON c.id = l.categoria_id
       WHERE $1::text IS NULL OR ($1 = 'motos' AND mr.para_motos) OR ($1 = 'autos' AND mr.para_autos) OR $1 = 'general'
       GROUP BY mr.id
      HAVING $2::text IS NULL OR count(l.id) > 0
       ORDER BY mr.nombre`, [rubro ?? null, categoria ?? null]);
    return rows;
  });

  // Búsqueda por número de pieza, OEM o equivalencia: "Toyota 04465-0K240", "Bosch 0986494133"
  app.get('/buscar/codigo', {
    schema: { querystring: { type: 'object', required: ['q'], properties: { q: { type: 'string', minLength: 3, maxLength: 80 } } } },
  }, async (request) => {
    const partes = request.query.q.trim().split(/\s+/);
    // "Toyota 04465..." -> la primera palabra afina por marca; "0 986 494 133" -> todo es el código
    const intentos = [];
    if (partes.length > 1 && /[A-Za-zÀ-ÿ]/.test(partes[0])) intentos.push({ marca: partes[0], codigo: normalizarCodigo(partes.slice(1).join('')) });
    intentos.push({ marca: null, codigo: normalizarCodigo(partes.join('')) });
    for (const intento of intentos) {
      if (intento.codigo.length < 3) continue;
      const rows = await buscarPorCodigo(intento.codigo, intento.marca);
      if (rows.length || intento === intentos[intentos.length - 1]) return { codigo: intento.codigo, marca: intento.marca, resultados: rows };
    }
    throw new ErrorApi(400, 'Escribí al menos 3 letras o números del código.');
  });
}

async function buscarPorCodigo(codigo, posibleMarca) {
  const { rows } = await query(`
      WITH coincidencias AS (
        SELECT p.id, 'numero_pieza' AS tipo, mr.nombre AS marca_coincidencia, p.numero_pieza AS codigo, p.estado_verificacion
          FROM productos p JOIN marcas_repuesto mr ON mr.id = p.marca_repuesto_id
         WHERE p.numero_normalizado = $1 OR normalizar_codigo(p.sku) = $1
        UNION ALL
        SELECT o.producto_id, 'oem', ma.nombre, o.numero_oem, o.estado_verificacion
          FROM oem_productos o JOIN marcas_vehiculo ma ON ma.id = o.marca_vehiculo_id
         WHERE o.numero_normalizado = $1
        UNION ALL
        SELECT e.producto_id, 'equivalencia', mr.nombre, e.numero_pieza, e.estado_verificacion
          FROM equivalencias e JOIN marcas_repuesto mr ON mr.id = e.marca_repuesto_id
         WHERE e.numero_normalizado = $1
      )
      SELECT c.tipo, c.marca_coincidencia, c.codigo, c.estado_verificacion,
             p.id, p.nombre, mr.nombre AS marca, p.numero_pieza, p.sku, ${SQL_IMAGEN_PRODUCTO} AS imagen,
             (SELECT min(precio) FROM publicaciones pu WHERE pu.producto_id = p.id AND pu.estado = 'activa' AND pu.stock > 0) AS precio_desde
        FROM coincidencias c
        JOIN productos p ON p.id = c.id
        JOIN marcas_repuesto mr ON mr.id = p.marca_repuesto_id
       WHERE $2::text IS NULL OR normalizar(c.marca_coincidencia) = normalizar($2) OR normalizar(mr.nombre) = normalizar($2)
       ORDER BY (c.estado_verificacion = 'VERIFIED') DESC, c.tipo`, [codigo, posibleMarca]);
  return rows;
}

// Consulta del catálogo con filtros y facetas (v2: categorías en árbol, OEM/equivalencias, verificación).
//
// Un producto aparece si tiene al menos una publicación activa con stock que cumpla los filtros de oferta
// (condición, provincia, precio, vendedor). Los filtros de producto (búsqueda, categoría con sus subcategorías,
// marca, vehículo / modelo / año) se aplican sobre el producto. Las facetas usan todos los filtros salvo el propio.
// Las compatibilidades DISCONTINUED no cuentan; con solo_verificados=1 solo cuentan las VERIFIED.

import { normalizarCodigo, normalizarTexto } from '../catalogo/normalizacion.js';

/**
 * Imagen de un repuesto (alias p) en los listados: si no tiene foto o solo tiene la ilustración de su categoría, se muestra
 * la primera foto que subió un vendedor en una publicación activa (la de la oferta más barata).
 */
export const SQL_IMAGEN_PRODUCTO = `CASE WHEN p.imagen IS NULL OR p.imagen = (SELECT ci.imagen FROM categorias ci WHERE ci.id = p.categoria_id)
  THEN coalesce((SELECT 'api/archivos/' || pf.archivo_id FROM publicacion_fotos pf
                   JOIN publicaciones fpu ON fpu.id = pf.publicacion_id
                  WHERE fpu.producto_id = p.id AND fpu.estado = 'activa'
                  ORDER BY fpu.precio, pf.orden, pf.id LIMIT 1), p.imagen)
  ELSE p.imagen END`;

const escaparLike = (texto) => texto.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Singular aproximado para que "amortiguadores" encuentre "Amortiguador". */
function raiz(palabra) {
  if (palabra.length > 5 && palabra.endsWith('es')) return palabra.slice(0, -2);
  if (palabra.length > 4 && palabra.endsWith('s')) return palabra.slice(0, -1);
  return palabra;
}

function filtroCompat(p, filtros) {
  const estado = filtros.solo_verificados ? "AND co.estado_verificacion = 'VERIFIED'" : "AND co.estado_verificacion <> 'DISCONTINUED'";
  // Una compatibilidad puede valer solo para algunos años de la versión (co.anio_desde/anio_hasta)
  const anioCompat = filtros.anio
    ? `AND (co.anio_desde IS NULL OR ${p(filtros.anio)}::int >= co.anio_desde) AND (co.anio_hasta IS NULL OR ${p(filtros.anio)}::int <= co.anio_hasta)`
    : '';
  // Un repuesto universal de autos (líquido de frenos, lámparas) no le sirve a una moto, ni uno de motos a un auto:
  // vale si su rubro es "general" o el del vehículo
  const universal = (segmentoSql) => `(p.universal AND (c.rubro = 'general'
    OR c.rubro = (SELECT CASE WHEN ${segmentoSql} = 'moto' THEN 'motos' ELSE 'autos' END)))`;
  if (filtros.vehiculo) {
    const id = p(filtros.vehiculo);
    return `(${universal(`(SELECT mo.segmento FROM vehiculos v JOIN modelos_vehiculo mo ON mo.id = v.modelo_id WHERE v.id = ${id})`)}
              OR EXISTS (SELECT 1 FROM compatibilidades co
              WHERE co.producto_id = p.id AND co.vehiculo_id = ${id} ${anioCompat} ${estado}))`;
  }
  if (filtros.modelo) {
    const id = p(filtros.modelo);
    const anio = filtros.anio ? `AND ${p(filtros.anio)}::int BETWEEN v.anio_desde AND coalesce(v.anio_hasta, v.anio_desde)` : '';
    return `(${universal(`(SELECT segmento FROM modelos_vehiculo WHERE id = ${id})`)}
              OR EXISTS (SELECT 1 FROM compatibilidades co JOIN vehiculos v ON v.id = co.vehiculo_id
              WHERE co.producto_id = p.id AND v.modelo_id = ${id} ${anio} ${anioCompat} ${estado}))`;
  }
  // "pastillas Honda": compatibles con alguna versión de esa marca
  if (filtros.marca_vehiculo) {
    const anio = filtros.anio ? `AND ${p(filtros.anio)}::int BETWEEN v.anio_desde AND coalesce(v.anio_hasta, v.anio_desde)` : '';
    return `(p.universal OR EXISTS (SELECT 1 FROM compatibilidades co JOIN vehiculos v ON v.id = co.vehiculo_id
              JOIN modelos_vehiculo mo ON mo.id = v.modelo_id
              WHERE co.producto_id = p.id AND mo.marca_id = ${p(filtros.marca_vehiculo)} ${anio} ${anioCompat} ${estado}))`;
  }
  return null;
}

export function construirConsulta(filtros, excluir = new Set()) {
  const params = [];
  const p = (valor) => {
    params.push(valor);
    return `$${params.length}`;
  };

  // Por defecto solo ofertas con stock; con sin_stock=true también las agotadas
  const ofertas = ["pu.estado = 'activa'"];
  if (!filtros.sin_stock) ofertas.push('pu.stock > 0');
  if (filtros.condicion && !excluir.has('condicion')) ofertas.push(`pu.condicion = ${p(filtros.condicion)}`);
  if (filtros.provincia && !excluir.has('provincia')) ofertas.push(`ve.provincia = ${p(filtros.provincia)}`);
  if (filtros.precio_min != null && !excluir.has('precio')) ofertas.push(`pu.precio >= ${p(filtros.precio_min)}`);
  if (filtros.precio_max != null && !excluir.has('precio')) ofertas.push(`pu.precio <= ${p(filtros.precio_max)}`);
  if (filtros.vendedor) ofertas.push(`pu.vendedor_id = ${p(filtros.vendedor)}`);

  const productos = [];
  let subarbol = '';
  if (filtros.categoria && !excluir.has('categoria')) {
    subarbol = `, subarbol AS (
        SELECT id FROM categorias WHERE slug = ${p(filtros.categoria)}
        UNION ALL SELECT c.id FROM categorias c JOIN subarbol s ON c.padre_id = s.id)`;
    productos.push('p.categoria_id IN (SELECT id FROM subarbol)');
  }
  if (filtros.marcas?.length && !excluir.has('marca')) productos.push(`mr.nombre = ANY(${p(filtros.marcas)}::text[])`);
  if (filtros.tipo_pieza) productos.push(`p.tipo_pieza = ${p(filtros.tipo_pieza)}`);
  if (filtros.rubro) productos.push(`c.rubro = ${p(filtros.rubro)}`);
  // Número de parte, SKU, EAN, OEM o equivalencia (normalizado: "0 986-494" = "0986494")
  if (filtros.codigo && normalizarCodigo(filtros.codigo).length >= 3) {
    const like = p(`%${normalizarCodigo(filtros.codigo)}%`);
    productos.push(`(p.numero_normalizado LIKE ${like} OR normalizar_codigo(p.sku) LIKE ${like}
      OR normalizar_codigo(coalesce(p.ean, '') || ' ' || coalesce(p.upc, '')) LIKE ${like}
      OR EXISTS (SELECT 1 FROM oem_productos o WHERE o.producto_id = p.id AND o.numero_normalizado LIKE ${like})
      OR EXISTS (SELECT 1 FROM equivalencias e WHERE e.producto_id = p.id AND e.numero_normalizado LIKE ${like}))`);
  }
  const compat = filtroCompat(p, filtros);
  if (compat) productos.push(compat);
  if (filtros.q) {
    const palabras = normalizarTexto(filtros.q).split(/\s+/).filter(Boolean).slice(0, 8).map(raiz);
    const porTexto = palabras.map((w) =>
      `normalizar(p.nombre || ' ' || mr.nombre || ' ' || c.nombre || ' ' || p.numero_pieza || ' ' || p.sku) LIKE ${p(`%${escaparLike(w)}%`)}`);
    const codigo = normalizarCodigo(filtros.q);
    let condicion = porTexto.length ? `(${porTexto.join(' AND ')})` : 'true';
    if (codigo.length >= 3) {
      const like = p(`%${codigo}%`);
      condicion = `(${condicion} OR p.numero_normalizado LIKE ${like} OR normalizar_codigo(p.sku) LIKE ${like}
        OR EXISTS (SELECT 1 FROM oem_productos o WHERE o.producto_id = p.id AND o.numero_normalizado LIKE ${like})
        OR EXISTS (SELECT 1 FROM equivalencias e WHERE e.producto_id = p.id AND e.numero_normalizado LIKE ${like}))`;
    }
    productos.push(condicion);
  }

  const cte = `WITH RECURSIVE ofertas AS (
      SELECT pu.id, pu.producto_id, pu.precio, pu.stock, pu.condicion, pu.vendedor_id, ve.provincia
        FROM publicaciones pu JOIN vendedores ve ON ve.id = pu.vendedor_id
       WHERE ${ofertas.join(' AND ')})${subarbol}`;
  const desde = `FROM productos p
      JOIN categorias c ON c.id = p.categoria_id
      JOIN marcas_repuesto mr ON mr.id = p.marca_repuesto_id
      JOIN ofertas o ON o.producto_id = p.id
      ${productos.length ? `WHERE ${productos.join(' AND ')}` : ''}`;
  return { cte, desde, params, p };
}

const ORDENES = {
  precio_asc: 'precio_desde ASC, p.id',
  precio_desc: 'precio_desde DESC, p.id',
  relevancia: 'p.universal ASC, count(o.id) DESC, p.nombre, p.id',
  nombre: 'p.nombre, p.id',
};

/** Categoría actual, su ruta (ancestros) y las opciones para seguir bajando (hijas, o hermanas si es hoja). */
async function contextoCategoria(db, slug) {
  if (!slug) return { actual: null, ruta: [], padreFacetas: null };
  const { rows } = await db.query(`
    WITH RECURSIVE ruta AS (
      SELECT id, padre_id, nombre, slug, rubro, 0 AS profundidad FROM categorias WHERE slug = $1
      UNION ALL SELECT c.id, c.padre_id, c.nombre, c.slug, c.rubro, r.profundidad + 1 FROM categorias c JOIN ruta r ON c.id = r.padre_id)
    SELECT id, padre_id, nombre, slug, rubro FROM ruta ORDER BY profundidad DESC`, [slug]);
  if (!rows.length) return { actual: null, ruta: [], padreFacetas: null };
  const actual = rows[rows.length - 1];
  const { rowCount: tieneHijas } = await db.query('SELECT 1 FROM categorias WHERE padre_id = $1 LIMIT 1', [actual.id]);
  return { actual, ruta: rows, padreFacetas: tieneHijas ? actual.id : actual.padre_id };
}

export async function buscarProductos(db, filtros) {
  const porPagina = filtros.por_pagina || 24;
  const pagina = filtros.pagina || 1;
  const { cte, desde, params, p } = construirConsulta(filtros);
  const orden = ORDENES[filtros.orden] || ORDENES.relevancia;
  const estadoCompat = filtros.vehiculo
    ? `(SELECT co.estado_verificacion FROM compatibilidades co WHERE co.producto_id = p.id AND co.vehiculo_id = ${p(filtros.vehiculo)})`
    : 'NULL';

  const sqlProductos = `${cte}
    SELECT p.id, p.nombre, mr.nombre AS marca, p.numero_pieza, p.sku, ${SQL_IMAGEN_PRODUCTO} AS imagen, p.universal, p.tipo_pieza,
           p.estado_verificacion, c.nombre AS categoria, c.slug AS categoria_slug,
           ${estadoCompat} AS compat_estado,
           min(o.precio) AS precio_desde, max(o.precio) AS precio_hasta,
           count(o.id) AS ofertas, sum(o.stock) AS stock_total,
           bool_or(o.condicion = 'nuevo') AS hay_nuevo, bool_or(o.condicion = 'usado') AS hay_usado,
           count(*) OVER () AS total
      ${desde}
     GROUP BY p.id, c.id, mr.id
     ORDER BY ${orden}
     LIMIT ${p(porPagina)} OFFSET ${p((pagina - 1) * porPagina)}`;

  const contexto = await contextoCategoria(db, filtros.categoria);

  const faceta = (excluir, seleccion, agrupar, ordenar) => {
    const q = construirConsulta(filtros, new Set([excluir]));
    return db.query(`${q.cte} SELECT ${seleccion} ${q.desde} ${agrupar} ${ordenar}`, q.params);
  };
  const facetaCategorias = () => {
    const q = construirConsulta(filtros, new Set(['categoria']));
    const padre = q.p(contexto.padreFacetas);
    return db.query(`${q.cte}, base AS (SELECT DISTINCT p.id, p.categoria_id ${q.desde}),
      ramas AS (
        SELECT id, id AS raiz FROM categorias WHERE padre_id IS NOT DISTINCT FROM ${padre}::int
        UNION ALL SELECT c.id, r.raiz FROM categorias c JOIN ramas r ON c.padre_id = r.id)
      SELECT cat.id, cat.nombre, cat.slug, count(DISTINCT base.id) AS cantidad
        FROM ramas JOIN base ON base.categoria_id = ramas.id JOIN categorias cat ON cat.id = ramas.raiz
       GROUP BY cat.id ORDER BY cat.orden`, q.params);
  };

  const [productos, categorias, marcas, provincias, condiciones, precio] = await Promise.all([
    db.query(sqlProductos, params),
    facetaCategorias(),
    faceta('marca', 'mr.nombre AS marca, count(DISTINCT p.id) AS cantidad', 'GROUP BY mr.nombre', 'ORDER BY mr.nombre'),
    faceta('provincia', 'o.provincia, count(DISTINCT p.id) AS cantidad', 'GROUP BY o.provincia', 'ORDER BY o.provincia'),
    faceta('condicion', 'o.condicion, count(DISTINCT p.id) AS cantidad', 'GROUP BY o.condicion', 'ORDER BY o.condicion'),
    faceta('precio', 'min(o.precio) AS min, max(o.precio) AS max', '', ''),
  ]);

  let total = productos.rows[0]?.total ?? 0;
  if (!productos.rows.length && pagina > 1) {
    const q = construirConsulta(filtros);
    total = (await db.query(`${q.cte} SELECT count(DISTINCT p.id) AS total ${q.desde}`, q.params)).rows[0].total;
  }
  return {
    productos: productos.rows.map(({ total: _t, ...resto }) => resto),
    total,
    pagina,
    por_pagina: porPagina,
    paginas: Math.max(1, Math.ceil(total / porPagina)),
    categoria: contexto.actual ? { ...contexto.actual, ruta: contexto.ruta.map(({ nombre, slug }) => ({ nombre, slug })) } : null,
    facetas: {
      categorias: categorias.rows,
      marcas: marcas.rows,
      provincias: provincias.rows,
      condiciones: condiciones.rows,
      precio: precio.rows[0] || { min: null, max: null },
    },
  };
}

// ---------------------------------------------------------------- vehículo dentro del texto ("pastillas hilux 2018")

/**
 * El texto es el código exacto de un repuesto (número de pieza, SKU, OEM o equivalencia): "WG-FA-688" no tiene que
 * leerse como el camión DAF FA. Solo cuenta si el código existe, así "MT-03" sigue siendo una moto.
 */
export async function esCodigoDeRepuesto(db, q) {
  const codigo = normalizarCodigo(q);
  if (codigo.length < 4 || !/\d/.test(codigo) || !/[A-Z]/.test(codigo)) return false;
  const { rows: [r] } = await db.query(`
    SELECT EXISTS (SELECT 1 FROM productos WHERE numero_normalizado = $1 OR normalizar_codigo(sku) = $1)
        OR EXISTS (SELECT 1 FROM oem_productos WHERE numero_normalizado = $1)
        OR EXISTS (SELECT 1 FROM equivalencias WHERE numero_normalizado = $1) AS existe`, [codigo]);
  return r.existe;
}

// Misma normalización que normalizarTexto() de JS ("MT-03" -> "mt 03")
const CLAVE_SQL = (columna) => `trim(regexp_replace(normalizar(${columna}), '[^a-z0-9.+]+', ' ', 'g'))`;

/**
 * Un modelo de moto con nombre genérico ("Sport", "Classic", "R1", "H2") solo cuenta si también se escribió la marca:
 * así "lámpara H4" o "kit sport" no se confunden con una moto. Los de autos se detectan como siempre.
 */
const modeloAceptable = (m) => m.con_marca || m.segmento !== 'moto'
  || (/\d/.test(m.clave) && m.clave.replace(/ /g, '').length >= 4) || (m.clave.includes(' ') && m.clave.length >= 5);

/**
 * Busca un modelo (y un año) mencionado en la búsqueda: "pastillas hilux 2018", "Honda CRF250R", "cadena KTM 300 EXC",
 * "crf 250 r". Si no hay modelo pero sí una marca de vehículo ("pastillas Honda") devuelve solo la marca
 * (modelo_id null). Devuelve también el texto restante, o null si no encontró nada. Con varias coincidencias
 * prefiere el modelo cuya marca también se escribió, el nombre más largo y el más popular.
 */
export async function detectarVehiculo(db, q) {
  const tokens = normalizarTexto(q).split(' ').filter(Boolean);
  if (!tokens.length) return null;
  const anioActual = new Date().getFullYear() + 1;
  const anio = tokens.map(Number).find((n) => Number.isInteger(n) && n >= 1950 && n <= anioActual) || null;
  const candidatos = new Set();
  for (let i = 0; i < tokens.length; i++) {
    for (let n = 1; n <= 3 && i + n <= tokens.length; n++) candidatos.add(tokens.slice(i, i + n).join(' '));
  }
  const lista = [...candidatos].filter((c) => c.length >= 2 && !/^\d+$/.test(c));
  if (!lista.length) return null;
  // "crf 250 r" o "mt03": se comparan también sin espacios (solo si tienen números, para no unir palabras sueltas)
  const compactos = [...new Set([...candidatos].map((c) => c.replace(/ /g, '')))]
    .filter((c) => c.length >= 4 && /\d/.test(c) && /[a-z]/.test(c));
  const { rows } = await db.query(`
    SELECT * FROM (
      SELECT mo.id, mo.nombre AS modelo, mo.segmento, ma.nombre AS marca, ma.id AS marca_id, mo.popularidad,
             ${CLAVE_SQL('mo.nombre')} AS clave, ${CLAVE_SQL('ma.nombre')} AS clave_marca
        FROM modelos_vehiculo mo JOIN marcas_vehiculo ma ON ma.id = mo.marca_id) m
     WHERE clave = ANY($1::text[]) OR replace(clave, ' ', '') = ANY($2::text[])`, [lista, compactos]);
  const elegido = rows
    .map((m) => ({ ...m, con_marca: lista.includes(m.clave_marca) }))
    .filter(modeloAceptable)
    .sort((a, b) => (b.con_marca - a.con_marca) || (b.clave.length - a.clave.length) || (b.popularidad - a.popularidad))[0];

  const anioTexto = anio ? String(anio) : null;
  if (elegido) {
    const palabrasModelo = new Set(elegido.clave.split(' '));
    const compacto = elegido.clave.replace(/ /g, '');
    // Quita las palabras del modelo (también si se escribió separado: "crf 250 r") y de la marca
    let resto = tokens;
    for (let i = 0; i < resto.length; i++) {
      const n = [3, 2].find((largo) => i + largo <= resto.length && resto.slice(i, i + largo).join('') === compacto);
      if (n) resto = [...resto.slice(0, i), ...resto.slice(i + n)];
    }
    const usados = new Set([...palabrasModelo, ...elegido.clave_marca.split(' '), compacto, anioTexto].filter(Boolean));
    resto = resto.filter((t) => !usados.has(t));
    const { rows: [conteo] } = await db.query(`
      SELECT count(*) AS versiones FROM vehiculos
       WHERE modelo_id = $1 AND ($2::int IS NULL OR $2 BETWEEN anio_desde AND coalesce(anio_hasta, anio_desde))`, [elegido.id, anio]);
    return {
      modelo_id: elegido.id, marca_id: elegido.marca_id, marca: elegido.marca, modelo: elegido.modelo, anio,
      segmento: elegido.segmento, versiones: conteo.versiones, texto_restante: resto.join(' '),
    };
  }

  // Solo la marca ("pastillas Honda"): las de 3 letras o más que tengan modelos cargados
  const { rows: [marca] } = await db.query(`
    SELECT ma.id, ma.nombre, ${CLAVE_SQL('ma.nombre')} AS clave
      FROM marcas_vehiculo ma
     WHERE ${CLAVE_SQL('ma.nombre')} = ANY($1::text[]) AND length(ma.nombre) >= 3
       AND EXISTS (SELECT 1 FROM modelos_vehiculo mo WHERE mo.marca_id = ma.id)
     ORDER BY length(ma.nombre) DESC, ma.popularidad DESC
     LIMIT 1`, [lista]);
  if (!marca) return null;
  const usados = new Set([...marca.clave.split(' '), anioTexto].filter(Boolean));
  return {
    modelo_id: null, marca_id: marca.id, marca: marca.nombre, modelo: null, anio,
    versiones: null, texto_restante: tokens.filter((t) => !usados.has(t)).join(' '),
  };
}

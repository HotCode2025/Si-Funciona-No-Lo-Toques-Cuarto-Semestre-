// Datos resumidos de modelos y marcas que se derivan de sus versiones (años, popularidad, estado de mercado,
// tipo y segmento predominantes). Se recalculan después de importar o editar vehículos.

export async function recalcularModelos(db, modeloIds = null) {
  await db.query(`
    WITH base AS (
      SELECT v.modelo_id, v.tipo_vehiculo_id, v.segmento, v.popularidad, v.anio_desde,
             coalesce(v.anio_hasta, v.anio_desde) AS anio_hasta, v.estado_mercado
        FROM vehiculos v
       WHERE ($1::int[] IS NULL OR v.modelo_id = ANY($1::int[]))
    ),
    tipo_top AS (
      SELECT DISTINCT ON (b.modelo_id) b.modelo_id, b.tipo_vehiculo_id
        FROM base b JOIN tipos_vehiculo t ON t.id = b.tipo_vehiculo_id AND t.slug <> 'sin_especificar'
       GROUP BY b.modelo_id, b.tipo_vehiculo_id
       ORDER BY b.modelo_id, sum(b.popularidad) DESC, count(*) DESC
    ),
    segmento_top AS (
      SELECT DISTINCT ON (modelo_id) modelo_id, segmento
        FROM base WHERE segmento IS NOT NULL
       GROUP BY modelo_id, segmento
       ORDER BY modelo_id, sum(popularidad) DESC
    ),
    resumen AS (
      SELECT modelo_id, min(anio_desde) AS desde, max(anio_hasta) AS hasta, sum(popularidad) AS pop,
             bool_or(estado_mercado = 'comercializado') AS vigente,
             bool_or(estado_mercado IS NOT NULL) AS con_estado
        FROM base GROUP BY modelo_id
    )
    UPDATE modelos_vehiculo mo
       SET anio_desde = r.desde, anio_hasta = r.hasta, popularidad = r.pop,
           estado_mercado = CASE WHEN r.vigente THEN 'comercializado' WHEN r.con_estado THEN 'discontinuado' ELSE mo.estado_mercado END,
           tipo_vehiculo_id = coalesce(t.tipo_vehiculo_id, mo.tipo_vehiculo_id),
           segmento = coalesce(s.segmento, mo.segmento)
      FROM resumen r
      LEFT JOIN tipo_top t ON t.modelo_id = r.modelo_id
      LEFT JOIN segmento_top s ON s.modelo_id = r.modelo_id
     WHERE mo.id = r.modelo_id`, [modeloIds]);
}

export async function recalcularMarcas(db, marcaIds = null) {
  await db.query(`
    WITH resumen AS (
      SELECT marca_id, sum(popularidad) AS pop,
             bool_or(estado_mercado = 'comercializado') AS vigente,
             bool_or(estado_mercado IS NOT NULL) AS con_estado,
             count(DISTINCT segmento) FILTER (WHERE segmento IS NOT NULL) AS segmentos,
             min(segmento) AS segmento
        FROM modelos_vehiculo
       WHERE ($1::int[] IS NULL OR marca_id = ANY($1::int[]))
       GROUP BY marca_id
    )
    UPDATE marcas_vehiculo ma
       SET popularidad = r.pop,
           estado_mercado = CASE WHEN r.vigente THEN 'comercializado' WHEN r.con_estado THEN 'discontinuado' ELSE ma.estado_mercado END,
           segmento = CASE WHEN r.segmentos > 1 THEN 'mixto' WHEN r.segmentos = 1 THEN r.segmento ELSE ma.segmento END
      FROM resumen r WHERE ma.id = r.marca_id`, [marcaIds]);
}

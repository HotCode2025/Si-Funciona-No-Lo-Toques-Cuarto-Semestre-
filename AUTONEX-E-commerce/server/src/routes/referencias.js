import { query } from '../db.js';
import { config } from '../config.js';
import { VALORES } from '../importacion/campos.js';
import { TARIFAS } from '../services/envios.js';

// Listas de referencia para el frontend (nada queda escrito a mano en la interfaz).

const ETIQUETAS = {
  estados_verificacion: {
    VERIFIED: { etiqueta: 'Verificado', descripcion: 'Confirmado con la fuente indicada.' },
    UNVERIFIED: { etiqueta: 'Sin verificar', descripcion: 'Importado de una fuente, todavía no confirmado.' },
    NEEDS_REVIEW: { etiqueta: 'A revisar', descripcion: 'No hay información verificable: necesita revisión.' },
    DISCONTINUED: { etiqueta: 'Discontinuado', descripcion: 'Ya no se ofrece o dejó de aplicar.' },
  },
  combustible: { nafta: 'Nafta', diesel: 'Diésel', gnc: 'GNC', hibrido: 'Híbrido', electrico: 'Eléctrico', flex: 'Flex' },
  transmision: { manual: 'Manual', automatica: 'Automática' },
  traccion: { '4x2': '4x2', '4x4': '4x4', '6x2': '6x2', '6x4': '6x4', '8x2': '8x2', '8x4': '8x4' },
  aspiracion: { atmosferico: 'Atmosférico', turbo: 'Turbo', biturbo: 'Biturbo', supercargado: 'Supercargado', electrico: 'Eléctrico' },
  tipo_pieza: {
    original: 'Original / OEM', aftermarket: 'Aftermarket', alternativo: 'Alternativo', generico: 'Genérico',
    usado: 'Usado', reacondicionado: 'Reacondicionado',
  },
  estado_mercado: { comercializado: 'A la venta (0 km)', discontinuado: 'Discontinuado', usado_importado: 'Usado / importado' },
  segmento: { particular: 'Autos y SUV', comercial: 'Comerciales', pesado: 'Pesados', mixto: 'Mixto', moto: 'Motos' },
  tiempos: { '2T': '2 tiempos', '4T': '4 tiempos', electrico: 'Eléctrico' },
  alimentacion: { carburador: 'Carburador', inyeccion: 'Inyección', electrico: 'Eléctrico' },
  rubro: { autos: 'Autos', motos: 'Motos', general: 'General' },
};

const lista = (mapa) => Object.entries(mapa).map(([valor, v]) => (typeof v === 'string' ? { valor, etiqueta: v } : { valor, ...v }));

export default async function rutasReferencias(app) {
  app.get('/referencias', async () => {
    const [provincias, tipos, marcasRepuesto, totales, fuentes, categoriasMoto] = await Promise.all([
      query('SELECT nombre FROM provincias ORDER BY orden'),
      query('SELECT slug AS valor, nombre AS etiqueta, clase FROM tipos_vehiculo ORDER BY orden'),
      query(`SELECT mr.nombre, count(p.id) AS productos FROM marcas_repuesto mr
               JOIN productos p ON p.marca_repuesto_id = mr.id
              WHERE EXISTS (SELECT 1 FROM publicaciones pu WHERE pu.producto_id = p.id AND pu.estado = 'activa')
              GROUP BY mr.id ORDER BY count(p.id) DESC, mr.nombre`),
      query(`SELECT (SELECT count(*) FROM marcas_vehiculo ma WHERE EXISTS (SELECT 1 FROM modelos_vehiculo mo WHERE mo.marca_id = ma.id)) AS marcas,
                    (SELECT count(*) FROM modelos_vehiculo) AS modelos,
                    (SELECT count(*) FROM vehiculos) AS versiones,
                    (SELECT count(*) FROM modelos_vehiculo WHERE segmento = 'moto') AS modelos_moto,
                    (SELECT count(DISTINCT marca_id) FROM modelos_vehiculo WHERE segmento = 'moto') AS marcas_moto,
                    (SELECT count(DISTINCT producto_id) FROM publicaciones WHERE estado = 'activa') AS repuestos,
                    (SELECT count(*) FROM vendedores ve JOIN usuarios us ON us.id = ve.usuario_id WHERE us.email_verificado_en IS NOT NULL) AS vendedores`),
      // Atribución de las fuentes públicas que se muestran en la interfaz (licencias CC BY y similares)
      query(`SELECT nombre, url, licencia, licencia_url, atribucion FROM fuentes
              WHERE atribucion IS NOT NULL AND tipo <> 'demo' ORDER BY nombre`),
      // Categorías de motos con la cantidad de modelos de cada una
      query(`SELECT cm.codigo AS valor, cm.nombre AS etiqueta, count(mc.modelo_id) AS modelos
               FROM categorias_moto cm LEFT JOIN modelo_categorias_moto mc ON mc.categoria_id = cm.id
              GROUP BY cm.id ORDER BY cm.orden`),
    ]);
    // Se valida que las etiquetas cubran todos los valores que acepta el importador
    for (const clave of ['combustible', 'transmision', 'traccion', 'aspiracion', 'tipo_pieza', 'estado_mercado']) {
      for (const valor of Object.keys(VALORES[clave])) ETIQUETAS[clave][valor] ??= valor;
    }
    return {
      totales: totales.rows[0],
      atribuciones: fuentes.rows,
      provincias: provincias.rows.map((r) => r.nombre),
      tipos_vehiculo: tipos.rows,
      marcas_repuesto: marcasRepuesto.rows,
      transportistas: Object.entries(TARIFAS).map(([valor, t]) => ({ valor, etiqueta: t.nombre, solo_misma_ciudad: Boolean(t.soloMismaCiudad) })),
      estados_verificacion: lista(ETIQUETAS.estados_verificacion),
      combustibles: lista(ETIQUETAS.combustible),
      transmisiones: lista(ETIQUETAS.transmision),
      tracciones: lista(ETIQUETAS.traccion),
      aspiraciones: lista(ETIQUETAS.aspiracion),
      tipos_pieza: lista(ETIQUETAS.tipo_pieza),
      estados_mercado: lista(ETIQUETAS.estado_mercado),
      segmentos: lista(ETIQUETAS.segmento),
      categorias_moto: categoriasMoto.rows,
      tiempos: lista(ETIQUETAS.tiempos),
      alimentaciones: lista(ETIQUETAS.alimentacion),
      rubros: lista(ETIQUETAS.rubro),
      // Solo los datos cargados en server/.env (OPERADOR_*)
      operador: Object.fromEntries(Object.entries(config.operador).filter(([, v]) => v)),
    };
  });
}

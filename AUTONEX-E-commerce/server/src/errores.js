// Errores de la API y traducción de los errores de validación de Fastify (ajv) a mensajes claros en español.

export class ErrorApi extends Error {
  constructor(status, mensaje, extra = {}) {
    super(mensaje);
    this.statusCode = status;
    this.extra = extra;
  }
}

const ETIQUETAS = {
  email: 'email',
  password: 'contraseña',
  nombre: 'nombre',
  apellido: 'apellido',
  telefono: 'teléfono',
  dni: 'DNI',
  rol: 'tipo de cuenta',
  nombre_comercial: 'nombre comercial',
  direccion: 'dirección',
  ciudad: 'ciudad',
  provincia: 'provincia',
  horario: 'horario de atención',
  horarios: 'horario de atención',
  turnos: 'turnos del horario',
  desde: 'hora de apertura',
  hasta: 'hora de cierre',
  whatsapp: 'WhatsApp',
  descripcion: 'descripción',
  calle: 'calle',
  numero: 'número',
  piso_depto: 'piso/depto',
  codigo_postal: 'código postal',
  localidad: 'localidad',
  observaciones: 'observaciones',
  items: 'productos',
  entregas: 'formas de entrega',
  publicacion_id: 'publicación',
  producto_id: 'producto',
  vendedor_id: 'vendedor',
  vehiculo_ids: 'vehículos compatibles',
  cantidad: 'cantidad',
  unidades: 'unidades',
  metodo: 'forma de entrega',
  transportista: 'transportista',
  precio: 'precio',
  stock: 'stock',
  condicion: 'condición',
  estado: 'estado',
  marca: 'marca',
  numero_pieza: 'número de pieza',
  marca_repuesto: 'marca del repuesto',
  categoria_id: 'categoría',
  payment_id: 'id de pago',
  precio_min: 'precio mínimo',
  precio_max: 'precio máximo',
  pagina: 'página',
  q: 'búsqueda',
};

const PATRONES = {
  dni: 'El DNI tiene que tener 7 u 8 números, sin puntos.',
  telefono: 'El teléfono solo puede tener números, espacios, guiones, paréntesis y el signo +.',
  whatsapp: 'El WhatsApp solo puede tener números (con código de país, ej: 5493511234567).',
  codigo_postal: 'El código postal no es válido (ej: 5000 o X5000ABC).',
  password: 'La contraseña tiene que tener al menos una letra y un número.',
};

const TIPOS = {
  string: 'un texto',
  integer: 'un número entero',
  number: 'un número',
  boolean: 'verdadero o falso',
  array: 'una lista',
  object: 'un objeto',
};

const VALORES = {
  comprador: 'comprador', vendedor: 'vendedor', retiro: 'retiro en el local', domicilio: 'envío a domicilio',
  andreani: 'Andreani', oca: 'OCA', correo_argentino: 'Correo Argentino', moto: 'moto mensajería',
  nuevo: 'nuevo', usado: 'usado', activa: 'activa', pausada: 'pausada',
};

function campoDe(error) {
  if (error.keyword === 'required') return error.params.missingProperty;
  const partes = (error.instancePath || '').split('/').filter(Boolean);
  // En listas ("/items/0/cantidad") nos quedamos con el último nombre que no es un índice.
  for (let i = partes.length - 1; i >= 0; i--) {
    if (!/^\d+$/.test(partes[i])) return partes[i];
  }
  return null;
}

function etiqueta(campo) {
  return ETIQUETAS[campo] || (campo ? campo.replace(/_/g, ' ') : 'dato');
}

export function traducirErrorValidacion(error) {
  const campo = campoDe(error);
  const nombre = etiqueta(campo);
  const p = error.params || {};
  switch (error.keyword) {
    case 'required':
      return `Falta completar el campo "${nombre}".`;
    case 'type':
      return `El campo "${nombre}" tiene que ser ${TIPOS[p.type] || p.type}.`;
    case 'minLength':
      return p.limit <= 1
        ? `El campo "${nombre}" no puede quedar vacío.`
        : `El campo "${nombre}" tiene que tener al menos ${p.limit} caracteres.`;
    case 'maxLength':
      return `El campo "${nombre}" puede tener como máximo ${p.limit} caracteres.`;
    case 'minimum':
      return `El campo "${nombre}" tiene que ser mayor o igual a ${p.limit}.`;
    case 'exclusiveMinimum':
      return `El campo "${nombre}" tiene que ser mayor a ${p.limit}.`;
    case 'maximum':
      return `El campo "${nombre}" tiene que ser menor o igual a ${p.limit}.`;
    case 'format':
      return p.format === 'email' ? 'El email no tiene un formato válido (ej: nombre@correo.com).' : `El campo "${nombre}" no tiene un formato válido.`;
    case 'pattern':
      return PATRONES[campo] || `El campo "${nombre}" no tiene un formato válido.`;
    case 'enum':
      return `El campo "${nombre}" tiene que ser uno de estos valores: ${p.allowedValues.map((v) => VALORES[v] || v).join(', ')}.`;
    case 'minItems':
      return p.limit === 1 ? `Tenés que indicar al menos un elemento en "${nombre}".` : `Tenés que indicar al menos ${p.limit} elementos en "${nombre}".`;
    case 'maxItems':
      return `Se pueden indicar como máximo ${p.limit} elementos en "${nombre}".`;
    case 'minProperties':
      return 'Tenés que enviar al menos un dato para modificar.';
    case 'uniqueItems':
      return `Hay elementos repetidos en "${nombre}".`;
    default:
      return `El campo "${nombre}" no es válido.`;
  }
}

/** Manejador de errores global: todas las respuestas de error tienen la forma { error, mensaje, ... }. */
export function manejadorErrores(error, request, reply) {
  if (error.validation) {
    // Un solo mensaje por campo (el primero), para no repetir "muy corta" y "formato inválido" juntos.
    const porCampo = new Map();
    for (const e of error.validation) {
      const clave = `${e.instancePath}|${campoDe(e)}`;
      if (!porCampo.has(clave)) porCampo.set(clave, traducirErrorValidacion(e));
    }
    const detalles = [...new Set(porCampo.values())];
    return reply.status(400).send({ error: 'datos_invalidos', mensaje: detalles[0], detalles });
  }
  if (error instanceof ErrorApi) {
    return reply.status(error.statusCode).send({ error: codigoDe(error.statusCode), mensaje: error.message, ...error.extra });
  }
  if (error.code === 'FST_ERR_CTP_INVALID_JSON_BODY' || error.code === 'FST_ERR_CTP_EMPTY_JSON_BODY') {
    return reply.status(400).send({ error: 'datos_invalidos', mensaje: 'El cuerpo de la petición no es un JSON válido.' });
  }
  if (error.statusCode && error.statusCode < 500) {
    return reply.status(error.statusCode).send({ error: codigoDe(error.statusCode), mensaje: error.message });
  }
  request.log.error(error);
  return reply.status(500).send({ error: 'error_interno', mensaje: 'Ocurrió un error inesperado en el servidor. Probá de nuevo en unos minutos.' });
}

function codigoDe(status) {
  return {
    400: 'datos_invalidos', 401: 'no_autenticado', 403: 'sin_permiso', 404: 'no_encontrado',
    409: 'conflicto', 422: 'no_procesable', 502: 'error_mercado_pago', 503: 'no_disponible',
  }[status] || 'error';
}

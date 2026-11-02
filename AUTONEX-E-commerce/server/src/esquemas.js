// Piezas reutilizables para los esquemas de validación de Fastify.

export const PROVINCIAS = [
  'Buenos Aires', 'Ciudad Autónoma de Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba',
  'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones',
  'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe',
  'Santiago del Estero', 'Tierra del Fuego', 'Tucumán',
];

export const texto = (max = 120, min = 1) => ({ type: 'string', minLength: min, maxLength: max });
export const textoOpcional = (max = 200) => ({ type: 'string', maxLength: max });
export const id = { type: 'integer', minimum: 1 };
export const provincia = { type: 'string', enum: PROVINCIAS };

export const email = { type: 'string', format: 'email', maxLength: 160 };
export const telefono = { type: 'string', minLength: 6, maxLength: 30, pattern: '^[0-9+()\\s-]+$' };
export const dni = { type: 'string', pattern: '^[0-9]{7,8}$' };
export const codigoPostal = { type: 'string', pattern: '^[A-Za-z]?[0-9]{4}[A-Za-z]{0,3}$' };

export const paramsId = {
  type: 'object',
  required: ['id'],
  properties: { id },
};

export const TRANSPORTISTAS = ['andreani', 'oca', 'correo_argentino', 'moto'];

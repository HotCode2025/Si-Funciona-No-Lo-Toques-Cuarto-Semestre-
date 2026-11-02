// Identificación de vehículos por patente (dominio) o VIN / número de chasis.
//
// PREPARACIÓN para una integración futura. AUTONEX no tiene ni carga una base de patentes: los datos de
// dominio están protegidos y solo se pueden consultar a través de servicios autorizados (por ejemplo los del
// propio DNRPA o proveedores con convenio). Este módulo:
//   · valida y normaliza el formato (patentes argentinas y VIN de 17 caracteres),
//   · consulta la caché local (identificaciones_vehiculo),
//   · deriva el fabricante a partir del WMI del VIN si la tabla vin_wmi tiene datos importados,
//   · delega en un proveedor registrado; si no hay ninguno, responde que no está disponible.
//
// Para integrar un proveedor: registrarProveedor('nombre', { patente: async (valor) => {...}, vin: async (valor) => {...} })
// y definir IDENTIFICACION_PROVEEDOR=nombre en server/.env. La respuesta tiene que traer el código de vehículo de AUTONEX
// (o marca/modelo/año/versión para buscarlo) y se guarda en la caché con el proveedor que la dio.

import { query } from '../db.js';
import { ErrorApi } from '../errores.js';

const PROVEEDORES = new Map();
export function registrarProveedor(nombre, implementacion) {
  PROVEEDORES.set(nombre, implementacion);
}

export function normalizarPatente(valor) {
  const limpio = String(valor || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (/^[A-Z]{3}\d{3}$/.test(limpio)) return { valor: limpio, formato: 'AAA123 (1995-2016)' };
  if (/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(limpio)) return { valor: limpio, formato: 'AA123BB (Mercosur, desde 2016)' };
  if (/^[A-Z]\d{6}$/.test(limpio)) return { valor: limpio, formato: 'A123456 (anterior a 1995)' };
  return null;
}

export function normalizarVin(valor) {
  const limpio = String(valor || '').toUpperCase().replace(/[\s-]/g, '');
  // ISO 3779: 17 caracteres, sin I, O ni Q
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(limpio)) return null;
  return { valor: limpio, wmi: limpio.slice(0, 3), vds: limpio.slice(3, 9), vis: limpio.slice(9) };
}

async function desdeCache(tipo, valor) {
  const { rows } = await query(`
    SELECT i.proveedor, i.consultado_en, i.vehiculo_id, i.respuesta FROM identificaciones_vehiculo i
     WHERE i.tipo = $1 AND i.valor = $2 ORDER BY i.consultado_en DESC LIMIT 1`, [tipo, valor]);
  return rows[0] || null;
}

function proveedorConfigurado() {
  const nombre = process.env.IDENTIFICACION_PROVEEDOR;
  return nombre && PROVEEDORES.has(nombre) ? { nombre, ...PROVEEDORES.get(nombre) } : null;
}

async function consultar(tipo, valor) {
  const cache = await desdeCache(tipo, valor);
  if (cache) return { origen: 'cache', ...cache };
  const proveedor = proveedorConfigurado();
  if (!proveedor || !proveedor[tipo]) {
    throw new ErrorApi(501, tipo === 'patente'
      ? 'La búsqueda por patente todavía no está disponible: requiere un servicio autorizado para consultar dominios. Elegí tu vehículo por marca, modelo y año.'
      : 'La búsqueda por VIN todavía no está disponible: requiere un proveedor de decodificación. Elegí tu vehículo por marca, modelo y año.',
    { disponible: false });
  }
  const respuesta = await proveedor[tipo](valor);
  let vehiculoId = null;
  if (respuesta?.codigo_vehiculo) {
    const { rows: [v] } = await query('SELECT id FROM vehiculos WHERE codigo = $1', [respuesta.codigo_vehiculo]);
    vehiculoId = v?.id ?? null;
  }
  await query(`INSERT INTO identificaciones_vehiculo (tipo, valor, vehiculo_id, proveedor, respuesta) VALUES ($1,$2,$3,$4,$5)
               ON CONFLICT (tipo, valor, proveedor) DO UPDATE SET respuesta = EXCLUDED.respuesta, vehiculo_id = EXCLUDED.vehiculo_id, consultado_en = now()`,
  [tipo, valor, vehiculoId, proveedor.nombre, respuesta]);
  return { origen: proveedor.nombre, vehiculo_id: vehiculoId, respuesta };
}

export async function identificarPatente(valor) {
  const patente = normalizarPatente(valor);
  if (!patente) throw new ErrorApi(400, 'La patente no tiene un formato válido (AA123BB, AAA123 o A123456).');
  return { patente: patente.valor, formato: patente.formato, ...(await consultar('patente', patente.valor)) };
}

export async function identificarVin(valor) {
  const vin = normalizarVin(valor);
  if (!vin) throw new ErrorApi(400, 'El VIN tiene que tener 17 caracteres (letras y números, sin I, O ni Q).');
  const { rows: [wmi] } = await query(`
    SELECT w.wmi, w.fabricante, w.pais, ma.nombre AS marca FROM vin_wmi w LEFT JOIN marcas_vehiculo ma ON ma.id = w.marca_id
     WHERE w.wmi = $1`, [vin.wmi]);
  try {
    return { vin: vin.valor, wmi: wmi || { wmi: vin.wmi, fabricante: null }, ...(await consultar('vin', vin.valor)) };
  } catch (error) {
    if (error.statusCode === 501) error.extra = { ...error.extra, vin: vin.valor, wmi: wmi || { wmi: vin.wmi, fabricante: null } };
    throw error;
  }
}

// Cotizador de envíos SIMULADO de AUTONEX.
// Tabla de tarifas por transportista según si el destino está en la misma provincia que el vendedor o no.
// El costo final = tarifa base + adicional por cada unidad extra del pedido (hasta 10 unidades).

export const TARIFAS = {
  andreani: {
    nombre: 'Andreani',
    base: { misma: 6900, otra: 11500 },
    porUnidadExtra: 900,
    demora: { misma: '2 a 3 días hábiles', otra: '4 a 6 días hábiles' },
  },
  oca: {
    nombre: 'OCA',
    base: { misma: 6200, otra: 10400 },
    porUnidadExtra: 800,
    demora: { misma: '3 a 4 días hábiles', otra: '5 a 7 días hábiles' },
  },
  correo_argentino: {
    nombre: 'Correo Argentino',
    base: { misma: 5400, otra: 8900 },
    porUnidadExtra: 700,
    demora: { misma: '3 a 5 días hábiles', otra: '6 a 9 días hábiles' },
  },
  moto: {
    nombre: 'Moto mensajería',
    base: { misma: 3800, otra: null },
    porUnidadExtra: 500,
    demora: { misma: 'En el día (comprando antes de las 13 h)', otra: null },
    soloMismaCiudad: true,
  },
};

export const NOMBRES_TRANSPORTISTA = Object.fromEntries(Object.entries(TARIFAS).map(([k, t]) => [k, t.nombre]));

const CABA = 'Ciudad Autónoma de Buenos Aires';
const ALIAS_CIUDAD = {
  caba: 'ciudad autonoma de buenos aires',
  'capital federal': 'ciudad autonoma de buenos aires',
  'buenos aires capital': 'ciudad autonoma de buenos aires',
  tucuman: 'san miguel de tucuman',
  'cordoba capital': 'cordoba',
  'neuquen capital': 'neuquen',
  'mendoza capital': 'mendoza',
};

function normalizarCiudad(nombre = '') {
  const limpio = nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  return ALIAS_CIUDAD[limpio] || limpio;
}

export function esMismaCiudad(destino, vendedor) {
  if (destino.provincia !== vendedor.provincia) return false;
  if (destino.provincia === CABA) return true; // CABA es una sola ciudad
  return normalizarCiudad(destino.localidad) === normalizarCiudad(vendedor.ciudad);
}

/**
 * Devuelve las opciones de envío para un pedido de `unidades` productos de un vendedor.
 * @param {{ciudad: string, provincia: string}} vendedor
 * @param {{localidad: string, provincia: string}} destino
 */
export function cotizarEnvio(vendedor, destino, unidades = 1) {
  const mismaProvincia = destino.provincia === vendedor.provincia;
  const mismaCiudad = esMismaCiudad(destino, vendedor);
  const zona = mismaProvincia ? 'misma' : 'otra';
  const extras = Math.min(Math.max(unidades, 1), 10) - 1;

  const opciones = Object.entries(TARIFAS).map(([clave, t]) => {
    if (t.soloMismaCiudad && !mismaCiudad) {
      return {
        transportista: clave, nombre: t.nombre, disponible: false, costo: null, demora: null,
        motivo: `Solo disponible si recibís en ${vendedor.ciudad}, la misma ciudad del vendedor.`,
      };
    }
    return {
      transportista: clave,
      nombre: t.nombre,
      disponible: true,
      costo: t.base[zona] + extras * t.porUnidadExtra,
      demora: t.demora[zona],
    };
  });

  return { misma_provincia: mismaProvincia, misma_ciudad: mismaCiudad, opciones };
}

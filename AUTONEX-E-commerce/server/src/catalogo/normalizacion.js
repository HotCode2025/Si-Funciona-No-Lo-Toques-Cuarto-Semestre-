// Normalización de textos y claves para comparar datos de distintas fuentes y detectar duplicados.

export function sinTildes(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** minúsculas, sin tildes, sin signos, espacios simples */
export function normalizarTexto(texto) {
  return sinTildes(texto).toLowerCase().replace(/[^a-z0-9.+]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Igual que normalizar_codigo() de PostgreSQL: mayúsculas y solo letras y números. */
export function normalizarCodigo(texto) {
  return sinTildes(texto).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function slugificar(texto) {
  return normalizarTexto(texto).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'sin-nombre';
}

// Formas distintas de decir lo mismo en las descripciones de vehículos.
const SINONIMOS = new Map(Object.entries({
  tdi: 'diesel', td: 'diesel', tdci: 'diesel', hdi: 'diesel', bluehdi: 'diesel', dci: 'diesel', cdi: 'diesel', crdi: 'diesel',
  jtd: 'diesel', multijet: 'diesel', mj: 'diesel', d4d: 'diesel', 'd-4d': 'diesel', ctdi: 'diesel', turbodiesel: 'diesel',
  gasoil: 'diesel', gasoleo: 'diesel',
  nafta: '', gasolina: '', petrol: '',
  automatica: 'at', automatico: 'at', automatic: 'at', aut: 'at', 'a/t': 'at', tiptronic: 'at',
  manual: 'mt', 'm/t': 'mt',
  awd: '4x4', '4wd': '4x4', '4motion': '4x4', quattro: '4x4', xdrive: '4x4', '4matic': '4x4',
  dc: 'cd', 'doble': 'cd', cabina: '', puertas: 'p', ptas: 'p', pts: 'p',
}));

function tokensCanonicos(texto) {
  const previo = String(texto ?? '')
    .replace(/\b([AaMm])\/[Tt]\b/g, '$1t')            // A/T -> at, M/T -> mt
    .replace(/([A-Za-z0-9])-([A-Za-z0-9])/g, '$1$2'); // D-4D -> d4d, T-Cross -> tcross
  return normalizarTexto(previo)
    .replace(/(\d)\.(\d)l\b/g, '$1.$2')
    .split(' ')
    .map((t) => (SINONIMOS.has(t) ? SINONIMOS.get(t) : t))
    .filter(Boolean);
}

/**
 * Clave de un nombre (marca, modelo, motor): para encontrar el mismo dato escrito de otra forma.
 * Une letras y números separados por espacio: "Rav 4" = "RAV4", "DS 3" = "DS3", "CR-V" = "Crv".
 */
export function claveNombre(texto) {
  return tokensCanonicos(texto).join(' ').replace(/([a-z]) (?=\d)|(\d) (?=[a-z])/g, '$1$2');
}

/** Clave de una versión: tokens canónicos sin repetir y ordenados ("Hilux 2.8 TDI" = "2.8 Diesel Hilux"). */
export function claveVehiculo(modelo, version, motor) {
  const tokens = new Set([...tokensCanonicos(modelo), ...tokensCanonicos(version), ...tokensCanonicos(motor)]);
  return [...tokens].sort().join(' ');
}

/** Tokens "distintivos" (con números o de 1-2 letras): si difieren, dos nombres parecidos NO son el mismo (Tiggo 4 / Tiggo 5). */
export function tokensDistintivos(texto) {
  return tokensCanonicos(texto).filter((t) => /\d/.test(t) || t.length <= 2).sort().join(' ');
}

const AÑO_ACTUAL = new Date().getFullYear();
export function anioValido(anio) {
  return Number.isInteger(anio) && anio >= 1900 && anio <= AÑO_ACTUAL + 2;
}

// Tipos de campo del importador: convierten el texto de una celda en un valor válido o explican por qué no lo es.

import { anioValido, normalizarTexto } from '../catalogo/normalizacion.js';

export class ErrorCampo extends Error {
  constructor(campo, mensaje) {
    super(mensaje);
    this.campo = campo;
  }
}

const vacio = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

/** Valores aceptados (en castellano o inglés) para cada lista cerrada. */
export const VALORES = {
  combustible: {
    nafta: ['nafta', 'gasolina', 'gasoline', 'petrol', 'naftero'],
    diesel: ['diesel', 'gasoil', 'gasoleo', 'turbodiesel'],
    gnc: ['gnc', 'cng', 'gas natural'],
    hibrido: ['hibrido', 'hybrid', 'hev', 'phev', 'mhev'],
    electrico: ['electrico', 'electric', 'ev', 'bev'],
    flex: ['flex', 'flexfuel', 'bi-combustible', 'bicombustible'],
  },
  transmision: {
    manual: ['manual', 'mt', 'm/t', 'mecanica'],
    automatica: ['automatica', 'automatico', 'automatic', 'at', 'a/t', 'cvt', 'dsg', 'dct', 'tiptronic', 'secuencial'],
  },
  traccion: {
    '4x2': ['4x2', 'fwd', 'rwd', 'delantera', 'trasera', '2wd'],
    '4x4': ['4x4', 'awd', '4wd', 'integral', 'total'],
    '6x2': ['6x2'], '6x4': ['6x4'], '8x2': ['8x2'], '8x4': ['8x4'],
  },
  aspiracion: {
    atmosferico: ['atmosferico', 'aspirado', 'natural', 'na', 'naturally aspirated'],
    turbo: ['turbo', 'turbocharged', 'turboalimentado'],
    biturbo: ['biturbo', 'twin turbo', 'bi-turbo'],
    supercargado: ['supercargado', 'supercharged', 'compresor'],
    electrico: ['electrico', 'electric'],
  },
  estado_verificacion: {
    VERIFIED: ['verified', 'verificado', 'verificada', 'si', 'ok'],
    UNVERIFIED: ['unverified', 'sin verificar', 'no verificado', 'pendiente'],
    NEEDS_REVIEW: ['needs_review', 'needs review', 'revisar', 'a revisar', 'necesita revision'],
    DISCONTINUED: ['discontinued', 'discontinuado', 'discontinuada', 'baja'],
  },
  confianza: { alta: ['alta', 'high'], media: ['media', 'medium'], baja: ['baja', 'low'] },
  estado_mercado: {
    comercializado: ['comercializado', 'a la venta', 'vigente', 'current', 'en venta'],
    discontinuado: ['discontinuado', 'discontinued', 'fuera de produccion'],
    usado_importado: ['usado_importado', 'usado', 'importado', 'used', 'imported'],
  },
  segmento: { particular: ['particular', 'liviano', 'passenger'], comercial: ['comercial', 'commercial'], pesado: ['pesado', 'heavy'], moto: ['moto', 'motos', 'motocicleta', 'motorcycle'] },
  tiempos: { '2T': ['2t', '2 tiempos', 'two stroke', '2-stroke'], '4T': ['4t', '4 tiempos', 'four stroke', '4-stroke'], electrico: ['electrico', 'electric'] },
  alimentacion: { carburador: ['carburador', 'carburetor', 'carb'], inyeccion: ['inyeccion', 'injection', 'efi', 'fi'], electrico: ['electrico', 'electric'] },
  rubro: { autos: ['autos', 'auto', 'cars'], motos: ['motos', 'moto', 'motorcycles'], general: ['general', 'ambos'] },
  tipo_imagen: { principal: ['principal', 'main'], lateral: ['lateral', 'side'], frontal: ['frontal', 'front'], trasera: ['trasera', 'rear', 'back'], motor: ['motor', 'engine'], tablero: ['tablero', 'dashboard'], color: ['color', 'version'], packaging: ['packaging', 'empaque', 'caja'], detalle: ['detalle', 'detail'], aplicacion: ['aplicacion', 'application', 'instalada'] },
  permiso_imagen: { libre: ['libre', 'free', 'cc', 'public domain'], autorizado: ['autorizado', 'authorized', 'licensed'], pendiente: ['pendiente', 'pending'], no_permitido: ['no_permitido', 'no permitido', 'denied'] },
  // Una marca puede fabricar de todo (autos y camiones): por eso admite "mixto"
  fondo_logo: { claro: ['claro', 'blanco', 'light'], oscuro: ['oscuro', 'negro', 'dark'] },
  segmento_marca: { particular: ['particular', 'liviano'], comercial: ['comercial'], pesado: ['pesado'], mixto: ['mixto', 'varios'], moto: ['moto', 'motos'] },
  tipo_fuente: {
    oficial: ['oficial', 'gobierno', 'registro'],
    fabricante_vehiculos: ['fabricante_vehiculos', 'fabricante de vehiculos', 'terminal', 'automotriz'],
    fabricante_repuestos: ['fabricante_repuestos', 'fabricante de repuestos', 'fabricante de autopartes'],
    proveedor: ['proveedor', 'distribuidor', 'mayorista'],
    catalogo_aftermarket: ['catalogo_aftermarket', 'catalogo aftermarket', 'aftermarket'],
    datos_abiertos: ['datos_abiertos', 'datos abiertos', 'open data'],
    manual: ['manual', 'carga manual'],
    demo: ['demo', 'demostracion'],
  },
  tipo_pieza: {
    original: ['original', 'oem', 'original/oem', 'genuino'],
    aftermarket: ['aftermarket', 'reposicion', 'mercado de reposicion'],
    alternativo: ['alternativo', 'alternative'],
    generico: ['generico', 'generic'],
    usado: ['usado', 'used'],
    reacondicionado: ['reacondicionado', 'remanufacturado', 'reconstruido', 'refurbished', 'remanufactured'],
  },
  condicion: { nuevo: ['nuevo', 'new'], usado: ['usado', 'used'] },
  tipo_equivalencia: {
    equivalente: ['equivalente', 'equivalent', 'equivalencia'],
    reemplaza: ['reemplaza', 'replaces', 'sustituye'],
    reemplazado_por: ['reemplazado_por', 'reemplazado por', 'replaced by', 'superseded by'],
  },
};

// Índice inverso: valor normalizado -> valor canónico
const INDICES = Object.fromEntries(Object.entries(VALORES).map(([lista, opciones]) => {
  const indice = new Map();
  for (const [canonico, variantes] of Object.entries(opciones)) {
    indice.set(normalizarTexto(canonico), canonico);
    for (const v of variantes) indice.set(normalizarTexto(v), canonico);
  }
  return [lista, indice];
}));

export function valorDeLista(lista, valor) {
  return INDICES[lista].get(normalizarTexto(valor)) ?? null;
}

/** Convierte y valida el valor de un campo según su definición. Devuelve undefined si está vacío. */
export function convertir(def, valor) {
  if (vacio(valor)) {
    if (def.requerido) throw new ErrorCampo(def.nombre, `Falta el dato obligatorio "${def.etiqueta || def.nombre}".`);
    return undefined;
  }
  const texto = String(valor).trim();
  switch (def.tipo) {
    case 'texto':
      if (def.max && texto.length > def.max) throw new ErrorCampo(def.nombre, `"${def.etiqueta || def.nombre}" admite hasta ${def.max} caracteres.`);
      return texto;
    case 'entero': {
      const n = Number(texto.replace(/\./g, '').replace(',', '.'));
      if (!Number.isInteger(n)) throw new ErrorCampo(def.nombre, `"${def.etiqueta || def.nombre}" tiene que ser un número entero (vino "${texto}").`);
      if (def.min !== undefined && n < def.min) throw new ErrorCampo(def.nombre, `"${def.etiqueta || def.nombre}" tiene que ser ${def.min} o más.`);
      if (def.max !== undefined && n > def.max) throw new ErrorCampo(def.nombre, `"${def.etiqueta || def.nombre}" tiene que ser ${def.max} o menos.`);
      return n;
    }
    case 'decimal': {
      // Acepta "12500", "12.500,50" (formato argentino) y "12500.50"
      const limpio = /,\d{1,2}$/.test(texto) ? texto.replace(/\./g, '').replace(',', '.') : texto.replace(/,/g, '');
      const n = Number(limpio.replace(/[$\s]/g, ''));
      if (!Number.isFinite(n)) throw new ErrorCampo(def.nombre, `"${def.etiqueta || def.nombre}" tiene que ser un número (vino "${texto}").`);
      if (def.min !== undefined && n < def.min) throw new ErrorCampo(def.nombre, `"${def.etiqueta || def.nombre}" tiene que ser mayor o igual a ${def.min}.`);
      return n;
    }
    case 'anio': {
      const n = Number(texto);
      if (!anioValido(n)) throw new ErrorCampo(def.nombre, `"${def.etiqueta || def.nombre}" no es un año válido (vino "${texto}").`);
      return n;
    }
    case 'booleano': {
      const t = normalizarTexto(texto);
      if (['si', 's', 'true', '1', 'yes', 'y', 'x'].includes(t)) return true;
      if (['no', 'n', 'false', '0'].includes(t)) return false;
      throw new ErrorCampo(def.nombre, `"${def.etiqueta || def.nombre}" tiene que ser sí o no (vino "${texto}").`);
    }
    case 'lista': {
      const v = valorDeLista(def.lista, texto);
      if (!v) {
        const opciones = Object.keys(VALORES[def.lista]).join(', ');
        throw new ErrorCampo(def.nombre, `"${texto}" no es un valor válido para "${def.etiqueta || def.nombre}". Opciones: ${opciones}.`);
      }
      return v;
    }
    case 'url':
      if (!/^https?:\/\/\S+$/i.test(texto)) throw new ErrorCampo(def.nombre, `"${def.etiqueta || def.nombre}" tiene que ser una URL (http o https).`);
      return texto;
    case 'json':
      try {
        return typeof valor === 'object' ? valor : JSON.parse(texto);
      } catch {
        throw new ErrorCampo(def.nombre, `"${def.etiqueta || def.nombre}" no es JSON válido.`);
      }
    default:
      return texto;
  }
}

// Campos de trazabilidad que aceptan todas las entidades del catálogo
export const CAMPOS_TRAZABILIDAD = [
  { nombre: 'fuente_url', etiqueta: 'URL de la fuente', tipo: 'url', alias: ['source_url', 'url_fuente'] },
  { nombre: 'estado_verificacion', etiqueta: 'Estado de verificación', tipo: 'lista', lista: 'estado_verificacion', alias: ['verification_status', 'status', 'estado'] },
  { nombre: 'confianza', etiqueta: 'Nivel de confianza', tipo: 'lista', lista: 'confianza', alias: ['confidence_level', 'confidence'] },
  { nombre: 'verificado_en', etiqueta: 'Fecha de verificación', tipo: 'texto', alias: ['last_verified_at', 'verified_at'] },
];

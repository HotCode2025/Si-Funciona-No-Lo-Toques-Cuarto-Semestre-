// Piezas compartidas del panel de administración del catálogo.
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../../lib/api.js';
import { etiquetaDe, useApi, useReferencias } from '../../lib/hooks.js';
import { fechaYHora } from '../../lib/formato.js';

// Qué lista de /api/referencias tiene las etiquetas de cada lista del esquema
const LISTA_REFERENCIA = {
  combustible: 'combustibles', transmision: 'transmisiones', traccion: 'tracciones', aspiracion: 'aspiraciones',
  tipo_pieza: 'tipos_pieza', estado_mercado: 'estados_mercado', segmento: 'segmentos', segmento_marca: 'segmentos',
  estado_verificacion: 'estados_verificacion', tiempos: 'tiempos', alimentacion: 'alimentaciones', rubro: 'rubros',
};

const TEXTOS_LISTA = {
  confianza: { alta: 'Alta', media: 'Media', baja: 'Baja' },
  tipo_fuente: {
    oficial: 'Oficial (gobierno, registro)', fabricante_vehiculos: 'Fabricante de vehículos', fabricante_repuestos: 'Fabricante de repuestos',
    proveedor: 'Proveedor / distribuidor', catalogo_aftermarket: 'Catálogo aftermarket', datos_abiertos: 'Datos abiertos',
    manual: 'Carga manual', demo: 'Demostración',
  },
  tipo_equivalencia: { equivalente: 'Equivalente', reemplaza: 'Reemplaza a', reemplazado_por: 'Reemplazado por' },
};

/** Texto visible de un valor de una lista cerrada. */
export function useEtiquetaLista() {
  const referencias = useReferencias();
  return (lista, valor) => {
    if (valor === null || valor === undefined || valor === '') return '';
    if (TEXTOS_LISTA[lista]?.[valor]) return TEXTOS_LISTA[lista][valor];
    return LISTA_REFERENCIA[lista] ? etiquetaDe(referencias, LISTA_REFERENCIA[lista], valor) : valor;
  };
}

/** Esquema del panel (entidades, campos, listas, columnas importables). Se pide una vez. */
let esquemaCache = null;
export function useEsquema() {
  const { datos, error } = useApi(esquemaCache ? null : '/admin/esquema');
  if (datos) esquemaCache = datos;
  return { esquema: esquemaCache, error };
}

export function useFuentes() {
  return useApi('/admin/fuentes-lista');
}

/** Valor de una celda de tabla: fechas, booleanos y números legibles. */
export function formatoCelda(columna, valor) {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (/_en$/.test(columna)) return fechaYHora(valor);
  if (typeof valor === 'number' && columna !== 'anio_desde' && columna !== 'anio_hasta') return valor.toLocaleString('es-AR');
  return String(valor);
}

/** Campo de referencia con autocompletado (marca, modelo, categoría...). */
export function CampoReferencia({ id, entidad, valor, etiquetaInicial, padre, alCambiar, requerido, deshabilitado }) {
  const [texto, setTexto] = useState(etiquetaInicial || '');
  const [opciones, setOpciones] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const temporizador = useRef(null);

  useEffect(() => setTexto(etiquetaInicial || ''), [etiquetaInicial]);

  const buscar = (q) => {
    setTexto(q);
    setAbierto(true);
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(async () => {
      try {
        setOpciones(await api(`/admin/opciones/${entidad}`, { query: { q, padre } }));
      } catch {
        setOpciones([]);
      }
    }, 250);
  };

  return (
    <div className="campo-ref">
      <input id={id} className="input" value={texto} disabled={deshabilitado} required={requerido && !valor} autoComplete="off"
        placeholder="Escribí para buscar…" onChange={(e) => buscar(e.target.value)} onFocus={() => buscar(texto)}
        onBlur={() => setTimeout(() => setAbierto(false), 150)} />
      {valor && !deshabilitado && (
        <button type="button" className="campo-ref__limpiar" aria-label="Quitar" onClick={() => { alCambiar(null, ''); setTexto(''); }}>
          <X size={14} />
        </button>
      )}
      {abierto && opciones.length > 0 && (
        <ul className="campo-ref__opciones" role="listbox">
          {opciones.map((o) => (
            <li key={o.id}>
              <button type="button" onMouseDown={(e) => e.preventDefault()}
                onClick={() => { alCambiar(o.id, o.etiqueta); setTexto(o.etiqueta); setAbierto(false); }}>
                {o.etiqueta} <small className="texto-gris">#{o.id}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Selector de fuente con el aviso de checklist incompleto. */
export function SelectorFuente({ id, valor, alCambiar, fuentes, sinDemo = false, vacio = 'Elegí la fuente…' }) {
  const lista = (fuentes || []).filter((f) => !sinDemo || f.tipo !== 'demo');
  const elegida = lista.find((f) => String(f.id) === String(valor));
  return (
    <>
      <select id={id} className="select" value={valor || ''} onChange={(e) => alCambiar(e.target.value)}>
        <option value="">{vacio}</option>
        {lista.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
      </select>
      {elegida && !(elegida.terminos_revisados && elegida.licencia_verificada) && (
        <small className="texto-ambar">Esta fuente no tiene revisados los términos y la licencia.</small>
      )}
    </>
  );
}

export const ESTADOS_IMPORTACION = {
  en_proceso: { texto: 'En proceso', tono: 'azul' },
  completada: { texto: 'Completada', tono: 'verde' },
  completada_con_errores: { texto: 'Con errores', tono: 'ambar' },
  fallida: { texto: 'Fallida', tono: 'rojo' },
  validada: { texto: 'Solo validación', tono: 'violeta' },
};

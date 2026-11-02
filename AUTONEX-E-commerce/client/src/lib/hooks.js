import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';

/**
 * Carga datos de la API. Vuelve a pedir cuando cambia `clave`.
 * Devuelve { datos, error, cargando, recargar, setDatos }.
 */
export function useApi(ruta, opciones = {}, clave = ruta) {
  const [estado, setEstado] = useState({ datos: null, error: null, cargando: Boolean(ruta) });
  const opcionesRef = useRef(opciones);
  opcionesRef.current = opciones;
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!ruta) {
      setEstado({ datos: null, error: null, cargando: false });
      return undefined;
    }
    const control = new AbortController();
    setEstado((e) => ({ ...e, cargando: true, error: null }));
    api(ruta, { ...opcionesRef.current, signal: control.signal })
      .then((datos) => setEstado({ datos, error: null, cargando: false }))
      .catch((error) => {
        if (error.name !== 'AbortError') setEstado({ datos: null, error, cargando: false });
      });
    return () => control.abort();
  }, [ruta, clave, version]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  const setDatos = useCallback((fn) => setEstado((e) => ({ ...e, datos: typeof fn === 'function' ? fn(e.datos) : fn })), []);
  return { ...estado, recargar, setDatos };
}

/** Dato que casi no cambia: se pide una sola vez por sesión y se comparte entre componentes. */
function datoCompartido(ruta, inicial) {
  let cache = null;
  let promesa = null;
  return function useDato() {
    const [valor, setValor] = useState(cache || inicial);
    useEffect(() => {
      if (cache) return;
      promesa ??= api(ruta).then((d) => {
        cache = d;
        return d;
      });
      promesa.then(setValor).catch(() => {
        promesa = null;
      });
    }, []);
    return valor;
  };
}

/** Árbol de categorías (lista plana con padre_id y nivel). */
export const useCategorias = datoCompartido('/categorias', []);

/**
 * Listas de referencia de la API (provincias, transportistas, estados de verificación, combustibles, tipos de
 * vehículo...). La interfaz no tiene listas escritas a mano: todo sale de acá.
 */
export const useReferencias = datoCompartido('/referencias', null);

/** Etiqueta de un valor de una lista de referencias ("diesel" -> "Diésel"). */
export function etiquetaDe(referencias, lista, valor) {
  if (!valor) return '';
  return referencias?.[lista]?.find((x) => x.valor === valor)?.etiqueta ?? valor;
}

export const categoriasRaiz = (categorias) => categorias.filter((c) => !c.padre_id);

/** Cierra un menú/desplegable al hacer clic afuera o apretar Escape. */
export function useClickAfuera(abierto, cerrar) {
  const ref = useRef(null);
  useEffect(() => {
    if (!abierto) return undefined;
    const alClic = (e) => {
      if (ref.current && !ref.current.contains(e.target)) cerrar();
    };
    const alTecla = (e) => {
      if (e.key === 'Escape') cerrar();
    };
    document.addEventListener('mousedown', alClic);
    document.addEventListener('keydown', alTecla);
    return () => {
      document.removeEventListener('mousedown', alClic);
      document.removeEventListener('keydown', alTecla);
    };
  }, [abierto, cerrar]);
  return ref;
}

export function useTitulo(titulo) {
  useEffect(() => {
    document.title = titulo ? `${titulo} · AUTONEX` : 'AUTONEX · Repuestos para tu auto';
  }, [titulo]);
}

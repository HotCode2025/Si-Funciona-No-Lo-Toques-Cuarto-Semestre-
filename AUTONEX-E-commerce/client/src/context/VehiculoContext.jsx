import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';

// v2: los vehículos ahora son los del registro automotor (ids nuevos); lo guardado con la v1 no sirve.
const CLAVE = 'autonex.vehiculo.v2';
const VehiculoContext = createContext(null);

function leer() {
  try {
    localStorage.removeItem('autonex.vehiculo'); // vehículo guardado con la v1 (ids viejos)
    const guardado = JSON.parse(localStorage.getItem(CLAVE));
    return guardado?.id ? guardado : null;
  } catch {
    return null;
  }
}

/**
 * "Mi vehículo": se guarda en el navegador y filtra todo el catálogo.
 * Forma: { id, marca, modelo, anio, version, motor }
 */
export function VehiculoProvider({ children }) {
  const [vehiculo, setVehiculo] = useState(leer);
  const [selectorAbierto, setSelectorAbierto] = useState(false);
  const [marcaInicial, setMarcaInicial] = useState(null);

  const elegir = useCallback((nuevo) => {
    setVehiculo(nuevo);
    try {
      if (nuevo) localStorage.setItem(CLAVE, JSON.stringify(nuevo));
      else localStorage.removeItem(CLAVE);
      localStorage.removeItem('autonex.vehiculo'); // clave de la v1
    } catch {
      /* sin localStorage */
    }
  }, []);

  // Al abrir la tienda se confirma que el vehículo guardado sigue existiendo con la misma marca y modelo
  // (si se recargó el catálogo, el id puede apuntar a otro vehículo o a ninguno).
  useEffect(() => {
    if (!vehiculo?.id) return;
    api(`/vehiculos/${vehiculo.id}`)
      .then((v) => {
        if (v.marca?.nombre !== vehiculo.marca || v.modelo?.nombre !== vehiculo.modelo) elegir(null);
      })
      .catch((e) => {
        if (e.status === 404 || e.status === 400) elegir(null);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const valor = useMemo(() => ({
    vehiculo,
    elegir,
    quitar: () => elegir(null),
    selectorAbierto,
    marcaInicial,
    /** Abre el selector; opcionalmente con una marca ya elegida ({ id, nombre }). */
    abrirSelector: (marca = null) => {
      setMarcaInicial(marca?.id ? marca : null);
      setSelectorAbierto(true);
    },
    cerrarSelector: () => setSelectorAbierto(false),
  }), [vehiculo, elegir, selectorAbierto, marcaInicial]);

  return <VehiculoContext.Provider value={valor}>{children}</VehiculoContext.Provider>;
}

export const useVehiculo = () => useContext(VehiculoContext);

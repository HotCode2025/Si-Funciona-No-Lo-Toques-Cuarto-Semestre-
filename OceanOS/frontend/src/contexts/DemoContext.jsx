import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { reiniciarDemo } from '../services/demo/servidor.js';
import { ORG_POR_DEFECTO } from '../services/demo/semilla.js';

/**
 * Reemplaza a la sesión mientras el sitio está en modo demostración.
 *
 * No hay login: la app ciudadana siempre la usa la misma persona de
 * ejemplo, y el panel deja elegir cualquiera de las organizaciones, como
 * haría un admin. Lo que sí se conserva es la forma de `user`, así las
 * páginas que antes leían la sesión siguen funcionando igual.
 */
const Contexto = createContext(null);
const CLAVE_ORG = 'oceanos-demo-org';

function leerOrg() {
  try { return sessionStorage.getItem(CLAVE_ORG) ?? ORG_POR_DEFECTO; } catch { return ORG_POR_DEFECTO; }
}

export function DemoProvider({ children }) {
  const [user, setUser] = useState(null);
  const [organizaciones, setOrganizaciones] = useState([]);
  const [orgId, setOrgIdEstado] = useState(leerOrg);
  const [cargando, setCargando] = useState(true);
  // Se incrementa al reiniciar la demo. App lo usa como `key` para que
  // todas las pantallas se vuelvan a montar y pidan los datos de nuevo.
  const [version, setVersion] = useState(0);

  const refrescar = useCallback(async () => {
    const { user: u } = await api.get('/demo/persona');
    setUser(u);
    return u;
  }, []);

  useEffect(() => {
    Promise.all([refrescar(), api.get('/demo/organizaciones')])
      .then(([, { organizaciones: lista }]) => setOrganizaciones(lista))
      .finally(() => setCargando(false));
  }, [refrescar]);

  const setOrgId = (id) => {
    setOrgIdEstado(id);
    try { sessionStorage.setItem(CLAVE_ORG, id); } catch { /* sin almacenamiento, solo dura hasta recargar */ }
  };

  /** Vuelve a los datos de ejemplo. Pregunta antes, porque borra lo hecho. */
  const reiniciar = async () => {
    const seguro = window.confirm(
      '¿Volver a los datos de ejemplo?\n\nSe borran los reportes, votos, canjes, proyectos y reservas que hiciste en esta demo.',
    );
    if (!seguro) return false;
    reiniciarDemo();
    await refrescar();
    setVersion((v) => v + 1);
    return true;
  };

  const org = organizaciones.find((o) => o.id === orgId) ?? organizaciones[0] ?? null;

  return (
    <Contexto.Provider value={{ user, refrescar, cargando, organizaciones, org, setOrgId, reiniciar, version }}>
      {children}
    </Contexto.Provider>
  );
}

export const useDemo = () => {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useDemo tiene que usarse dentro de <DemoProvider>');
  return ctx;
};

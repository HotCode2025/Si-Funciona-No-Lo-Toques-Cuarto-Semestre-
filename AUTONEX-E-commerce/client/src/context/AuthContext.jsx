import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, guardarToken, leerToken } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(Boolean(leerToken()));

  const cerrarSesion = useCallback(() => {
    guardarToken(null);
    setUsuario(null);
  }, []);

  // Si hay un token guardado, recupera el usuario al abrir la página.
  useEffect(() => {
    if (!leerToken()) return;
    api('/auth/yo')
      .then(setUsuario)
      .catch(() => cerrarSesion())
      .finally(() => setCargando(false));
  }, [cerrarSesion]);

  useEffect(() => {
    const alVencer = () => cerrarSesion();
    window.addEventListener('autonex:sesion-vencida', alVencer);
    return () => window.removeEventListener('autonex:sesion-vencida', alVencer);
  }, [cerrarSesion]);

  const iniciarSesion = useCallback(async (email, password) => {
    const { token, usuario: u } = await api('/auth/login', { method: 'POST', body: { email, password } });
    guardarToken(token);
    setUsuario(u);
    return u;
  }, []);

  // Con la confirmación de email obligatoria, el registro no inicia la sesión: devuelve { requiere_confirmacion, email }
  const registrarse = useCallback(async (datos) => {
    const r = await api('/auth/registro', { method: 'POST', body: datos });
    if (r.token) {
      guardarToken(r.token);
      setUsuario(r.usuario);
    }
    return r;
  }, []);

  /** Guarda una sesión que vino de otro lado (confirmar el email, restablecer la contraseña). */
  const iniciarConToken = useCallback((token, u) => {
    guardarToken(token);
    setUsuario(u);
  }, []);

  const refrescar = useCallback(async () => {
    const u = await api('/auth/yo');
    setUsuario(u);
    return u;
  }, []);

  const valor = useMemo(() => ({
    usuario, cargando, iniciarSesion, registrarse, cerrarSesion, refrescar, iniciarConToken,
    esVendedor: usuario?.rol === 'vendedor',
  }), [usuario, cargando, iniciarSesion, registrarse, cerrarSesion, refrescar, iniciarConToken]);

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

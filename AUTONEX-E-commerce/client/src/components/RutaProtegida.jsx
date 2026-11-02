import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Cargando, Vacio } from './Estados.jsx';
import { Lock } from 'lucide-react';

/** Exige sesión iniciada (y opcionalmente un rol). Si no hay sesión manda a /ingresar y vuelve después. */
export default function RutaProtegida({ children, rol }) {
  const { usuario, cargando } = useAuth();
  const location = useLocation();

  if (cargando) return <div className="contenedor pagina"><Cargando texto="Verificando tu sesión…" /></div>;
  if (!usuario) {
    return <Navigate to="/ingresar" replace state={{ desde: `${location.pathname}${location.search}` }} />;
  }
  if (rol && usuario.rol !== rol) {
    return (
      <div className="contenedor pagina">
        <Vacio icono={Lock} titulo="No tenés acceso a esta sección">
          Esta sección es solo para {rol === 'admin' ? 'administradores del catálogo' : 'cuentas de vendedor'}.
        </Vacio>
      </div>
    );
  }
  return children;
}

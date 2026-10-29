import { Outlet, useLocation } from 'react-router-dom';
import NavPublica from '../components/layout/NavPublica.jsx';
import PiePagina from '../components/layout/PiePagina.jsx';
import ProgresoScroll from '../components/ui/ProgresoScroll.jsx';

export default function PublicoLayout() {
  const { pathname } = useLocation();
  return (
    <div className="flex min-h-dvh flex-col bg-abismo">
      <ProgresoScroll />
      <NavPublica />
      {/* key=pathname: cada ruta entra con su propia animación */}
      <main key={pathname} className="pagina-entra flex-1"><Outlet /></main>
      <PiePagina />
    </div>
  );
}

import { useCallback, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import BarraApp from '../components/layout/BarraApp.jsx';
import Splash from '../components/app/Splash.jsx';
import Bienvenida, { CLAVE_BIENVENIDA } from '../components/app/Bienvenida.jsx';
import CelebracionLogros from '../components/app/CelebracionLogros.jsx';
import { useDemo } from '../contexts/DemoContext.jsx';
import { Cargando } from '../components/ui/index.jsx';

// El splash aparece una vez por sesión (en la app instalada, una vez por apertura).
const CLAVE = 'oceanos-splash';
const yaVisto = () => { try { return sessionStorage.getItem(CLAVE) === '1'; } catch { return false; } };

export default function AppLayout() {
  const { cargando } = useDemo();
  const { pathname } = useLocation();
  const [splash, setSplash] = useState(() => !yaVisto());
  const terminar = useCallback(() => {
    try { sessionStorage.setItem(CLAVE, '1'); } catch { /* sin almacenamiento: se muestra de nuevo */ }
    setSplash(false);
  }, []);

  const [bienvenida, setBienvenida] = useState(() => { try { return localStorage.getItem(CLAVE_BIENVENIDA) !== '1'; } catch { return true; } });

  if (cargando) return <div className="grid min-h-dvh place-items-center"><Cargando /></div>;

  // En teléfono va en bloque (barra arriba, contenido, barra abajo); desde
  // lg es una fila con la barra lateral.
  return (
    <div className="min-h-dvh bg-abismo lg:flex">
      {splash && <Splash onFin={terminar} />}
      {!splash && bienvenida && <Bienvenida onFin={() => setBienvenida(false)} />}
      <CelebracionLogros activa={!splash && !bienvenida} />
      <BarraApp />
      <main key={pathname} className="pagina-entra min-w-0 flex-1 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] lg:pb-0"><Outlet /></main>
    </div>
  );
}

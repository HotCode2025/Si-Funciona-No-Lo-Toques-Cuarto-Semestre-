import { Outlet } from 'react-router-dom';
import BarraApp from '../components/layout/BarraApp.jsx';
import { useDemo } from '../contexts/DemoContext.jsx';
import { Cargando } from '../components/ui/index.jsx';

export default function AppLayout() {
  const { cargando } = useDemo();
  if (cargando) return <div className="grid min-h-dvh place-items-center"><Cargando /></div>;

  // En teléfono va en bloque (barra arriba, contenido, barra abajo); desde
  // lg es una fila con la barra lateral.
  return (
    <div className="min-h-dvh bg-abismo lg:flex">
      <BarraApp />
      <main className="min-w-0 flex-1 pb-20 lg:pb-0"><Outlet /></main>
    </div>
  );
}

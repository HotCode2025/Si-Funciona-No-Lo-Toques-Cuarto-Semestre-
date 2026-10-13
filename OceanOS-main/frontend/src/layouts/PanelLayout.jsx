import { Outlet } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, Radio, Workflow } from 'lucide-react';
import BarraApp from '../components/layout/BarraApp.jsx';
import { useDemo } from '../contexts/DemoContext.jsx';
import { Cargando } from '../components/ui/index.jsx';

const ENLACES_PANEL = [
  { to: '/panel',           icono: LayoutDashboard, label: 'Resumen', exacto: true },
  { to: '/panel/proyectos', icono: FolderKanban,    label: 'Proyectos' },
  { to: '/panel/sensores',  icono: Radio,           label: 'Sensores' },
  { to: '/panel/automatizaciones', icono: Workflow, label: 'Automatizaciones' },
];

export default function PanelLayout() {
  const { cargando, org } = useDemo();
  if (cargando || !org) return <div className="grid min-h-dvh place-items-center"><Cargando /></div>;

  return (
    <div className="min-h-dvh bg-abismo lg:flex">
      <BarraApp enlaces={ENLACES_PANEL} titulo="Panel de organización" panel />
      <main className="min-w-0 flex-1 pb-20 lg:pb-0"><Outlet /></main>
    </div>
  );
}

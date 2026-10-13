import { Outlet } from 'react-router-dom';
import NavPublica from '../components/layout/NavPublica.jsx';
import PiePagina from '../components/layout/PiePagina.jsx';

export default function PublicoLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-abismo">
      <NavPublica />
      <main className="flex-1"><Outlet /></main>
      <PiePagina />
    </div>
  );
}

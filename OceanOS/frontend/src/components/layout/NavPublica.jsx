import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Download } from 'lucide-react';
import { Marca } from '../marca/Logo.jsx';
import { Boton } from '../ui/index.jsx';

const enlaces = [
  { to: '/ecosistema', label: 'Estado del océano' },
  { to: '/mercado',    label: 'Activos' },
];

// Transparente sobre el hero; al bajar se vuelve vidrio con sombra.
export default function NavPublica() {
  const [scroll, setScroll] = useState(0);
  useEffect(() => {
    const al = () => setScroll(scrollY > 24 ? 1 : 0);
    al();
    addEventListener('scroll', al, { passive: true });
    return () => removeEventListener('scroll', al);
  }, []);

  return (
    <header data-scroll={scroll}
      className="nav-publica sticky top-0 z-30 flex items-center justify-between gap-6 border-b border-columna/45 bg-abismo/80 px-5 py-3.5 text-carta backdrop-blur-md lg:px-10">
      <Link to="/" aria-label="OceanOS, inicio"><Marca tamaño={32} animado /></Link>

      <nav className="flex items-center gap-1 sm:gap-6">
        {enlaces.map((e) => (
          <NavLink key={e.to} to={e.to}
            className={({ isActive }) => `enlace-nav hidden text-sm sm:block ${isActive ? 'activo' : 'opacity-80 hover:opacity-100'}`}>
            {e.label}
          </NavLink>
        ))}
        <Link to="/#descargar" className="enlace-nav hidden items-center gap-1.5 text-sm opacity-80 hover:opacity-100 md:inline-flex">
          <Download size={14} /> App
        </Link>
        <Link to="/funciones">
          <Boton variante="kelp" className="py-2">
            <span className="sm:hidden">Funciones</span>
            <span className="hidden sm:inline">Ver todas las funciones</span>
          </Boton>
        </Link>
      </nav>
    </header>
  );
}

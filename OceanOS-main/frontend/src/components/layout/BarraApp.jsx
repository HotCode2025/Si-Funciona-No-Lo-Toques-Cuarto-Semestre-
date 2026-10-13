import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { Map, PlusCircle, Wallet, CheckSquare, User, LayoutGrid, RotateCcw, ArrowLeftRight } from 'lucide-react';
import { Marca } from '../marca/Logo.jsx';
import { Selector } from '../ui/index.jsx';
import { useDemo } from '../../contexts/DemoContext.jsx';
import { numero, TIPO_ORG } from '../../utils/format.js';

const ENLACES_APP = [
  { to: '/app',            icono: Map,         label: 'Mapa',    exacto: true },
  { to: '/app/reportar',   icono: PlusCircle,  label: 'Reportar' },
  { to: '/app/verificar',  icono: CheckSquare, label: 'Verificar' },
  { to: '/app/billetera',  icono: Wallet,      label: 'Billetera' },
  { to: '/app/perfil',     icono: User,        label: 'Perfil' },
];

/**
 * Barra lateral en escritorio; en teléfono, una barra arriba para volver
 * al inicio y otra abajo con las secciones.
 *
 * Como en la demo no hay sesión, el pie de la barra no es "Salir": son los
 * saltos que necesita quien recorre el producto entero — pasar de una capa
 * a la otra, volver a la lista de funciones y reiniciar los datos.
 */
export default function BarraApp({ enlaces = ENLACES_APP, titulo = 'App ciudadana', panel = false }) {
  const { user, organizaciones, org, setOrgId, reiniciar } = useDemo();
  const navegar = useNavigate();
  const { pathname } = useLocation();

  const cambiarOrg = (id) => {
    setOrgId(id);
    // Un proyecto es de una sola organización: si estaba abierto el
    // detalle de otro, se vuelve a la lista en vez de mostrar un 404.
    if (pathname.startsWith('/panel/proyectos/')) navegar('/panel/proyectos');
  };

  const clase = ({ isActive }) =>
    `flex items-center gap-3 rounded-carta px-3 py-2 text-sm transition-colors ${
      isActive ? 'bg-columna/50 text-carta' : 'text-sonda hover:bg-columna/25 hover:text-carta'}`;
  const claseSalto = clase({ isActive: false });

  const otraCapa = panel
    ? { to: '/app', label: 'App ciudadana' }
    : { to: '/panel', label: 'Panel de organizaciones' };

  const selectorOrg = (
    <Selector value={org?.id ?? ''} onChange={(ev) => cambiarOrg(ev.target.value)} aria-label="Organización">
      {organizaciones.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
    </Selector>
  );

  return (
    <>
      {/* ---------- Escritorio ---------- */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col overflow-y-auto border-r border-columna bg-abismo p-4 lg:flex">
        <Link to="/" className="mb-1 px-1"><Marca tamaño={26} /></Link>
        <p className="mb-5 px-1 text-xs text-sonda/70">{titulo}</p>

        {panel ? (
          <div className="mb-5 px-1">
            <p className="mb-1.5 text-xs text-sonda">Organización</p>
            {selectorOrg}
            {org && <p className="mt-1.5 text-xs text-sonda/70">{TIPO_ORG[org.kind]}</p>}
          </div>
        ) : (
          <div className="mb-5 rounded-carta border border-columna px-3 py-2.5">
            <p className="text-xs text-sonda">Estás usando la app como</p>
            <p className="truncate text-sm font-500 text-carta">{user?.full_name}</p>
            <p className="cifra text-xs text-kelp">{numero(user?.balance_okn)} OKN</p>
          </div>
        )}

        <nav className="flex-1 space-y-1">
          {enlaces.map(({ to, icono: Icono, label, exacto }) => (
            <NavLink key={to} to={to} end={exacto} className={clase}>
              <Icono size={17} /> {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-6 space-y-1 border-t border-columna pt-3">
          <Link to={otraCapa.to} className={claseSalto}>
            <ArrowLeftRight size={17} /> {otraCapa.label}
          </Link>
          <Link to="/funciones" className={claseSalto}>
            <LayoutGrid size={17} /> Todas las funciones
          </Link>
          <button onClick={reiniciar} className={`w-full ${claseSalto}`}>
            <RotateCcw size={17} /> Reiniciar datos
          </button>
        </div>
      </aside>

      {/* ---------- Teléfono: arriba ---------- */}
      <header className="sticky top-0 z-30 border-b border-columna bg-abismo/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" aria-label="OceanOS, inicio"><Marca tamaño={22} /></Link>
          <div className="flex items-center gap-4 text-xs text-sonda">
            <Link to={otraCapa.to} className="hover:text-carta">{panel ? 'App' : 'Panel'}</Link>
            <Link to="/funciones" className="hover:text-carta">Funciones</Link>
          </div>
        </div>
        {panel && <div className="mt-2">{selectorOrg}</div>}
      </header>

      {/* ---------- Teléfono: abajo ---------- */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-columna bg-abismo lg:hidden">
        {enlaces.map(({ to, icono: Icono, label, exacto }) => (
          <NavLink key={to} to={to} end={exacto}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] ${
                isActive ? 'text-kelp' : 'text-sonda'}`}>
            <Icono size={19} /> {label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}

export { ENLACES_APP };

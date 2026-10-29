import { Link } from 'react-router-dom';
import { Camera, CheckSquare, Coins, LayoutDashboard, Map as MapIcon, Sparkles, User, Wallet, Waves } from 'lucide-react';
import { useDemo } from '../../contexts/DemoContext.jsx';
import FondoAmbiente from '../../components/media/FondoAmbiente.jsx';
import Presentacion from '../../components/media/Presentacion.jsx';
import Contador from '../../components/ui/Contador.jsx';
import { numero } from '../../utils/format.js';

const ACCIONES = [
  { to: '/app/reportar',  icono: Camera,          titulo: 'Reportar con foto',  texto: 'Sacá una foto y la IA te ayuda a identificar qué viste', color: 'var(--color-kelp)', destacado: true },
  { to: '/app',           icono: MapIcon,         titulo: 'Mapa en vivo',       texto: 'Lo que se reportó hoy en tu zona',  color: 'var(--color-alga)' },
  { to: '/app/verificar', icono: CheckSquare,     titulo: 'Verificar',          texto: 'Votá reportes y sumá OKN',          color: 'var(--color-tiburon)' },
  { to: '/app/billetera', icono: Wallet,          titulo: 'Billetera',          texto: 'Tu saldo y movimientos',            color: 'var(--color-kelp)' },
  { to: '/app/tokens',    icono: Coins,           titulo: 'Tokens y rachas',    texto: 'Cómo se ganan los OKN',             color: 'var(--color-kelp-alto)' },
  { to: '/app/ia',        icono: Sparkles,        titulo: 'Cómo aprende la IA', texto: 'Qué sabe y cómo mejora',            color: 'var(--color-sonda)' },
  { to: '/ecosistema',    icono: Waves,           titulo: 'Estado del océano',  texto: 'Salud de cada zona',                color: 'var(--color-alga)' },
  { to: '/app/perfil',    icono: User,            titulo: 'Mi perfil',          texto: 'Tu actividad y reputación',         color: 'var(--color-sonda)' },
  { to: '/panel',         icono: LayoutDashboard, titulo: 'Panel para organizaciones', texto: 'Proyectos, sensores y carbono', color: 'var(--color-tiburon)', ancho: true },
];

/** Pantalla de inicio de la app: todo lo que se puede hacer, a un toque, sobre el video de fondo. */
export default function Menu() {
  const { user } = useDemo();
  const h = new Date().getHours();
  const saludo = h < 6 ? 'Buenas noches' : h < 13 ? 'Buen día' : h < 20 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <div className="relative isolate min-h-full">
      <div className="fixed inset-0 -z-10"><FondoAmbiente /></div>

      <div className="mx-auto max-w-2xl px-5 py-7 lg:px-8">
        <header className="animar-flotar">
          <p className="text-xs tracking-widest text-kelp-alto uppercase">{saludo}</p>
          <h1 className="mt-1 font-display text-3xl font-600 text-carta">{user?.full_name?.split(' ')[0] ?? 'Bienvenido'}</h1>
          <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-carta/85">
            {user?.balance_okn != null && (
              <Link to="/app/billetera" className="vidrio inline-flex items-center gap-1.5 rounded-full px-3 py-1 transition-colors hover:border-kelp/60">
                <Contador valor={user.balance_okn} formato={(x) => numero(x)} className="cifra font-600 text-kelp-alto" /> OKN
              </Link>
            )}
            {user?.streak_days > 0 && <span className="vidrio rounded-full px-3 py-1">racha de {user.streak_days} {user.streak_days === 1 ? 'día' : 'días'}</span>}
          </p>
        </header>

        <h2 className="mt-8 font-display text-lg font-600 text-carta">¿Qué querés hacer?</h2>
        <nav aria-label="Menú de la app" className="mt-3 grid grid-cols-2 gap-3">
          {ACCIONES.map((a, i) => {
            const Icono = a.icono;
            return (
              <Link key={a.to} to={a.to} style={{ animationDelay: `${120 + i * 55}ms` }}
                className={`menu-tile animar-flotar vidrio group relative flex flex-col gap-3 overflow-hidden rounded-2xl p-4 text-carta ${a.destacado || a.ancho ? 'col-span-2' : ''} ${a.destacado ? 'menu-destacado' : ''}`}>
                <span className="grid h-11 w-11 place-items-center rounded-xl transition-transform duration-500 group-hover:scale-110"
                      style={{ background: `color-mix(in srgb, ${a.color} 22%, transparent)`, color: a.color }}>
                  <Icono size={22} />
                </span>
                <span>
                  <span className="block font-display text-[1.05rem] leading-tight font-600">{a.titulo}</span>
                  <span className="mt-1 block text-[13px] leading-snug text-carta/70">{a.texto}</span>
                </span>
              </Link>
            );
          })}
        </nav>

        <h2 className="mt-10 mb-3 font-display text-lg font-600 text-carta">Mirá cómo funciona</h2>
        <div className="animar-flotar retraso-4"><Presentacion /></div>
      </div>
    </div>
  );
}

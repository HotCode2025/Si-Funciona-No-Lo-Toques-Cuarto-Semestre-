import { useEffect, useMemo, useRef, useState } from 'react';
import { useDemo } from '../../contexts/DemoContext.jsx';
import { calcularLogros } from '../../utils/logros.js';

const CLAVE = 'oceanos-logros-vistos';
const leer = () => { try { const s = localStorage.getItem(CLAVE); return s === null ? null : JSON.parse(s); } catch { return null; } };
const guardar = (v) => { try { localStorage.setItem(CLAVE, JSON.stringify(v)); } catch { /* sin almacenamiento: se festeja de nuevo */ } };
const COLORES = ['var(--color-kelp)', 'var(--color-kelp-alto)', 'var(--color-alga)', 'var(--color-sonda)', 'var(--color-tiburon)'];

/**
 * Festeja cada logro nuevo, una sola vez. La primera vez que se abre la app solo se
 * registran los que ya estaban, para no festejar de golpe todo el historial.
 */
export default function CelebracionLogros({ activa }) {
  const { user } = useDemo();
  const [cola, setCola] = useState([]);
  const boton = useRef(null);

  useEffect(() => {
    if (!user) return;
    const logrados = calcularLogros(user).filter((l) => l.logrado).map((l) => l.id);
    const vistos = leer();
    if (vistos === null) { guardar(logrados); return; }
    const nuevos = logrados.filter((id) => !vistos.includes(id));
    // Se descartan los que ya no están logrados (p. ej. tras reiniciar la demo) para poder festejarlos otra vez.
    guardar([...vistos.filter((id) => logrados.includes(id)), ...nuevos]);
    if (nuevos.length) setCola((c) => [...c, ...nuevos.filter((id) => !c.includes(id))]);
  }, [user]);

  const actual = cola[0] ? calcularLogros(user).find((l) => l.id === cola[0]) : null;
  const confeti = useMemo(() => Array.from({ length: 30 }, (_, i) => ({
    x: Math.round((Math.random() - 0.5) * 340), y: -Math.round(80 + Math.random() * 190), r: Math.round(Math.random() * 540 - 270),
    d: Math.round(Math.random() * 280), c: COLORES[i % COLORES.length], w: 5 + Math.round(Math.random() * 5),
  })), [cola[0]]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (activa && actual) boton.current?.focus(); }, [activa, actual]);
  useEffect(() => {
    if (!activa || !actual) return undefined;
    const t = setTimeout(() => setCola((c) => c.slice(1)), 7000);
    return () => clearTimeout(t);
  }, [activa, actual]);

  if (!activa || !actual) return null;
  const Icono = actual.icono;
  return (
    <div role="dialog" aria-modal="true" aria-label="Logro desbloqueado" onClick={() => setCola((c) => c.slice(1))}
         className="logro-fondo fixed inset-0 z-[90] grid place-items-center bg-abismo/85 p-6 backdrop-blur-md">
      <div className="relative text-center" onClick={(e) => e.stopPropagation()}>
        <div className="confeti" aria-hidden="true">
          {confeti.map((p, i) => (
            <i key={i} style={{ '--x': `${p.x}px`, '--y': `${p.y}px`, '--r': `${p.r}deg`, animationDelay: `${p.d}ms`, background: p.c, width: p.w, height: p.w * 1.8 }} />
          ))}
        </div>
        <span className="logro-medalla relative mx-auto grid h-28 w-28 place-items-center rounded-full bg-kelp/20 text-kelp-alto">
          <Icono size={52} />
        </span>
        <p className="logro-texto mt-6 text-xs tracking-widest text-kelp-alto uppercase" style={{ animationDelay: '.35s' }}>¡Logro desbloqueado!</p>
        <h2 className="logro-texto mt-2 font-display text-3xl font-600 text-carta" style={{ animationDelay: '.45s' }}>{actual.titulo}</h2>
        <p className="logro-texto mt-2 max-w-xs text-sonda" style={{ animationDelay: '.55s' }}>{actual.texto}</p>
        <button ref={boton} type="button" onClick={() => setCola((c) => c.slice(1))}
                className="logro-texto mt-8 rounded-full bg-kelp px-8 py-2.5 font-500 text-abismo transition-transform hover:scale-105 active:scale-95" style={{ animationDelay: '.7s' }}>
          {cola.length > 1 ? `Siguiente (${cola.length - 1} más)` : 'Seguir'}
        </button>
      </div>
    </div>
  );
}

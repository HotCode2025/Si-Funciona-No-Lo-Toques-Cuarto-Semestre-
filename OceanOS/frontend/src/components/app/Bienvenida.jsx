import { useEffect, useRef, useState } from 'react';
import { Camera, Coins, MapPin, Waves } from 'lucide-react';
import Logo from '../marca/Logo.jsx';
import FondoAmbiente from '../media/FondoAmbiente.jsx';

export const CLAVE_BIENVENIDA = 'oceanos-bienvenida';

const PASOS = [
  { icono: Waves, titulo: 'Sé los ojos del océano',
    texto: 'Reportá un avistaje o una mancha de cachiyuyo en un toque, aunque no sepas el nombre de la especie. Entre todos medimos lo que nadie está midiendo.' },
  { icono: Camera, titulo: 'Cámara y ubicación, solo cuando las usás',
    texto: 'Te pedimos la cámara para sacar la foto y la ubicación para marcar el punto en el mapa, y solo cuando tocás esos botones. Si subís una foto, se guarda sin la ubicación del archivo para ayudar a que la IA aprenda.',
    chips: [[Camera, 'Cámara: para la foto'], [MapPin, 'Ubicación: para el mapa']] },
  { icono: Coins, titulo: 'Cada reporte suma',
    texto: 'Los reportes que la comunidad verifica se pagan en tokens OKN, y a medida que participás desbloqueás logros.' },
];

/** Tres pantallas la primera vez que se abre la app: qué hace, para qué pide permisos y qué se gana. */
export default function Bienvenida({ onFin }) {
  const [i, setI] = useState(0);
  const toque = useRef(null);
  const ultimo = i === PASOS.length - 1;
  const p = PASOS[i]; const Icono = p.icono;
  const terminar = () => { try { localStorage.setItem(CLAVE_BIENVENIDA, '1'); } catch { /* se mostrará otra vez */ } onFin(); };
  const mover = (d) => setI((n) => Math.max(0, Math.min(PASOS.length - 1, n + d)));

  useEffect(() => {
    const tecla = (e) => { if (e.key === 'ArrowRight') mover(1); else if (e.key === 'ArrowLeft') mover(-1); else if (e.key === 'Escape') terminar(); };
    addEventListener('keydown', tecla); return () => removeEventListener('keydown', tecla);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div role="dialog" aria-modal="true" aria-label="Bienvenida" className="fixed inset-0 z-[95] flex flex-col bg-abismo text-carta"
         style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), var(--safe-area-inset-top, 0px))', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px))' }}
         onTouchStart={(e) => { toque.current = e.touches[0].clientX; }}
         onTouchEnd={(e) => { if (toque.current == null) return; const dx = e.changedTouches[0].clientX - toque.current; if (Math.abs(dx) > 50) mover(dx < 0 ? 1 : -1); toque.current = null; }}>
      <FondoAmbiente oscuridad={0.6} />
      <div className="relative z-10 flex items-center justify-between px-6 pt-5">
        <Logo tamaño={34} animado />
        {!ultimo && <button type="button" onClick={terminar} className="rounded-full px-3 py-1.5 text-sm text-sonda transition-colors hover:text-carta">Saltar</button>}
      </div>

      <div key={i} className="paso-entra relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-8 text-center">
        <span className="bienvenida-icono relative grid h-28 w-28 place-items-center rounded-full bg-kelp/15 text-kelp-alto"><Icono size={50} /></span>
        <h2 className="mt-8 font-display text-[1.75rem] leading-tight font-600">{p.titulo}</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-carta/80">{p.texto}</p>
        {p.chips && (
          <ul className="mt-5 flex flex-wrap justify-center gap-2">
            {p.chips.map(([C, t]) => <li key={t} className="vidrio inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm"><C size={14} className="text-kelp-alto" /> {t}</li>)}
          </ul>
        )}
      </div>

      <div className="relative z-10 px-6 pb-8">
        <div className="mb-5 flex justify-center gap-2" role="tablist" aria-label="Pasos">
          {PASOS.map((_, n) => (
            <button key={n} type="button" role="tab" aria-selected={n === i} aria-label={`Paso ${n + 1}`} onClick={() => setI(n)}
              className={`h-1.5 rounded-full transition-all duration-500 ${n === i ? 'w-8 bg-kelp-alto' : 'w-1.5 bg-sonda/50'}`} />
          ))}
        </div>
        <button type="button" onClick={() => (ultimo ? terminar() : mover(1))}
          className="btn-brillo mx-auto block w-full max-w-md rounded-full bg-kelp py-3 text-base font-600 text-abismo transition-transform active:scale-[.98]">
          {ultimo ? 'Empezar' : 'Siguiente'}
        </button>
      </div>
    </div>
  );
}

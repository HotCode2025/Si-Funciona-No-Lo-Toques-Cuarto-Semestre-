import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { PRESENTACIONES } from './Reel.jsx';

/** Reproductor con pestañas. Arranca con sonido al tocar (los videos tienen locución y texto), y se pausa al salir de pantalla. */
export default function Presentacion({ videos = PRESENTACIONES }) {
  const [k, setK] = useState(0);
  const [jugando, setJugando] = useState(false);
  const [empezo, setEmpezo] = useState(false);
  const ref = useRef(null);
  const v = videos[k];

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => { if (!e.isIntersecting) ref.current?.pause(); }, { threshold: 0.2 });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, [k]);

  const cambiar = (n) => { ref.current?.pause(); setK(n); setJugando(false); setEmpezo(false); };
  const reproducir = () => { setEmpezo(true); ref.current?.play().catch(() => {}); };

  return (
    <div>
      <div role="tablist" aria-label="Videos" className="mb-4 flex flex-wrap gap-2">
        {videos.map((x, n) => (
          <button key={x.id} role="tab" aria-selected={n === k} type="button" onClick={() => cambiar(n)}
            className={`rounded-full border px-4 py-1.5 text-sm transition-all duration-300 ${n === k ? 'border-kelp bg-kelp text-abismo font-600' : 'border-columna text-sonda hover:border-sonda hover:text-carta'}`}>
            {x.titulo} <span className="cifra text-xs opacity-70">{x.duracion}</span>
          </button>
        ))}
      </div>

      <div className="relative aspect-video overflow-hidden rounded-2xl border border-columna bg-hondo shadow-[0_40px_90px_-35px_rgb(0_0_0/.85)]">
        <video key={v.id} ref={ref} src={v.src} poster={v.poster} preload="none" playsInline controls={empezo}
               onPlay={() => setJugando(true)} onPause={() => setJugando(false)} onEnded={() => { setJugando(false); setEmpezo(false); }}
               className="h-full w-full object-cover" />
        {!jugando && !empezo && (
          <button type="button" onClick={reproducir} aria-label={`Reproducir: ${v.titulo}`}
            className="group absolute inset-0 grid place-items-center bg-abismo/25 transition-colors hover:bg-abismo/10">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-kelp text-abismo shadow-[0_0_0_10px_rgb(229_164_69/.18)] transition-transform duration-500 group-hover:scale-110 sm:h-20 sm:w-20">
              <Play size={26} className="ml-1" fill="currentColor" />
            </span>
          </button>
        )}
      </div>
      <p className="mt-3 text-sm text-sonda">{v.detalle}</p>
    </div>
  );
}

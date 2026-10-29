import { useEffect, useRef, useState } from 'react';
import Revelar from '../../components/ui/Revelar.jsx';

const TALLOS = 10;               // cada tallo = el 10 % del bosque de 1990
const ahora = new Date().getFullYear();

function Tallo({ perdido, d }) {
  return (
    <svg viewBox="0 0 60 160" className={`tallo ${perdido ? 'perdido' : 'vivo'} h-full w-full`} style={{ '--d': `${d}s` }} aria-hidden="true">
      <path d="M30 158C22 120 38 92 30 62S28 24 30 6" fill="none" stroke="var(--color-kelp)" strokeWidth="3" strokeLinecap="round" />
      <path d="M29 120C14 118 6 106 5 92c13 2 21 12 24 28Z" fill="var(--color-kelp-alto)" opacity=".92" />
      <path d="M31 92c15-2 23-14 24-28-13 2-21 12-24 28Z" fill="var(--color-kelp-alto)" opacity=".92" />
      <path d="M29.5 62C20 60 14 52 14 42c8 2 14 8 15.500 20Z" fill="var(--color-kelp-alto)" opacity=".85" />
      {[[28, 132], [32, 104], [29.5, 74], [30, 10]].map(([x, y]) => <circle key={y} cx={x} cy={y} r="3" fill="var(--color-carta)" />)}
    </svg>
  );
}

/**
 * 1990 -> hoy: el bosque se va apagando tallo a tallo mientras corren el año y el porcentaje.
 * Es una animación ILUSTRATIVA: el único dato es el del titular (90 % perdido desde 1990);
 * los valores intermedios son interpolación lineal, no mediciones.
 */
export default function BosquePerdido() {
  const ref = useRef(null);
  const [visto, setVisto] = useState(false);
  const [t, setT] = useState(0);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisto(true); io.disconnect(); } }, { threshold: 0.45 });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visto) return undefined;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setT(1); return undefined; }
    let raf; const t0 = performance.now() + 500;      // medio segundo de pausa antes de empezar
    const paso = (ahoraMs) => {
      const k = Math.max(0, Math.min(1, (ahoraMs - t0) / 5200));
      setT(k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2);   // easeInOutCubic
      if (k < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [visto]);

  const queda = 100 - 90 * t;                              // 100 -> 10
  const anio = Math.round(1990 + t * (ahora - 1990));

  return (
    <section ref={ref} aria-labelledby="bosque-titulo" className="relative overflow-hidden border-b border-columna bg-abismo px-5 py-20 text-carta lg:px-10">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-hondo/60 to-transparent" />
      <div className="relative mx-auto max-w-5xl">
        <Revelar>
          <p className="text-xs tracking-widest text-kelp-alto uppercase">1990 → hoy</p>
          <h2 id="bosque-titulo" className="mt-3 max-w-2xl font-display text-3xl leading-tight font-600 sm:text-4xl">
            Cada tallo es el 10 % del bosque que había
          </h2>
        </Revelar>

        <div className="mt-10 grid items-end gap-10 lg:grid-cols-[.8fr_1.2fr]">
          <div role="img" aria-label={`En ${anio}, queda cerca del ${Math.round(queda)} % del bosque de cachiyuyo de 1990`}>
            <p className="cifra font-display text-7xl leading-none font-600 text-kelp-alto sm:text-8xl">{Math.round(queda)}<span className="text-4xl">%</span></p>
            <p className="mt-2 text-lg text-sonda">del bosque de cachiyuyo sigue en pie</p>
            <p className="cifra mt-6 inline-flex items-center gap-3 rounded-full border border-columna px-4 py-1.5 text-sm text-carta/90">
              <span className="text-sonda">año</span> <b className="text-xl font-600">{t >= 1 ? 'hoy' : anio}</b>
            </p>
          </div>

          <div className="flex h-40 items-end gap-1 sm:h-52 sm:gap-2" aria-hidden="true">
            {Array.from({ length: TALLOS }, (_, k) => (
              <div key={k} className="h-full flex-1"><Tallo perdido={!(queda > k * 10)} d={k * 0.4} /></div>
            ))}
          </div>
        </div>
        <p className="mt-8 max-w-xl text-xs text-sonda/70">
          Animación ilustrativa a partir del dato central: el 90 % del bosque de cachiyuyo del Atlántico Sur desapareció desde 1990. Los valores intermedios son una interpolación, no mediciones.
        </p>
      </div>
    </section>
  );
}

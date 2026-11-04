import { useEffect, useRef, useState } from 'react';

/** Cuenta de 0 al valor cuando entra en pantalla (y cada vez que el dato cambia). */
export default function Contador({ valor, formato = String, duracion = 1600, className = '' }) {
  const ref = useRef(null);
  const [x, setX] = useState(0);
  const [visto, setVisto] = useState(false);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setVisto(true), io.disconnect()), { threshold: 0.4 });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visto || valor == null || Number.isNaN(Number(valor))) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setX(Number(valor)); return; }
    let raf; const t0 = performance.now(); const fin = Number(valor);
    const paso = (t) => {
      const k = Math.min(1, (t - t0) / duracion);
      setX(fin * (k === 1 ? 1 : 1 - 2 ** (-10 * k)));   // easeOutExpo
      if (k < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [visto, valor, duracion]);

  return <span ref={ref} className={className}>{valor == null ? formato(valor) : formato(x)}</span>;
}

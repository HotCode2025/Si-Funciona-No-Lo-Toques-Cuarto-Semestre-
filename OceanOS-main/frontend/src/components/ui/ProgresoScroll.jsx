import { useEffect, useRef } from 'react';

/** Hilo ámbar arriba de todo que marca cuánto de la página se leyó. */
export default function ProgresoScroll() {
  const ref = useRef(null);
  useEffect(() => {
    let raf = 0;
    const act = () => {
      raf = 0;
      const h = document.documentElement.scrollHeight - innerHeight;
      if (ref.current) ref.current.style.transform = `scaleX(${h > 0 ? Math.min(1, scrollY / h) : 0})`;
    };
    const al = () => { if (!raf) raf = requestAnimationFrame(act); };
    act();
    addEventListener('scroll', al, { passive: true });
    addEventListener('resize', al);
    return () => { removeEventListener('scroll', al); removeEventListener('resize', al); cancelAnimationFrame(raf); };
  }, []);
  return <div className="progreso-scroll" aria-hidden="true"><div ref={ref} /></div>;
}

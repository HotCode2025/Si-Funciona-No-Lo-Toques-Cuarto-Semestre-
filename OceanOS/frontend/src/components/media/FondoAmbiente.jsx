import { useEffect, useRef, useState } from 'react';
import { AMBIENTE } from './Reel.jsx';

/**
 * Fondo de video: encadena los clips con fundido, desenfocado y oscurecido para que
 * la interfaz se lea encima. Se pausa fuera de pantalla y con "reducir movimiento".
 */
export default function FondoAmbiente({ clips = AMBIENTE, oscuridad = 0.62, className = '' }) {
  const [i, setI] = useState(0);
  const [visible, setVisible] = useState(true);
  const caja = useRef(null); const refs = useRef([]);
  const quieto = useRef(typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.05 });
    if (caja.current) io.observe(caja.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    refs.current.forEach((el, k) => {
      if (!el) return;
      el.muted = true;
      if (k !== i || !visible || quieto.current) { el.pause(); return; }
      if (el.ended) el.currentTime = 0;
      el.play().catch(() => {});
    });
  }, [i, visible]);

  return (
    <div ref={caja} className={`absolute inset-0 overflow-hidden bg-abismo ${className}`} aria-hidden="true">
      {clips.map((c, k) => (
        <video key={c.id} ref={(el) => { refs.current[k] = el; }} src={c.src} poster={c.poster} muted playsInline preload={k === 0 ? 'auto' : 'metadata'}
               onEnded={() => { if (k === i) { const sig = (i + 1) % clips.length; if (refs.current[sig]) refs.current[sig].currentTime = 0; setI(sig); } }}
               className={`absolute inset-0 h-full w-full scale-110 object-cover blur-[5px] transition-opacity duration-[1600ms] ${k === i ? 'opacity-100' : 'opacity-0'}`} />
      ))}
      <div className="absolute inset-0 bg-abismo" style={{ opacity: oscuridad }} />
      <div className="absolute inset-0 bg-linear-to-b from-abismo/70 via-transparent to-abismo/90" />
    </div>
  );
}

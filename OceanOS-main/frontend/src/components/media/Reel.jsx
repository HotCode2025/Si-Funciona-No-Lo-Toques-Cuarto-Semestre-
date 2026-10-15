import { useCallback, useEffect, useRef, useState } from 'react';

const base = import.meta.env.BASE_URL;
const v = (n, ext) => `${base}videos/${n}.${ext}`;
const clip = (id, titulo, detalle) => ({ id, titulo, detalle, src: v(id, 'mp4'), poster: v(id, 'jpg') });

/** Los videos viven en /public/videos. Para cambiar uno, reemplazá el archivo (mismo nombre) o editá esta lista. */
export const CLIPS = [
  clip('ballena-kayak', 'Ballena y kayak', 'Convivir con la fauna, sin molestarla'),
  clip('cola-luna', 'Cola de ballena', 'Luna llena sobre el golfo'),
  clip('orcas', 'Orcas en la costa', 'Cada avistaje es un dato'),
  clip('luna-aves', 'Aves al atardecer', 'El océano también se mira desde la costa'),
  clip('luna-costa', 'Luna sobre la costa', 'Patagonia, de noche'),
];

const reduceMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const play = (el) => el?.play?.().catch(() => {});

/** Un solo video en loop, mudo, que se pausa cuando sale de pantalla (ahorra batería y datos). */
export function VideoFondo({ clip: c, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.muted = true;
    if (reduceMotion()) return;
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? play(el) : el.pause()), { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <video ref={ref} src={c.src} poster={c.poster} muted loop playsInline preload="metadata" aria-hidden="true"
           className={`h-full w-full object-cover ${className}`} />
  );
}

/**
 * Carrusel vertical estilo "historias": los videos se encadenan con fundido,
 * barras de avance arriba, toque izquierdo/derecho para saltar y una leve
 * inclinación 3D con el mouse. Solo reproduce el activo y solo si se ve.
 */
export function Reel({ clips = CLIPS, className = '' }) {
  const [i, setI] = useState(0);
  const [p, setP] = useState(0);
  const [visible, setVisible] = useState(true);
  const refs = useRef([]);
  const caja = useRef(null);
  const quieto = useRef(reduceMotion());
  const n = clips.length;
  const ir = useCallback((k) => setI(((k % n) + n) % n), [n]);

  useEffect(() => {
    refs.current.forEach((el, k) => { if (el) { el.muted = true; if (k !== i) el.pause(); } });
    const el = refs.current[i];
    if (!el) return;
    el.currentTime = 0;
    setP(0);
    if (visible && !quieto.current) play(el);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  useEffect(() => {
    const el = refs.current[i];
    if (!el || quieto.current) return;
    if (visible) play(el); else el.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.25 });
    if (caja.current) io.observe(caja.current);
    const vis = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', vis);
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', vis); };
  }, []);

  const inclinar = (e) => {
    if (e.pointerType !== 'mouse' || !caja.current) return;
    const r = caja.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    caja.current.style.setProperty('--ry', `${x * 9}deg`);
    caja.current.style.setProperty('--rx', `${-y * 7}deg`);
  };
  const plano = () => { caja.current?.style.setProperty('--ry', '0deg'); caja.current?.style.setProperty('--rx', '0deg'); };

  const c = clips[i];
  return (
    <div ref={caja} className={`reel ${className}`} onPointerMove={inclinar} onPointerLeave={plano}>
      <div className="reel-marco">
        {clips.map((k, idx) => (
          <video key={k.id} ref={(el) => { refs.current[idx] = el; }} src={k.src} poster={k.poster}
                 muted playsInline aria-hidden="true"
                 preload={idx === i || idx === (i + 1) % n ? 'auto' : 'metadata'}
                 className={`reel-video ${idx === i ? 'activo' : ''}`}
                 onTimeUpdate={idx === i ? (e) => setP(e.currentTarget.currentTime / (e.currentTarget.duration || 1)) : undefined}
                 onEnded={idx === i && !quieto.current ? () => ir(i + 1) : undefined} />
        ))}
        <div className="reel-velo" />

        <div className="absolute inset-x-3 top-3 z-10 flex gap-1.5" role="presentation">
          {clips.map((k, idx) => (
            <span key={k.id} className="reel-barra">
              <i style={{ transform: `scaleX(${idx < i ? 1 : idx === i ? p : 0})`, transition: idx === i ? 'transform .25s linear' : 'none' }} />
            </span>
          ))}
        </div>

        <div key={c.id} className="reel-pie absolute inset-x-4 bottom-4 z-10">
          <p className="text-[11px] tracking-wider text-kelp-alto uppercase">{String(i + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}</p>
          <p className="mt-1 font-display text-xl leading-tight font-600 text-carta">{c.titulo}</p>
          <p className="mt-0.5 text-sm text-carta/75">{c.detalle}</p>
        </div>

        <button type="button" aria-label="Video anterior" onClick={() => ir(i - 1)} className="absolute inset-y-10 left-0 z-20 w-1/3 cursor-w-resize" />
        <button type="button" aria-label="Video siguiente" onClick={() => ir(i + 1)} className="absolute inset-y-10 right-0 z-20 w-2/3 cursor-e-resize" />
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import Logo from '../marca/Logo.jsx';
import { VideoFondo, CLIPS } from '../media/Reel.jsx';

/** Pantalla de entrada de la app: video de fondo, logo que se dibuja y barra de carga. */
export default function Splash({ onFin }) {
  const [sale, setSale] = useState(false);
  useEffect(() => {
    const a = setTimeout(() => setSale(true), 2100);
    const b = setTimeout(onFin, 2750);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [onFin]);

  return (
    <div className={`splash ${sale ? 'splash-sale' : ''}`} role="presentation" onClick={onFin}>
      <div className="absolute inset-0 opacity-45"><VideoFondo clip={CLIPS[1]} /></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgb(4_32_43/.55),rgb(4_32_43/.95)_70%)]" />
      <div className="relative z-10 flex flex-col items-center">
        <Logo tamaño={104} animado />
        <p className="splash-texto mt-5 font-display text-3xl font-600 tracking-tight text-carta">Ocean<span className="text-kelp-alto">OS</span></p>
        <p className="splash-texto mt-1.5 text-sm tracking-wide text-sonda" style={{ animationDelay: '.75s' }}>El sistema operativo del océano</p>
        <div className="splash-barra mt-9"><i /></div>
      </div>
    </div>
  );
}

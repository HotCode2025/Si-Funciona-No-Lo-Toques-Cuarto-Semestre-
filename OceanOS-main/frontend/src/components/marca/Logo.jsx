import { useId } from 'react';

/**
 * Marca: una fronda de cachiyuyo (Macrocystis) dentro de un anillo de sonar.
 * Los tres neumatocistos —las vejigas de flotación— son los nodos del
 * sistema: tres capas, un solo tallo. Las ondas de la base son la línea de
 * agua y el anillo punteado es la lectura de la sonda.
 *
 * `animado` dibuja el tallo al montar, mece la fronda y emite un pulso de
 * sonar. Se desactiva solo con prefers-reduced-motion (ver index.css).
 */
export default function Logo({ tamaño = 30, claro = true, animado = false }) {
  const id = useId().replace(/:/g, '');
  const tinta = claro ? 'var(--color-carta)' : 'var(--color-abismo)';
  const sonda = 'var(--color-sonda)';

  return (
    <svg width={tamaño} height={tamaño} viewBox="0 0 48 48" fill="none" aria-hidden="true"
         className={animado ? 'logo-animado' : undefined}>
      <defs>
        <linearGradient id={`k${id}`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" style={{ stopColor: 'var(--color-kelp)' }} />
          <stop offset="1" style={{ stopColor: 'var(--color-kelp-alto)' }} />
        </linearGradient>
        <clipPath id={`c${id}`}><circle cx="24" cy="24" r="20.5" /></clipPath>
      </defs>

      {animado && <circle className="logo-sonar" cx="24" cy="24" r="21" stroke={sonda} strokeWidth="1" />}
      <circle className="logo-anillo" cx="24" cy="24" r="22" stroke={sonda} strokeWidth="1.2" strokeDasharray="1.5 3.5" strokeLinecap="round" opacity="0.55" />
      <circle cx="24" cy="24" r="17" stroke={sonda} strokeWidth="0.8" opacity="0.18" />

      <g clipPath={`url(#c${id})`}>
        <path d="M6 38.5q4.5-3.4 9 0t9 0 9 0 9 0" stroke={sonda} strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
        <path d="M6 43q4.5-3.4 9 0t9 0 9 0 9 0" stroke={sonda} strokeWidth="1.2" strokeLinecap="round" opacity="0.3" />
      </g>

      <g className="logo-fronda">
        <path className="logo-tallo" pathLength="1" d="M24 39c-3.6-6.4 3.6-10.4 0-16.6S22 12 24 7.5"
              stroke={`url(#k${id})`} strokeWidth="2.4" strokeLinecap="round" />
        <path d="M23.2 31C17.4 30.2 13.4 26.6 12.4 21.6c5.4.2 9.4 3.6 10.8 9.4Z" fill={`url(#k${id})`} />
        <path d="M24.8 24.4c5.8-.8 9.8-4.4 10.8-9.4-5.4.2-9.4 3.6-10.8 9.4Z" fill={`url(#k${id})`} />
        <path d="M23.4 17.4c-4-.8-6.2-3.4-6.6-6.6 3.6.4 5.8 2.8 6.6 6.6Z" fill={`url(#k${id})`} opacity="0.9" />
        <circle cx="22.4" cy="34.6" r="1.9" fill={tinta} />
        <circle cx="25.6" cy="27.4" r="1.9" fill={tinta} />
        <circle cx="23.6" cy="19.4" r="1.6" fill={tinta} />
        <circle cx="24" cy="8.4" r="1.7" fill={tinta} />
      </g>
    </svg>
  );
}

export function Marca({ claro = true, tamaño = 30, animado = false }) {
  return (
    <span className="marca inline-flex items-center gap-2.5">
      <Logo tamaño={tamaño} claro={claro} animado={animado} />
      <span className={`font-display text-[1.15rem] leading-none font-600 tracking-tight ${claro ? 'text-carta' : 'text-abismo'}`}>
        Ocean<span className="text-kelp-alto">OS</span>
      </span>
    </span>
  );
}

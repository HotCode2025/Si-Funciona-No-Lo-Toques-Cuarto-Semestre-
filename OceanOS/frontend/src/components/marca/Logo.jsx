/**
 * La marca es una hoja de cachiyuyo sobre líneas de sonda. No un ícono de
 * ola genérico: Macrocystis tiene neumatocistos (las vejigas de flotación)
 * y eso es lo que se dibuja.
 */
export default function Logo({ tamaño = 30, claro = true }) {
  const tinta = claro ? 'var(--color-carta)' : 'var(--color-abismo)';
  const sonda = 'var(--color-sonda)';
  const kelp = 'var(--color-kelp)';
  return (
    <svg width={tamaño} height={tamaño} viewBox="0 0 32 32" aria-hidden="true">
      {/* Anillos batimétricos estilo brújula/radar */}
      <circle cx="16" cy="16" r="14" stroke={sonda} strokeWidth="1" strokeDasharray="2 3" fill="none" opacity="0.4" />
      <circle cx="16" cy="16" r="10" stroke={sonda} strokeWidth="1" fill="none" opacity="0.15" />
      
      {/* Sondas del fondo (ondas más orgánicas y contenidas) */}
      <path d="M 6 19 Q 11 16, 16 19 T 26 19" stroke={sonda} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M 8 24 Q 13 21, 16 24 T 24 24" stroke={sonda} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.4" />
      
      {/* Tallo central y neumatocistos (Cachiyuyo) */}
      <path d="M16 24c-1.4-3.9-1.8-8-1.4-12.2.3-3 1.1-5.1 1.4-6.2.3 1.1 1.1 3.2 1.4 6.2.4 4.2 0 8.3-1.4 12.2Z"
            fill={kelp} />
      <circle cx="13.1" cy="13.4" r="1.9" fill={tinta} />
      <circle cx="18.9" cy="10.2" r="1.9" fill={tinta} />
      <circle cx="16" cy="4.5" r="1.5" fill={tinta} />
    </svg>
  );
}

export function Marca({ claro = true, tamaño = 30 }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Logo tamaño={tamaño} claro={claro} />
      <span className={`font-display text-lg font-600 tracking-tight ${claro ? 'text-carta' : 'text-abismo'}`}>
        OceanOS
      </span>
    </span>
  );
}

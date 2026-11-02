import { imagen } from '../lib/formato.js';

const COLORES = ['#e2550a', '#1f6fd1', '#1d8f4e', '#6d45c9', '#b7791f', '#0e7490', '#be185d'];

/** "Repuestos del Centro" → "RC"; "Martina López" → "ML". */
export function iniciales(nombre = '') {
  const palabras = nombre.split(/\s+/).filter((p) => /^[\p{L}\p{N}]/u.test(p) && !/^(de|del|la|las|los|y)$/i.test(p));
  return palabras.slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';
}

/**
 * Foto de perfil o logo. Sin imagen muestra las iniciales sobre un color que sale del nombre (siempre el mismo).
 * `redondo`: las personas van en círculo; los logos de los locales, en cuadrado con bordes redondeados.
 */
export default function Avatar({ src, nombre = '', redondo = true, className = '' }) {
  const clases = `avatar ${redondo ? 'avatar--redondo' : ''} ${className}`;
  if (src) return <img src={imagen(src)} alt="" className={clases} />;
  const color = COLORES[[...nombre].reduce((suma, c) => suma + c.charCodeAt(0), 0) % COLORES.length];
  return (
    <span className={`${clases} avatar--iniciales`} style={{ background: color }} aria-hidden="true">
      <span>{iniciales(nombre)}</span>
    </span>
  );
}

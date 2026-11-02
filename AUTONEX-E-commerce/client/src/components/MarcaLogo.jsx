import { imagen } from '../lib/formato.js';

/**
 * Identidad de una marca de vehículos: su logo (sobre fondo claro, u oscuro si el logo es blanco), si no la foto,
 * y si no hay ninguno, un monograma con sus iniciales. Los logos son marcas registradas de sus dueños.
 */
export default function MarcaLogo({ marca, className = '', preferirFoto = false }) {
  if (marca.logo && !(preferirFoto && marca.imagen)) {
    return (
      <span className={`marca-logo ${marca.logo_fondo === 'oscuro' ? 'marca-logo--oscuro' : ''} ${className}`}>
        <img src={imagen(marca.logo)} alt="" loading="lazy" />
      </span>
    );
  }
  if (marca.imagen) return <img src={imagen(marca.imagen)} alt="" loading="lazy" className={className} />;
  const iniciales = marca.nombre.replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean)
    .slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  return <span className={`monograma ${className}`} aria-hidden="true">{iniciales}</span>;
}

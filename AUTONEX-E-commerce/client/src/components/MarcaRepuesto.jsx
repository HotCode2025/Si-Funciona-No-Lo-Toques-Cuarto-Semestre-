import { Link } from 'react-router-dom';
import MarcaLogo from './MarcaLogo.jsx';
import { plural } from '../lib/formato.js';

/**
 * Una marca de repuestos con lo que fabrica (sus líneas de producto). Cada línea lleva a su categoría del catálogo.
 * Las líneas no son productos: los repuestos concretos aparecen cuando un proveedor publica su catálogo.
 */
export default function TarjetaMarcaRepuesto({ marca }) {
  return (
    <article className="marca-repuesto">
      <div className="marca-repuesto__cabecera">
        <MarcaLogo marca={marca} className="marca-repuesto__logo" />
        <div className="marca-repuesto__nombre">
          <strong>{marca.nombre}</strong>
          {Number(marca.productos) > 0 && (
            <Link to={`/catalogo?marca=${encodeURIComponent(marca.nombre)}`} className="texto-chico">
              {plural(Number(marca.productos), 'repuesto publicado', 'repuestos publicados')}
            </Link>
          )}
        </div>
      </div>
      {marca.lineas.length > 0 && (
        <ul className="marca-repuesto__lineas">
          {marca.lineas.map((l) => (
            <li key={l.nombre}>
              {l.categoria ? <Link to={`/catalogo?categoria=${l.categoria.slug}`}>{l.nombre}</Link> : <span>{l.nombre}</span>}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

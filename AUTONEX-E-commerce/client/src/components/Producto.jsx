import { Link } from 'react-router-dom';
import { CheckCircle2, CircleHelp, Globe2, Minus, Plus } from 'lucide-react';
import { imagen, plural, precio } from '../lib/formato.js';

/** Número de pieza (o SKU) con estética de etiqueta estampada. */
export function CodigoPieza({ codigo, rotulo = 'N°', titulo = 'Número de pieza del fabricante' }) {
  if (!codigo) return null;
  return (
    <span className="codigo-pieza" title={titulo}>
      <span className="codigo-pieza__rotulo">{rotulo}</span>
      <span className="codigo-pieza__valor">{codigo}</span>
    </span>
  );
}

export function EtiquetaCondicion({ condicion }) {
  return <span className={`condicion condicion--${condicion}`}>{condicion === 'usado' ? 'Usado' : 'Nuevo'}</span>;
}

/**
 * Compatibilidad en las tarjetas del catálogo (cuando hay un vehículo elegido).
 * Solo se muestra como confirmada si la compatibilidad está VERIFIED; si no, se aclara que falta verificar.
 */
export function MarcaCompat({ universal, vehiculo, estado }) {
  if (universal) {
    return <span className="compat compat--universal"><Globe2 size={14} aria-hidden="true" /> Universal</span>;
  }
  if (!vehiculo || !estado) return null;
  if (estado === 'VERIFIED') {
    return <span className="compat compat--ok"><CheckCircle2 size={14} aria-hidden="true" /> Verificado para tu {vehiculo.modelo}</span>;
  }
  return (
    <span className="compat compat--sin-verificar" title="La compatibilidad figura en el catálogo pero no está verificada con una fuente">
      <CircleHelp size={14} aria-hidden="true" /> Para tu {vehiculo.modelo} · sin verificar
    </span>
  );
}

export function TarjetaProducto({ producto, vehiculo, etiquetaPrecio = 'Desde', vendedor }) {
  return (
    <article className="tarjeta-producto">
      <Link to={`/producto/${producto.id}${vendedor ? `?vendedor=${encodeURIComponent(vendedor)}` : ''}`} className="tarjeta-producto__enlace">
        <div className="tarjeta-producto__imagen">
          <img src={imagen(producto.imagen)} alt="" loading="lazy" />
          {producto.hay_usado && !producto.hay_nuevo && <span className="tarjeta-producto__usado">Usado</span>}
          {producto.stock_total != null && Number(producto.stock_total) === 0 && <span className="tarjeta-producto__usado">Sin stock</span>}
        </div>
        <div className="tarjeta-producto__cuerpo">
          <span className="tarjeta-producto__marca">{producto.marca}</span>
          <h3 className="tarjeta-producto__nombre">{producto.nombre}</h3>
          <CodigoPieza codigo={producto.numero_pieza} />
          <MarcaCompat universal={producto.universal} vehiculo={vehiculo} estado={producto.compat_estado} />
          <div className="tarjeta-producto__pie">
            <div>
              <span className="tarjeta-producto__desde">{etiquetaPrecio}</span>
              <span className="tarjeta-producto__precio">{precio(producto.precio_desde)}</span>
            </div>
            {producto.ofertas > 0 && (
              <span className="tarjeta-producto__ofertas">{plural(Number(producto.ofertas), 'oferta', 'ofertas')}</span>
            )}
          </div>
        </div>
      </Link>
    </article>
  );
}

export function SelectorCantidad({ valor, maximo, alCambiar, chico = false, etiqueta = 'Cantidad' }) {
  return (
    <div className={`cantidad ${chico ? 'cantidad--chica' : ''}`}>
      <button type="button" onClick={() => alCambiar(valor - 1)} disabled={valor <= 1} aria-label="Restar uno">
        <Minus size={16} />
      </button>
      <input type="number" inputMode="numeric" min={1} max={maximo} value={valor} aria-label={etiqueta}
        onChange={(e) => alCambiar(Number(e.target.value))} />
      <button type="button" onClick={() => alCambiar(valor + 1)} disabled={valor >= maximo} aria-label="Sumar uno">
        <Plus size={16} />
      </button>
    </div>
  );
}

export function Paginacion({ pagina, paginas, alCambiar }) {
  if (paginas <= 1) return null;
  const numeros = [];
  for (let i = Math.max(1, pagina - 2); i <= Math.min(paginas, pagina + 2); i++) numeros.push(i);
  return (
    <nav className="paginacion" aria-label="Páginas">
      <button type="button" className="btn btn--chico" disabled={pagina <= 1} onClick={() => alCambiar(pagina - 1)}>Anterior</button>
      {numeros[0] > 1 && <span className="texto-gris">…</span>}
      {numeros.map((n) => (
        <button key={n} type="button" className={`paginacion__num ${n === pagina ? 'activa' : ''}`}
          aria-current={n === pagina ? 'page' : undefined} onClick={() => alCambiar(n)}>{n}</button>
      ))}
      {numeros[numeros.length - 1] < paginas && <span className="texto-gris">…</span>}
      <button type="button" className="btn btn--chico" disabled={pagina >= paginas} onClick={() => alCambiar(pagina + 1)}>Siguiente</button>
    </nav>
  );
}

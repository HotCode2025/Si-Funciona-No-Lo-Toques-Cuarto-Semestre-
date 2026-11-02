import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Camera, CheckCircle2, ChevronDown, CircleHelp, Globe2, HelpCircle, MapPin, ShieldCheck, ShoppingCart, Store, XCircle } from 'lucide-react';
import { CodigoPieza, EtiquetaCondicion, SelectorCantidad, TarjetaProducto } from '../components/Producto.jsx';
import { Cargando, ErrorMensaje } from '../components/Estados.jsx';
import Modal from '../components/Modal.jsx';
import Avatar from '../components/Avatar.jsx';
import { useVehiculo } from '../context/VehiculoContext.jsx';
import { useCarrito } from '../context/CarritoContext.jsx';
import { useAvisos } from '../context/AvisosContext.jsx';
import { etiquetaDe, useApi, useReferencias, useTitulo } from '../lib/hooks.js';
import { fecha, imagen, plural, precio } from '../lib/formato.js';
import { SelloVerificacion } from '../components/Verificacion.jsx';

const TIPOS_IMAGEN = {
  principal: 'Principal', packaging: 'Empaque', frontal: 'Frente', trasera: 'Atrás', lateral: 'Lateral',
  detalle: 'Detalle', aplicacion: 'Aplicación', motor: 'Motor', tablero: 'Tablero', color: 'Color',
};

/**
 * Fotos reales del repuesto (con autor, licencia y origen). Sin fotos propias se muestra la imagen ilustrativa de la
 * categoría si la hay; si no, se avisa que falta (IMAGE_MISSING) en lugar de mostrar una pieza parecida.
 */
function GaleriaProducto({ producto }) {
  const [actual, setActual] = useState(0);
  const fotos = producto.imagenes || [];
  if (!fotos.length) {
    return (
      <div className="producto__galeria">
        <img src={imagen(producto.imagen)} alt={producto.nombre} />
        <span className="producto__ilustrativa">
          {producto.imagen_estado === 'IMAGE_MISSING' ? 'Sin foto real del repuesto todavía' : 'Imagen ilustrativa'}
        </span>
      </div>
    );
  }
  const foto = fotos[Math.min(actual, fotos.length - 1)];
  return (
    <div className="producto__galeria-bloque">
      <div className="producto__galeria">
        <img src={imagen(foto.archivo || foto.url_imagen)} alt={`${producto.nombre} · ${TIPOS_IMAGEN[foto.tipo] || foto.tipo}`} />
      </div>
      {fotos.length > 1 && (
        <div className="producto__miniaturas" role="group" aria-label="Fotos del repuesto">
          {fotos.map((f, i) => (
            <button key={f.id} type="button" className={i === actual ? 'activa' : ''} aria-pressed={i === actual}
              onClick={() => setActual(i)} title={TIPOS_IMAGEN[f.tipo] || f.tipo}>
              <img src={imagen(f.archivo || f.url_imagen)} alt={TIPOS_IMAGEN[f.tipo] || f.tipo} loading="lazy" />
            </button>
          ))}
        </div>
      )}
      <p className="texto-chico texto-gris producto__credito">
        {foto.de_vendedor ? <>Foto de {foto.autor} (vendedor)</> : <>Foto: {foto.autor || 'autor sin dato'}</>}
        {foto.licencia && <> · {foto.licencia_url ? <a href={foto.licencia_url} target="_blank" rel="noreferrer">{foto.licencia}</a> : foto.licencia}</>}
        {foto.url_origen && <> · <a href={foto.url_origen} target="_blank" rel="noreferrer">{foto.fuente || 'origen'}</a></>}
      </p>
    </div>
  );
}

function AvisoCompatibilidad({ compatibilidad, producto, vehiculo, abrirSelector }) {
  if (!vehiculo) {
    return (
      <div className="compatibilidad compatibilidad--neutra">
        <HelpCircle size={28} aria-hidden="true" />
        <div>
          <strong>¿Le sirve a tu auto?</strong>
          <p>{producto.universal ? 'Es un repuesto universal: sirve para cualquier vehículo.' : 'Elegí tu vehículo y te decimos al instante si este repuesto es compatible.'}</p>
          {!producto.universal && <button type="button" className="btn btn--oscuro btn--chico" onClick={() => abrirSelector()}>Elegir mi vehículo</button>}
        </div>
      </div>
    );
  }
  const nombre = `${vehiculo.marca} ${vehiculo.modelo} ${vehiculo.anio}`;
  if (!compatibilidad) return null;
  if (compatibilidad.estado === 'universal') {
    return (
      <div className="compatibilidad compatibilidad--ok">
        <Globe2 size={28} aria-hidden="true" />
        <div><strong>Le sirve a tu {nombre}</strong><p>Es un repuesto universal: sirve para cualquier auto o camioneta.</p></div>
      </div>
    );
  }
  const version = [vehiculo.version, vehiculo.motor].filter(Boolean).join(' · ');
  if (compatibilidad.estado === 'compatible') {
    return (
      <div className="compatibilidad compatibilidad--ok">
        <CheckCircle2 size={28} aria-hidden="true" />
        <div><strong>Le sirve a tu {nombre}</strong><p>Compatibilidad verificada para la versión {version}.</p></div>
      </div>
    );
  }
  // Cargada pero no confirmada con una fuente: nunca se presenta como segura
  if (compatibilidad.estado === 'sin_verificar') {
    return (
      <div className="compatibilidad compatibilidad--duda">
        <CircleHelp size={28} aria-hidden="true" />
        <div>
          <strong>Figura como compatible con tu {nombre}, pero no está verificada</strong>
          <p>
            El dato para la versión {version} todavía no fue confirmado con el catálogo del fabricante.
            Antes de comprar, chequeá el número de pieza o consultá al vendedor.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="compatibilidad compatibilidad--no">
      <XCircle size={28} aria-hidden="true" />
      <div>
        <strong>No figura como compatible con tu {nombre}</strong>
        <p>No tenemos registrado que sirva para la versión {version}. Revisá la lista de vehículos compatibles o buscá uno para tu auto.</p>
        <Link to={`/catalogo?q=${encodeURIComponent(producto.nombre.split(' ').slice(0, 3).join(' '))}`} className="btn btn--chico">Buscar alternativas compatibles</Link>
      </div>
    </div>
  );
}

/** Agregar una oferta al carrito sin pasar su stock (lo usan la tabla de ofertas y el bloque de compra). */
function useAgregarOferta(oferta, producto) {
  const { agregar, cantidadDe } = useCarrito();
  const { avisar } = useAvisos();
  const [cantidad, setCantidad] = useState(1);
  const enCarrito = oferta ? cantidadDe(oferta.publicacion_id) : 0;
  const disponible = oferta ? Math.max(oferta.stock - enCarrito, 0) : 0;
  const alAgregar = () => {
    const r = agregar(oferta, producto, cantidad);
    if (r.yaEstabaAlMaximo) avisar(`Ya tenés en el carrito todo el stock de ${oferta.vendedor.nombre_comercial}.`, 'info');
    else if (r.limitado) avisar(`Agregamos ${r.cantidad} (es todo el stock de ${oferta.vendedor.nombre_comercial}).`, 'info');
    else avisar(`Agregado al carrito: ${producto.nombre} (${oferta.vendedor.nombre_comercial}).`);
    setCantidad(1);
  };
  const cambiarCantidad = (n) => setCantidad(Math.max(1, Math.min(n || 1, disponible)));
  return { cantidad, cambiarCantidad, enCarrito, disponible, alAgregar };
}

/**
 * Compra directa arriba de todo: la oferta más barata con stock (o la del vendedor desde el que se llegó) con su
 * cantidad y el botón de agregar; el resto de las ofertas siguen en la tabla de abajo.
 */
function CompraRapida({ oferta, producto, totalOfertas }) {
  const { cantidad, cambiarCantidad, enCarrito, disponible, alAgregar } = useAgregarOferta(oferta, producto);
  return (
    <div className="compra-rapida">
      <span className="compra-rapida__vendedor">
        Vende <Link to={`/vendedores/${oferta.vendedor.slug}`}><strong>{oferta.vendedor.nombre_comercial}</strong></Link>
        <small><MapPin size={12} /> {oferta.vendedor.ciudad}, {oferta.vendedor.provincia} · <EtiquetaCondicion condicion={oferta.condicion} /> · {plural(oferta.stock, 'unidad', 'unidades')}</small>
      </span>
      {disponible > 0 ? (
        <div className="compra-rapida__accion">
          <SelectorCantidad valor={cantidad} maximo={disponible} alCambiar={cambiarCantidad} />
          <button type="button" className="btn btn--primario compra-rapida__boton" onClick={alAgregar}>
            <ShoppingCart size={18} /> Agregar al carrito
          </button>
        </div>
      ) : (
        <Link to="/carrito" className="btn btn--oscuro compra-rapida__boton">Ya está en tu carrito ({enCarrito}) · Ver carrito</Link>
      )}
      {enCarrito > 0 && disponible > 0 && <small className="texto-gris">{enCarrito} en el carrito</small>}
      {totalOfertas > 1 && <a href="#ofertas" className="enlace texto-chico">Ver las {totalOfertas} ofertas de distintos vendedores</a>}
    </div>
  );
}

/** Lo que publicó un vendedor para esta pieza: sus fotos y su descripción, con su precio. */
function DetalleOferta({ oferta, producto, disponible, alAgregar, alCerrar }) {
  const [actual, setActual] = useState(0);
  const fotos = oferta.fotos || [];
  const foto = fotos[Math.min(actual, fotos.length - 1)];
  return (
    <Modal abierto alCerrar={alCerrar} titulo={`Publicación de ${oferta.vendedor.nombre_comercial}`} ancho={720}>
      <div className="detalle-oferta">
        {foto && (
          <div className="detalle-oferta__fotos">
            <img className="detalle-oferta__foto" src={imagen(foto.url)} alt={`${producto.nombre}, foto ${actual + 1} de ${oferta.vendedor.nombre_comercial}`} />
            {fotos.length > 1 && (
              <div className="producto__miniaturas" role="group" aria-label="Fotos del vendedor">
                {fotos.map((f, i) => (
                  <button key={f.id} type="button" className={i === actual ? 'activa' : ''} aria-pressed={i === actual} onClick={() => setActual(i)}>
                    <img src={imagen(f.url)} alt={`Foto ${i + 1}`} loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="detalle-oferta__datos">
          <strong>{producto.nombre}</strong>
          <span className="fila fila--envolver">
            <EtiquetaCondicion condicion={oferta.condicion} />
            <small className="texto-gris"><MapPin size={12} /> {oferta.vendedor.ciudad}, {oferta.vendedor.provincia}</small>
          </span>
          {oferta.descripcion ? <p className="texto-pre">{oferta.descripcion}</p> : <p className="texto-gris">El vendedor no agregó una descripción.</p>}
          <div className="fila fila--entre fila--envolver">
            <strong className="detalle-oferta__precio">{precio(oferta.precio)}</strong>
            {disponible > 0 && (
              <button type="button" className="btn btn--primario" onClick={() => { alAgregar(); alCerrar(); }}>
                <ShoppingCart size={18} /> Agregar al carrito
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function FilaOferta({ oferta, producto, mejorPrecio }) {
  const { cantidad, cambiarCantidad, enCarrito, disponible, alAgregar } = useAgregarOferta(oferta, producto);
  const [viendo, setViendo] = useState(false);
  const sinStock = oferta.stock === 0;
  const cantidadFotos = oferta.fotos?.length || 0;

  return (
    <tr className={sinStock ? 'oferta--sin-stock' : ''}>
      <td data-titulo="Vendedor">
        <Link to={`/vendedores/${oferta.vendedor.slug}`} className="oferta__vendedor">
          <Avatar src={oferta.vendedor.logo} nombre={oferta.vendedor.nombre_comercial} redondo={false} />
          <span>
            <strong>{oferta.vendedor.nombre_comercial}</strong>
            <small><MapPin size={12} /> {oferta.vendedor.ciudad}, {oferta.vendedor.provincia}</small>
          </span>
        </Link>
        {(cantidadFotos > 0 || oferta.descripcion) && (
          <button type="button" className="enlace texto-chico oferta__detalle" onClick={() => setViendo(true)}>
            <Camera size={14} /> {cantidadFotos > 0 ? `Ver ${cantidadFotos === 1 ? 'la foto' : `las ${cantidadFotos} fotos`}${oferta.descripcion ? ' y la descripción' : ''}` : 'Ver la descripción'}
          </button>
        )}
        {viendo && <DetalleOferta oferta={oferta} producto={producto} disponible={disponible} alAgregar={alAgregar} alCerrar={() => setViendo(false)} />}
      </td>
      <td data-titulo="Condición"><EtiquetaCondicion condicion={oferta.condicion} /></td>
      <td data-titulo="Stock" className={oferta.stock <= 3 && !sinStock ? 'oferta__stock-bajo' : ''}>
        {sinStock ? 'Sin stock' : plural(oferta.stock, 'unidad', 'unidades')}
      </td>
      <td data-titulo="Precio" className="oferta__precio">
        {precio(oferta.precio)}
        {oferta.precio === mejorPrecio && !sinStock && <span className="oferta__mejor">Mejor precio</span>}
      </td>
      <td className="oferta__accion">
        {sinStock ? (
          <span className="texto-gris texto-chico">No disponible</span>
        ) : disponible === 0 ? (
          <Link to="/carrito" className="btn btn--chico">En el carrito ({enCarrito})</Link>
        ) : (
          <div className="fila">
            <SelectorCantidad chico valor={cantidad} maximo={disponible} alCambiar={cambiarCantidad} />
            <button type="button" className="btn btn--primario btn--chico" onClick={alAgregar}>
              <ShoppingCart size={16} /> Agregar
            </button>
          </div>
        )}
        {enCarrito > 0 && disponible > 0 && <small className="texto-gris oferta__en-carrito">{enCarrito} en el carrito</small>}
      </td>
    </tr>
  );
}

export default function Producto() {
  const { id } = useParams();
  // ?vendedor=slug: se llegó desde la página de un vendedor, se propone su oferta
  const [params] = useSearchParams();
  const vendedorElegido = params.get('vendedor');
  const { vehiculo, abrirSelector } = useVehiculo();
  const { datos, error, cargando } = useApi(`/productos/${id}${vehiculo ? `?vehiculo=${vehiculo.id}` : ''}`);
  const referencias = useReferencias();
  const [abiertos, setAbiertos] = useState({});
  useTitulo(datos?.producto.nombre);

  if (cargando && !datos) return <div className="contenedor pagina"><Cargando texto="Cargando repuesto…" /></div>;
  if (error) return <div className="contenedor pagina"><ErrorMensaje error={error} /></div>;
  if (!datos) return null;

  const { producto, compatibilidad, ofertas, vehiculos_compatibles: grupos, relacionados, oem, equivalencias } = datos;
  const porEstado = datos.compatibilidades_por_estado || {};
  const verificadas = porEstado.VERIFIED || 0;
  const sinVerificar = (porEstado.UNVERIFIED || 0) + (porEstado.NEEDS_REVIEW || 0);
  const ficha = [
    ['Marca', producto.marca],
    ['Número de pieza', producto.numero_pieza],
    ['SKU AUTONEX', producto.sku],
    ['Tipo de pieza', etiquetaDe(referencias, 'tipos_pieza', producto.tipo_pieza)],
    ['EAN', producto.ean],
    ['UPC', producto.upc],
    ['Código aftermarket', producto.codigo_aftermarket],
    ...Object.entries(producto.especificaciones || {}).map(([k, v]) => [k.replace(/_/g, ' '), String(v)]),
  ].filter(([, v]) => v);
  const conStock = ofertas.filter((o) => o.stock > 0);
  const mejorPrecio = conStock.length ? Math.min(...conStock.map((o) => o.precio)) : null;
  const ofertaPropuesta = conStock.find((o) => o.vendedor.slug === vendedorElegido)
    || [...conStock].sort((a, b) => a.precio - b.precio || b.stock - a.stock)[0];
  const [descripcion, aplicacion] = (producto.descripcion || '').split('\n\n');

  return (
    <div className="contenedor pagina producto">
      <nav className="migas" aria-label="Ubicación">
        <Link to="/">Inicio</Link><span aria-hidden="true">/</span>
        {(producto.ruta_categoria || [producto.categoria]).map((c) => (
          <span key={c.slug} className="migas__item">
            <Link to={`/catalogo?categoria=${c.slug}`}>{c.nombre}</Link><span aria-hidden="true">/</span>
          </span>
        ))}
        <span>{producto.numero_pieza}</span>
      </nav>

      <div className="producto__principal">
        <GaleriaProducto producto={producto} />

        <div className="producto__info">
          <span className="producto__marca">{producto.marca}</span>
          <h1 className="producto__nombre">{producto.nombre}</h1>
          <div className="fila fila--envolver">
            <CodigoPieza codigo={producto.numero_pieza} />
            <CodigoPieza codigo={producto.sku} rotulo="SKU" titulo="Código interno de AUTONEX" />
            <span className="etiqueta-categoria">{producto.categoria.nombre}</span>
            {producto.universal && <span className="compat compat--universal"><Globe2 size={14} /> Universal</span>}
          </div>

          <div className="producto__resumen-precio">
            {mejorPrecio ? (
              <>
                <span className="texto-gris">{conStock.length > 1 ? `Desde · ${conStock.length} vendedores` : '1 vendedor'}</span>
                <strong>{precio(mejorPrecio)}</strong>
              </>
            ) : <strong className="texto-gris">Sin stock por el momento</strong>}
          </div>

          {ofertaPropuesta && <CompraRapida oferta={ofertaPropuesta} producto={producto} totalOfertas={conStock.length} />}

          <AvisoCompatibilidad compatibilidad={compatibilidad} producto={producto} vehiculo={vehiculo} abrirSelector={abrirSelector} />

          {descripcion && (
            <div className="producto__descripcion">
              <h2>Descripción</h2>
              <p>{descripcion}</p>
              {aplicacion && <p className="texto-gris">{aplicacion}</p>}
            </div>
          )}

          {ofertaPropuesta?.descripcion && (
            <div className="producto__descripcion">
              <h2>Descripción de {ofertaPropuesta.vendedor.nombre_comercial}</h2>
              <p className="texto-pre">{ofertaPropuesta.descripcion}</p>
            </div>
          )}

          <div className="producto__ficha">
            <h2>Ficha técnica</h2>
            <dl className="ficha">
              {ficha.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            </dl>
            <p className="producto__origen texto-chico">
              <ShieldCheck size={15} aria-hidden="true" />
              <span>
                Dato: <SelloVerificacion estado={producto.estado_verificacion} />
                {producto.fuente && <> · Fuente: {producto.fuente.url ? <a href={producto.fuente.url} target="_blank" rel="noreferrer">{producto.fuente.nombre}</a> : producto.fuente.nombre}</>}
                {producto.actualizado_en && <> · Actualizado el {fecha(producto.actualizado_en)}</>}
              </span>
            </p>
            {producto.fuente?.tipo === 'demo' && (
              <p className="texto-chico texto-gris">Repuesto de demostración: los datos de este producto no provienen de un catálogo real.</p>
            )}
          </div>
        </div>
      </div>

      <section className="seccion" id="ofertas">
        <h2 className="titulo-seccion">Compará las ofertas ({ofertas.length})</h2>
        {ofertas.length === 0 ? (
          <div className="alerta alerta--aviso"><AlertTriangle size={20} /><span>Ningún vendedor tiene este repuesto publicado ahora.</span></div>
        ) : (
          <div className="tarjeta tabla-ofertas-contenedor">
            <table className="tabla-ofertas">
              <thead>
                <tr><th>Vendedor</th><th>Condición</th><th>Stock</th><th>Precio</th><th><span className="sr-only">Comprar</span></th></tr>
              </thead>
              <tbody>
                {ofertas.map((o) => <FilaOferta key={o.publicacion_id} oferta={o} producto={producto} mejorPrecio={mejorPrecio} />)}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {(oem.length > 0 || equivalencias.length > 0) && (
        <section className="seccion codigos-equivalentes">
          {oem.length > 0 && (
            <div className="tarjeta tarjeta--padding">
              <h2 className="titulo-seccion titulo-seccion--chico">Números OEM (original)</h2>
              <ul className="lista-codigos">
                {oem.map((o) => (
                  <li key={`${o.marca}-${o.numero_oem}`}>
                    <span>{o.marca}</span><code>{o.numero_oem}</code>
                    <SelloVerificacion estado={o.estado_verificacion} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {equivalencias.length > 0 && (
            <div className="tarjeta tarjeta--padding">
              <h2 className="titulo-seccion titulo-seccion--chico">Equivalencias</h2>
              <ul className="lista-codigos">
                {equivalencias.map((e) => (
                  <li key={`${e.marca}-${e.numero_pieza}`}>
                    <span>{e.marca}</span>
                    {e.producto_equivalente_id ? <Link to={`/producto/${e.producto_equivalente_id}`}><code>{e.numero_pieza}</code></Link> : <code>{e.numero_pieza}</code>}
                    {e.tipo !== 'equivalente' && <small className="texto-gris">{e.tipo === 'reemplaza' ? 'reemplaza a' : 'reemplazado por'}</small>}
                    <SelloVerificacion estado={e.estado_verificacion} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section className="seccion">
        <h2 className="titulo-seccion">Vehículos compatibles</h2>
        {!producto.universal && datos.total_versiones_compatibles > 0 && (
          <p className="texto-gris compatibles__resumen">
            {plural(datos.total_versiones_compatibles, 'versión', 'versiones')}
            {' · '}{plural(verificadas, 'verificada', 'verificadas')}
            {sinVerificar > 0 && <> · <strong className="texto-ambar">{sinVerificar} sin verificar</strong>: confirmá el número de pieza antes de comprar</>}
          </p>
        )}
        {!producto.universal && grupos.length === 0 && (
          <p className="tarjeta tarjeta--padding texto-gris">Todavía no hay compatibilidades cargadas para este repuesto.</p>
        )}
        {producto.universal ? (
          <p className="tarjeta tarjeta--padding"><Globe2 size={18} className="icono-linea" /> Repuesto universal: sirve para cualquier auto o camioneta.</p>
        ) : (
          <div className="compatibles">
            {grupos.map((g) => {
              const clave = `${g.marca}-${g.modelo}`;
              const esMio = vehiculo && vehiculo.marca === g.marca && vehiculo.modelo === g.modelo;
              const abierto = abiertos[clave] ?? esMio;
              return (
                <div key={clave} className={`compatibles__modelo ${esMio ? 'compatibles__modelo--mio' : ''}`}>
                  <button type="button" className="compatibles__cabecera" aria-expanded={abierto}
                    onClick={() => setAbiertos((a) => ({ ...a, [clave]: !abierto }))}>
                    <span><strong>{g.marca} {g.modelo}</strong> <small className="texto-gris">{plural(g.versiones.length, 'versión', 'versiones')}</small></span>
                    <ChevronDown size={18} className={abierto ? 'girado' : ''} />
                  </button>
                  {abierto && (
                    <ul>
                      {g.versiones.map((v) => (
                        <li key={v.id} className={vehiculo?.id === v.id ? 'es-mio' : ''}>
                          <span>{v.version}</span>
                          <span className="texto-gris">{v.motor}</span>
                          <span className="mono">
                            {v.compat_anio_desde || v.compat_anio_hasta
                              ? <>{v.compat_anio_desde || v.anio_desde}–{v.compat_anio_hasta || v.anio_hasta || 'hoy'} <small title="La pieza sirve solo para estos años de la versión">(solo esos años)</small></>
                              : <>{v.anio_desde}–{v.anio_hasta || 'hoy'}</>}
                          </span>
                          <SelloVerificacion estado={v.estado_verificacion} />
                          {vehiculo?.id === v.id && <span className="compat compat--universal"><CheckCircle2 size={13} /> Tu vehículo</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {relacionados.length > 0 && (
        <section className="seccion">
          <h2 className="titulo-seccion">Otros repuestos de {producto.categoria.nombre.toLowerCase()}{vehiculo ? ` para tu ${vehiculo.modelo}` : ''}</h2>
          <div className="grilla-productos">
            {relacionados.map((p) => <TarjetaProducto key={p.id} producto={p} vehiculo={vehiculo} />)}
          </div>
        </section>
      )}

      <p className="texto-chico texto-gris producto__vendedores-nota"><Store size={14} /> Los precios y el stock los publica cada vendedor. AUTONEX recalcula todo al momento de pagar.</p>
    </div>
  );
}

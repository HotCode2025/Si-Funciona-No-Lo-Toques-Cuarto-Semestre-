import { Link } from 'react-router-dom';
import { ArrowRight, Car, CreditCard, GitCompareArrows, MapPin, Search, Truck } from 'lucide-react';
import { TarjetaProducto } from '../components/Producto.jsx';
import { Cargando } from '../components/Estados.jsx';
import Avatar from '../components/Avatar.jsx';
import { useVehiculo } from '../context/VehiculoContext.jsx';
import MarcaLogo from '../components/MarcaLogo.jsx';
import { categoriasRaiz, useApi, useCategorias, useReferencias, useTitulo } from '../lib/hooks.js';
import { imagen, plural } from '../lib/formato.js';

const numero = (n) => Number(n || 0).toLocaleString('es-AR');

function Garage() {
  const { vehiculo, abrirSelector } = useVehiculo();
  const marcas = useApi('/vehiculos/marcas');

  if (vehiculo) {
    return (
      <div className="garage garage--listo">
        <span className="garage__rotulo"><Car size={16} /> Tu vehículo</span>
        <strong className="garage__vehiculo">{vehiculo.marca} {vehiculo.modelo} {vehiculo.anio}</strong>
        <span className="garage__version">{[vehiculo.version, vehiculo.motor].filter(Boolean).join(' · ')}</span>
        <div className="garage__acciones">
          <Link to="/catalogo" className="btn btn--primario">Ver repuestos compatibles <ArrowRight size={18} /></Link>
          <button type="button" className="btn btn--fantasma garage__cambiar" onClick={() => abrirSelector()}>Cambiar vehículo</button>
        </div>
      </div>
    );
  }

  return (
    <div className="garage">
      <span className="garage__rotulo"><Car size={16} /> Empezá por tu vehículo</span>
      <strong className="garage__titulo">¿Qué auto o moto tenés?</strong>
      <p className="garage__texto">Elegí marca, modelo, año y versión: te mostramos solo los repuestos que le sirven.</p>
      <div className="garage__marcas">
        {marcas.datos?.slice(0, 8).map((m) => (
          <button key={m.id} type="button" className="garage__marca" onClick={() => abrirSelector(m)}>
            <MarcaLogo marca={m} />
            <span>{m.nombre}</span>
          </button>
        ))}
      </div>
      <button type="button" className="btn btn--primario btn--bloque" onClick={() => abrirSelector()}>
        Elegir mi vehículo
      </button>
    </div>
  );
}

export default function Inicio() {
  useTitulo(null);
  const { vehiculo } = useVehiculo();
  const vid = vehiculo?.id;
  const categorias = useApi(`/categorias?destacadas=true${vid ? `&vehiculo=${vid}` : ''}`);
  const raices = categoriasRaiz(useCategorias());
  const referencias = useReferencias();
  const totales = referencias?.totales;
  const destacados = useApi('/productos', { query: { vehiculo: vid, por_pagina: 8, orden: 'relevancia' } }, `destacados-${vid}`);
  const vendedores = useApi('/vendedores');

  return (
    <div className="inicio">
      <section className="hero">
        <div className="contenedor hero__grilla">
          <div className="hero__texto">
            <span className="hero__sobretitulo">Marketplace de autopartes</span>
            <h1 className="hero__titulo">El repuesto justo<br /><span>para tu auto</span></h1>
            <p className="hero__bajada">
              Compará precios de casas de repuestos de todo el país, comprá a varios vendedores en un solo
              carrito y pagá con Mercado Pago. Retirás en el local o te lo mandamos.
            </p>
            {totales && (
              <ul className="hero__datos">
                <li><strong>{numero(totales.versiones)}</strong> versiones de vehículos</li>
                {Number(totales.modelos_moto) > 0 && <li><strong>{numero(totales.modelos_moto)}</strong> modelos de motos</li>}
                <li><strong>{numero(totales.marcas)}</strong> marcas</li>
                <li><strong>{numero(totales.repuestos)}</strong> repuestos en venta</li>
                <li><strong>{numero(totales.vendedores)}</strong> casas de repuestos</li>
              </ul>
            )}
          </div>
          <Garage />
        </div>
      </section>

      <section className="contenedor seccion">
        <div className="fila fila--entre">
          <h2 className="titulo-seccion">Categorías destacadas</h2>
          <Link to="/catalogo" className="enlace">Ver todo el catálogo</Link>
        </div>
        <div className="chips chips--categorias">
          {raices.map((c) => <Link key={c.slug} to={`/catalogo?categoria=${c.slug}`} className="chip">{c.nombre}</Link>)}
        </div>
        <div className="grilla-categorias">
          {categorias.datos?.map((c) => (
            <Link key={c.slug} to={`/catalogo?categoria=${c.slug}`} className="tarjeta-categoria">
              <img src={imagen(c.imagen)} alt="" loading="lazy" />
              <span className="tarjeta-categoria__texto">
                <strong>{c.nombre}</strong>
                <small>{vid ? `${plural(c.cantidad, 'repuesto', 'repuestos')} para tu ${vehiculo.modelo}` : plural(c.cantidad, 'repuesto', 'repuestos')}</small>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="contenedor seccion">
        <div className="fila fila--entre">
          <h2 className="titulo-seccion">{vehiculo ? `Lo más buscado para tu ${vehiculo.modelo}` : 'Repuestos con más ofertas'}</h2>
          <Link to="/catalogo" className="enlace">Ver más</Link>
        </div>
        {destacados.cargando && <Cargando />}
        {destacados.datos && (
          <div className="grilla-productos">
            {destacados.datos.productos.map((p) => <TarjetaProducto key={p.id} producto={p} vehiculo={vehiculo} />)}
          </div>
        )}
      </section>

      <section className="como-funciona">
        <div className="contenedor">
          <h2 className="titulo-seccion titulo-seccion--claro">Cómo funciona</h2>
          <ol className="pasos-inicio">
            <li><span className="pasos-inicio__icono"><Search size={26} /></span><strong>Elegí tu vehículo</strong><p>El catálogo se filtra solo: ves únicamente lo que le sirve a tu auto.</p></li>
            <li><span className="pasos-inicio__icono"><GitCompareArrows size={26} /></span><strong>Compará ofertas</strong><p>Un mismo repuesto, varios vendedores: precio, stock, condición y ciudad.</p></li>
            <li><span className="pasos-inicio__icono"><Truck size={26} /></span><strong>Retirá o recibí</strong><p>Por cada vendedor elegís retiro en el local o envío con Andreani, OCA, Correo o moto.</p></li>
            <li><span className="pasos-inicio__icono"><CreditCard size={26} /></span><strong>Pagá una sola vez</strong><p>Un único pago con Mercado Pago aunque compres a varias casas de repuestos.</p></li>
          </ol>
        </div>
      </section>

      <section className="contenedor seccion">
        <div className="fila fila--entre">
          <h2 className="titulo-seccion">Casas de repuestos</h2>
          <Link to="/vendedores" className="enlace">Ver todas</Link>
        </div>
        <div className="grilla-vendedores">
          {vendedores.datos?.map((v) => (
            <Link key={v.slug} to={`/vendedores/${v.slug}`} className="mini-vendedor">
              <Avatar src={v.logo} nombre={v.nombre_comercial} redondo={false} />
              <span>
                <strong>{v.nombre_comercial}</strong>
                <small><MapPin size={13} /> {v.ciudad}, {v.provincia}</small>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="contenedor seccion">
        <h2 className="titulo-seccion">Marcas de repuestos</h2>
        <div className="marcas-repuesto">
          {referencias?.marcas_repuesto.map((m) => (
            <Link key={m.nombre} to={`/catalogo?marca=${encodeURIComponent(m.nombre)}`} className="marcas-repuesto__item">{m.nombre}</Link>
          ))}
        </div>
      </section>
    </div>
  );
}

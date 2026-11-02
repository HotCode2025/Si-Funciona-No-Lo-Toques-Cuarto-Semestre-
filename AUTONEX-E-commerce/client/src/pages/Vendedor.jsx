import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Car, Clock, MapPin, MessageCircle, Phone, Recycle, Search } from 'lucide-react';
import { Paginacion, TarjetaProducto } from '../components/Producto.jsx';
import { Cargando, ErrorMensaje, Vacio } from '../components/Estados.jsx';
import Avatar from '../components/Avatar.jsx';
import { useVehiculo } from '../context/VehiculoContext.jsx';
import { useApi, useTitulo } from '../lib/hooks.js';
import { plural } from '../lib/formato.js';
import { DIAS, estadoAhora, textoTurnos } from '../lib/horarios.js';

/** Horario de la semana con el día de hoy marcado y si el local está abierto ahora (hora de Argentina). */
function HorarioLocal({ v }) {
  if (!v.horarios) return <li><Clock size={18} /><span>{v.horario}</span></li>;
  const estado = estadoAhora(v.horarios);
  return (
    <li className="vendedor-horario">
      <Clock size={18} />
      <div>
        <span className={`vendedor-horario__estado ${estado.abierto ? 'vendedor-horario__estado--abierto' : ''}`}>
          <strong>{estado.abierto ? 'Abierto ahora' : 'Cerrado ahora'}</strong>{estado.detalle && <> · {estado.detalle}</>}
        </span>
        <table className="vendedor-horario__tabla">
          <tbody>
            {v.horarios.map((d, i) => (
              <tr key={DIAS[i]} className={i === estado.dia ? 'hoy' : ''}>
                <th scope="row">{DIAS[i]}</th>
                <td>{d.abierto && d.turnos.length ? textoTurnos(d.turnos) : 'Cerrado'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </li>
  );
}

export default function Vendedor() {
  const { slug } = useParams();
  const [params, setParams] = useSearchParams();
  const { vehiculo } = useVehiculo();
  const [texto, setTexto] = useState(params.get('q') || '');
  const vendedor = useApi(`/vendedores/${slug}`);
  const v = vendedor.datos;
  useTitulo(v?.nombre_comercial);

  const soloCompatibles = params.get('todos') !== '1';
  const consulta = v && {
    vendedor: v.id,
    categoria: params.get('categoria') || undefined,
    q: params.get('q') || undefined,
    pagina: params.get('pagina') || 1,
    por_pagina: 20,
    orden: 'nombre',
    vehiculo: vehiculo && soloCompatibles ? vehiculo.id : undefined,
  };
  const productos = useApi(v ? '/productos' : null, { query: consulta }, JSON.stringify(consulta));

  const cambiar = (cambios) => {
    const nuevos = new URLSearchParams(params);
    for (const [k, val] of Object.entries(cambios)) {
      if (!val) nuevos.delete(k);
      else nuevos.set(k, val);
    }
    if (!('pagina' in cambios)) nuevos.delete('pagina');
    setParams(nuevos);
  };

  if (vendedor.cargando) return <div className="contenedor pagina"><Cargando /></div>;
  if (vendedor.error) return <div className="contenedor pagina"><ErrorMensaje error={vendedor.error} /></div>;
  if (!v) return null;

  return (
    <div className="pagina-vendedor">
      <section className="vendedor-portada">
        <div className="contenedor vendedor-portada__grilla">
          <Avatar src={v.logo} nombre={v.nombre_comercial} redondo={false} className="vendedor-portada__logo" />
          <div>
            <nav className="migas migas--claro" aria-label="Ubicación">
              <Link to="/">Inicio</Link><span aria-hidden="true">/</span><Link to="/vendedores">Vendedores</Link>
            </nav>
            <h1>{v.nombre_comercial}</h1>
            {v.es_desarmadero && <span className="etiqueta-desarmadero"><Recycle size={14} /> Desarmadero habilitado · vende repuestos usados</span>}
            <p className="vendedor-portada__descripcion">{v.descripcion}</p>
          </div>
        </div>
      </section>

      <div className="contenedor vendedor-cuerpo">
        <aside className="tarjeta tarjeta--padding vendedor-datos">
          <h2>Datos del local</h2>
          <ul>
            <li><MapPin size={18} /><span><strong>{v.direccion}</strong><br />{v.ciudad}, {v.provincia}</span></li>
            <HorarioLocal v={v} />
            {v.telefono && <li><Phone size={18} /><a href={`tel:${v.telefono.replace(/[^0-9+]/g, '')}`}>{v.telefono}</a></li>}
            {v.whatsapp && (
              <li><MessageCircle size={18} />
                <a href={`https://wa.me/${v.whatsapp}`} target="_blank" rel="noreferrer">WhatsApp +{v.whatsapp}</a>
              </li>
            )}
          </ul>
          <p className="texto-chico texto-gris">{plural(v.publicaciones, 'publicación activa', 'publicaciones activas')}</p>
          <p className="texto-chico texto-gris">Podés elegir <strong>retiro en el local</strong> en este domicilio y horario cuando compres.</p>
        </aside>

        <section className="vendedor-productos">
          <div className="fila fila--entre fila--envolver vendedor-productos__barra">
            <h2 className="titulo-seccion">Productos de {v.nombre_comercial}</h2>
            <form className="buscador-chico" onSubmit={(e) => { e.preventDefault(); cambiar({ q: texto.trim() }); }}>
              <input className="input" type="search" placeholder="Buscar en este local…" value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Buscar en este local" />
              <button type="submit" className="btn btn--oscuro" aria-label="Buscar"><Search size={18} /></button>
            </form>
          </div>
          <div className="chips vendedor-productos__categorias">
            <button type="button" className={`chip ${!params.get('categoria') ? 'activo' : ''}`} onClick={() => cambiar({ categoria: null })}>Todas</button>
            {v.categorias.map((c) => (
              <button key={c.slug} type="button" className={`chip ${params.get('categoria') === c.slug ? 'activo' : ''}`}
                onClick={() => cambiar({ categoria: c.slug })}>{c.nombre}</button>
            ))}
          </div>
          {vehiculo && (
            <div className="aviso-vehiculo">
              <Car size={18} />
              <span>{soloCompatibles ? <>Mostrando solo lo compatible con tu <strong>{vehiculo.modelo} {vehiculo.anio}</strong>.</> : 'Mostrando todo el stock del local.'}</span>
              <button type="button" className="enlace" onClick={() => cambiar({ todos: soloCompatibles ? '1' : null })}>
                {soloCompatibles ? 'Ver todo el local' : 'Solo compatibles'}
              </button>
            </div>
          )}
          {productos.cargando && !productos.datos && <Cargando />}
          <ErrorMensaje error={productos.error} />
          {productos.datos?.productos.length === 0 && <Vacio titulo="Sin resultados">Este local no tiene repuestos que coincidan con la búsqueda.</Vacio>}
          {productos.datos?.productos.length > 0 && (
            <div className="grilla-productos">
              {productos.datos.productos.map((p) => <TarjetaProducto key={p.id} producto={p} vehiculo={soloCompatibles ? vehiculo : null} etiquetaPrecio="Precio" vendedor={slug} />)}
            </div>
          )}
          {productos.datos && (
            <Paginacion pagina={productos.datos.pagina} paginas={productos.datos.paginas} alCambiar={(n) => cambiar({ pagina: String(n) })} />
          )}
        </section>
      </div>
    </div>
  );
}

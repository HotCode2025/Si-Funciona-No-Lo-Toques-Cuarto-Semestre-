import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Car, ChevronDown, Database, LogOut, Package, Search, ShoppingCart, Store, User, UserRound, X } from 'lucide-react';
import Logo from './Logo.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import Avatar from './Avatar.jsx';
import { useCarrito } from '../context/CarritoContext.jsx';
import { useVehiculo } from '../context/VehiculoContext.jsx';
import { categoriasRaiz, useCategorias, useClickAfuera } from '../lib/hooks.js';

function MenuCuenta() {
  const { usuario, cerrarSesion, esVendedor } = useAuth();
  const [abierto, setAbierto] = useState(false);
  const cerrar = useCallback(() => setAbierto(false), []);
  const ref = useClickAfuera(abierto, cerrar);
  const navegar = useNavigate();
  const { pathname } = useLocation();

  useEffect(cerrar, [pathname, cerrar]);

  // Sin sesión: las compras hechas sin cuenta se siguen en "Seguí tu compra" (número de compra + email)
  if (!usuario) {
    return (
      <>
        <Link to="/seguir-compra" className="header__accion" aria-label="Mis compras: seguí tu compra sin cuenta">
          <Package size={22} aria-hidden="true" />
          <span className="header__accion-texto">Mis compras</span>
        </Link>
        <Link to="/ingresar" state={{ desde: pathname }} className="header__accion" aria-label="Ingresá a tu cuenta">
          <User size={22} aria-hidden="true" />
          <span className="header__accion-texto">Ingresá</span>
        </Link>
      </>
    );
  }

  return (
    <div className="menu-cuenta" ref={ref}>
      <button type="button" className="header__accion" aria-expanded={abierto} aria-haspopup="menu"
        aria-label={`Mi cuenta (${usuario.nombre})`} onClick={() => setAbierto((a) => !a)}>
        {usuario.avatar ? <Avatar src={usuario.avatar} className="header__avatar" /> : <User size={22} aria-hidden="true" />}
        <span className="header__accion-texto">{usuario.nombre}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {abierto && (
        <div className="menu-cuenta__panel" role="menu">
          <div className="menu-cuenta__cabecera">
            <Avatar src={usuario.avatar} nombre={`${usuario.nombre} ${usuario.apellido}`} className="menu-cuenta__avatar" />
            <strong>{usuario.nombre} {usuario.apellido}</strong>
            <span>{usuario.email}</span>
          </div>
          <Link role="menuitem" to="/mi-cuenta"><UserRound size={18} /> Mi cuenta</Link>
          <Link role="menuitem" to="/mis-compras"><Package size={18} /> Mis compras</Link>
          {esVendedor && <Link role="menuitem" to="/panel"><Store size={18} /> Panel de {usuario.vendedor?.nombre_comercial || 'mi local'}</Link>}
          {usuario.rol === 'admin' && <Link role="menuitem" to="/admin"><Database size={18} /> Administrar catálogo</Link>}
          <button role="menuitem" type="button" onClick={() => { cerrarSesion(); navegar('/'); }}>
            <LogOut size={18} /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

function Buscador() {
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const [texto, setTexto] = useState('');

  useEffect(() => {
    setTexto(pathname === '/catalogo' ? params.get('q') || '' : '');
  }, [pathname, params]);

  const buscar = (e) => {
    e.preventDefault();
    const q = texto.trim();
    navegar(q ? `/catalogo?q=${encodeURIComponent(q)}` : '/catalogo');
  };

  return (
    <form className="buscador" role="search" onSubmit={buscar}>
      <label htmlFor="buscador-input" className="sr-only">Buscar repuestos por nombre o código de pieza</label>
      <input id="buscador-input" type="search" value={texto} onChange={(e) => setTexto(e.target.value)}
        placeholder="Buscá por repuesto, marca o código de pieza…" autoComplete="off" />
      {texto && (
        <button type="button" className="buscador__limpiar" onClick={() => setTexto('')} aria-label="Borrar búsqueda">
          <X size={16} />
        </button>
      )}
      <button type="submit" className="buscador__boton" aria-label="Buscar">
        <Search size={20} />
      </button>
    </form>
  );
}

function BarraVehiculo() {
  const { vehiculo, abrirSelector, quitar } = useVehiculo();
  if (!vehiculo) {
    return (
      <div className="barra-vehiculo barra-vehiculo--vacia">
        <div className="contenedor barra-vehiculo__interior">
          <span><Car size={18} aria-hidden="true" /> <strong>¿Qué auto tenés?</strong> Elegilo y te mostramos solo los repuestos que le sirven.</span>
          <button type="button" className="btn btn--chico btn--oscuro" onClick={() => abrirSelector()}>Elegir mi vehículo</button>
        </div>
      </div>
    );
  }
  return (
    <div className="barra-vehiculo">
      <div className="contenedor barra-vehiculo__interior">
        <span className="barra-vehiculo__texto">
          <Car size={18} aria-hidden="true" />
          <span>Repuestos para tu <strong>{vehiculo.marca} {vehiculo.modelo} {vehiculo.anio}</strong>
            <span className="barra-vehiculo__version"> · {vehiculo.version}</span></span>
        </span>
        <span className="fila">
          <button type="button" className="enlace" onClick={() => abrirSelector()}>Cambiar</button>
          <button type="button" className="enlace enlace--gris" onClick={quitar}>Quitar</button>
        </span>
      </div>
    </div>
  );
}

function LinkCategoria({ slug, children }) {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const activa = pathname === '/catalogo' && (params.get('categoria') || '') === (slug || '');
  return (
    <Link to={slug ? `/catalogo?categoria=${slug}` : '/catalogo'} className={`header__cat ${activa ? 'active' : ''}`}
      aria-current={activa ? 'page' : undefined}>
      {children}
    </Link>
  );
}

export default function Header() {
  const { unidades } = useCarrito();
  const { vehiculo, abrirSelector } = useVehiculo();
  const categorias = useCategorias();

  return (
    <header className="header">
      <div className="header__principal">
        <div className="contenedor header__fila">
          <Link to="/" className="header__logo" aria-label="AUTONEX, ir al inicio"><Logo /></Link>
          <Buscador />
          <nav className="header__acciones" aria-label="Cuenta y carrito">
            <button type="button" className={`header__accion header__vehiculo ${vehiculo ? 'header__vehiculo--activo' : ''}`}
              onClick={() => abrirSelector()}
              aria-label={vehiculo ? `Mi vehículo: ${vehiculo.marca} ${vehiculo.modelo} ${vehiculo.anio}. Cambiar` : 'Elegir mi vehículo'}>
              <Car size={22} aria-hidden="true" />
              <span className="header__accion-texto">
                <small>Mi vehículo</small>
                {vehiculo ? `${vehiculo.modelo} ${vehiculo.anio}` : 'Elegir'}
              </span>
            </button>
            <MenuCuenta />
            <Link to="/carrito" className="header__accion header__carrito" aria-label={`Carrito, ${unidades} productos`}>
              <ShoppingCart size={22} aria-hidden="true" />
              {unidades > 0 && <span className="header__burbuja">{unidades > 99 ? '99+' : unidades}</span>}
              <span className="header__accion-texto">Carrito</span>
            </Link>
          </nav>
        </div>
      </div>
      <nav className="header__categorias" aria-label="Categorías">
        <div className="contenedor header__categorias-lista">
          <LinkCategoria slug="">Todo</LinkCategoria>
          {categoriasRaiz(categorias).map((c) => <LinkCategoria key={c.slug} slug={c.slug}>{c.nombre}</LinkCategoria>)}
          <NavLink to="/vendedores" className="header__cat header__cat--vendedores">Vendedores</NavLink>
        </div>
      </nav>
      <BarraVehiculo />
    </header>
  );
}

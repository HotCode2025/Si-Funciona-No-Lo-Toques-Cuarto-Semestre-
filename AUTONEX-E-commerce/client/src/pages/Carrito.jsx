import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, MapPin, ShoppingCart, Store, Trash2 } from 'lucide-react';
import { CodigoPieza, EtiquetaCondicion, SelectorCantidad } from '../components/Producto.jsx';
import { Vacio } from '../components/Estados.jsx';
import { useCarrito } from '../context/CarritoContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useTitulo } from '../lib/hooks.js';
import { imagen, plural, precio } from '../lib/formato.js';

export default function Carrito() {
  useTitulo('Carrito');
  const { grupos, total, unidades, cambiarCantidad, quitar, vaciar, sincronizar } = useCarrito();
  const { usuario } = useAuth();
  const navegar = useNavigate();
  const [mensajes, setMensajes] = useState([]);

  // Al entrar al carrito se actualizan precios y stock con los valores reales.
  useEffect(() => {
    sincronizar().then(setMensajes).catch(() => {});
  }, [sincronizar]);

  if (!grupos.length) {
    return (
      <div className="contenedor pagina">
        <h1 className="titulo-seccion">Carrito</h1>
        {mensajes.length > 0 && <AvisosCarrito mensajes={mensajes} />}
        <Vacio icono={ShoppingCart} titulo="Tu carrito está vacío"
          accion={<Link to="/catalogo" className="btn btn--primario">Ver repuestos</Link>}>
          Agregá repuestos de uno o varios vendedores y pagalos juntos con Mercado Pago.
        </Vacio>
      </div>
    );
  }

  // Se puede comprar con o sin cuenta: el checkout lo ofrece en el primer paso
  const continuar = () => navegar('/checkout');

  return (
    <div className="contenedor pagina">
      <div className="fila fila--entre fila--envolver">
        <h1 className="titulo-seccion">Carrito <span className="texto-gris">({plural(unidades, 'producto', 'productos')})</span></h1>
        <button type="button" className="btn btn--fantasma btn--chico" onClick={vaciar}><Trash2 size={16} /> Vaciar carrito</button>
      </div>
      {mensajes.length > 0 && <AvisosCarrito mensajes={mensajes} />}

      <div className="carrito">
        <div className="carrito__grupos">
          {grupos.length > 1 && (
            <p className="alerta alerta--info carrito__nota">
              <Store size={18} /> Le estás comprando a {grupos.length} vendedores: en el checkout elegís la forma de entrega para cada uno y pagás todo junto.
            </p>
          )}
          {grupos.map((g) => (
            <section key={g.vendedor.id} className="tarjeta grupo-vendedor">
              <header className="grupo-vendedor__cabecera">
                <Link to={`/vendedores/${g.vendedor.slug}`} className="grupo-vendedor__nombre">
                  <Store size={18} /> {g.vendedor.nombre_comercial}
                </Link>
                <span className="texto-gris texto-chico"><MapPin size={13} /> {g.vendedor.ciudad}, {g.vendedor.provincia}</span>
              </header>
              <ul className="items-carrito">
                {g.items.map((i) => (
                  <li key={i.publicacion_id} className="item-carrito">
                    <Link to={`/producto/${i.producto.id}`} className="item-carrito__img"><img src={imagen(i.producto.imagen)} alt="" /></Link>
                    <div className="item-carrito__info">
                      <span className="tarjeta-producto__marca">{i.producto.marca}</span>
                      <Link to={`/producto/${i.producto.id}`} className="item-carrito__nombre">{i.producto.nombre}</Link>
                      <div className="fila fila--envolver">
                        <CodigoPieza codigo={i.producto.numero_pieza} />
                        <EtiquetaCondicion condicion={i.condicion} />
                      </div>
                      <span className="texto-chico texto-gris">{precio(i.precio)} c/u · stock disponible: {i.stock}</span>
                    </div>
                    <div className="item-carrito__acciones">
                      <SelectorCantidad chico valor={i.cantidad} maximo={i.stock} alCambiar={(n) => cambiarCantidad(i.publicacion_id, n)} />
                      {i.cantidad >= i.stock && <small className="texto-gris">Máximo disponible</small>}
                      <button type="button" className="enlace enlace--gris texto-chico" onClick={() => quitar(i.publicacion_id)}>Quitar</button>
                    </div>
                    <strong className="item-carrito__subtotal">{precio(i.precio * i.cantidad)}</strong>
                  </li>
                ))}
              </ul>
              <footer className="grupo-vendedor__pie">
                <span>Subtotal {g.vendedor.nombre_comercial}</span>
                <strong>{precio(g.subtotal)}</strong>
              </footer>
            </section>
          ))}
        </div>

        <aside className="tarjeta tarjeta--padding resumen-compra">
          <h2>Resumen</h2>
          {grupos.map((g) => (
            <div key={g.vendedor.id} className="resumen-compra__fila">
              <span>{g.vendedor.nombre_comercial}</span><span>{precio(g.subtotal)}</span>
            </div>
          ))}
          <div className="resumen-compra__fila texto-gris"><span>Envíos</span><span>Se calculan en el checkout</span></div>
          <div className="resumen-compra__total"><span>Total productos</span><strong>{precio(total)}</strong></div>
          <button type="button" className="btn btn--primario btn--bloque" onClick={continuar}>Continuar compra</button>
          {!usuario && <p className="texto-chico texto-gris">Podés comprar sin cuenta, o <Link to="/ingresar" state={{ desde: '/checkout' }}>iniciar sesión</Link> para tenerla en “Mis compras”.</p>}
          <Link to="/catalogo" className="enlace texto-chico">Seguir comprando</Link>
        </aside>
      </div>
    </div>
  );
}

function AvisosCarrito({ mensajes }) {
  return (
    <div className="alerta alerta--aviso carrito__avisos">
      <AlertTriangle size={20} />
      <div><strong>Actualizamos tu carrito</strong><ul>{mensajes.map((m) => <li key={m}>{m}</li>)}</ul></div>
    </div>
  );
}

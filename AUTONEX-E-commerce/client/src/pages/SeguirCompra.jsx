import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LogOut, PackageSearch } from 'lucide-react';
import { Cargando, ErrorMensaje } from '../components/Estados.jsx';
import { TarjetaCompra } from './MisCompras.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import { cabeceraCompra, comprasDelNavegador, guardarCompraInvitado, olvidarComprasInvitado } from '../lib/comprasInvitado.js';
import { useTitulo } from '../lib/hooks.js';

/**
 * Compras hechas sin cuenta: se buscan con el número de compra y el email. Por privacidad no quedan guardadas en el
 * navegador: solo se ven en esta pestaña hasta cerrarla (o tocar "Cerrar"). Desde acá se puede pagar, reintentar el
 * pago, ver cómo va cada pedido y abrir el comprobante.
 */
export default function SeguirCompra() {
  useTitulo('Seguí tu compra');
  const { usuario } = useAuth();
  const [params] = useSearchParams();
  const [compras, setCompras] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState({ compra_id: params.get('compra') || '', email: '' });
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState(null);

  // Las compras sin cuenta abiertas en esta pestaña (si una ya no existe, se omite)
  useEffect(() => {
    let cancelado = false;
    Promise.all(comprasDelNavegador().map((id) => api(`/compras/${id}`, { headers: cabeceraCompra(id) }).catch(() => null)))
      .then((lista) => { if (!cancelado) setCompras(lista.filter(Boolean)); })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, []);

  const buscar = async (e) => {
    e.preventDefault();
    setBuscando(true);
    setError(null);
    try {
      const r = await api('/compras/buscar', { method: 'POST', body: { compra_id: Number(busqueda.compra_id), email: busqueda.email.trim() } });
      guardarCompraInvitado(r.compra.id, r.codigo_acceso);
      setCompras((lista) => [r.compra, ...lista.filter((c) => c.id !== r.compra.id)]);
      setBusqueda({ compra_id: '', email: '' });
    } catch (err) {
      setError(err);
    } finally {
      setBuscando(false);
    }
  };

  const actualizar = (compra) => setCompras((lista) => lista.map((c) => (c.id === compra.id ? compra : c)));
  const cerrar = () => {
    olvidarComprasInvitado();
    setCompras([]);
  };

  return (
    <div className="contenedor pagina mis-compras">
      <h1 className="titulo-seccion">Seguí tu compra</h1>
      <p className="texto-gris">
        Si compraste sin cuenta, buscá tu compra con su número y el email que usaste: vas a ver el estado de cada pedido,
        el número de seguimiento del envío y el comprobante. Por privacidad no queda guardada en este navegador.
        {usuario && <> Las compras que hiciste con tu cuenta están en <Link to="/mis-compras">Mis compras</Link>.</>}
      </p>

      <form className="tarjeta tarjeta--padding seguir-compra__form" onSubmit={buscar}>
        <PackageSearch size={22} aria-hidden="true" />
        <div className="campo">
          <label htmlFor="seguir-numero">Número de compra</label>
          <input id="seguir-numero" className="input" type="number" min="1" inputMode="numeric" required value={busqueda.compra_id}
            onChange={(e) => setBusqueda((b) => ({ ...b, compra_id: e.target.value }))} placeholder="Ej: 125" />
        </div>
        <div className="campo">
          <label htmlFor="seguir-email">Email que usaste al comprar</label>
          <input id="seguir-email" className="input" type="email" required value={busqueda.email}
            onChange={(e) => setBusqueda((b) => ({ ...b, email: e.target.value }))} placeholder="tu@email.com" />
        </div>
        <button type="submit" className="btn btn--primario" disabled={buscando}>{buscando ? 'Buscando…' : 'Buscar compra'}</button>
      </form>
      <ErrorMensaje error={error} />

      {cargando && <Cargando texto="Buscando tus compras…" />}
      <div className="pila">
        {compras.map((c) => <TarjetaCompra key={c.id} compra={c} alActualizar={actualizar} cabeceras={cabeceraCompra(c.id)} />)}
      </div>
      {compras.length > 0 && (
        <p className="seguir-compra__cerrar texto-chico texto-gris">
          ¿Estás en una computadora compartida? Tus compras se borran de esta pantalla al cerrar la pestaña.
          <button type="button" className="btn btn--chico" onClick={cerrar}><LogOut size={15} /> Cerrar ahora</button>
        </p>
      )}
      {!cargando && !compras.length && (
        <p className="texto-gris texto-chico">El número de compra está en el comprobante y en la pantalla de pago aprobado.</p>
      )}
    </div>
  );
}

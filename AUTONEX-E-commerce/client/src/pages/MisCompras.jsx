import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AlertTriangle, Check, CreditCard, FileText, MapPin, Package, RefreshCw, Store, Truck, Undo2 } from 'lucide-react';
import { Cargando, ErrorMensaje, EtiquetaEstado, Vacio } from '../components/Estados.jsx';
import { useAvisos } from '../context/AvisosContext.jsx';
import { api } from '../lib/api.js';
import { etiquetaDe, useApi, useReferencias, useTitulo } from '../lib/hooks.js';
import { fechaYHora, imagen, precio } from '../lib/formato.js';
import { ESTADOS_COMPRA, ESTADOS_PAGO_MP, ESTADOS_PEDIDO, MEDIOS_PAGO_MP, pasosPedido } from '../lib/constantes.js';

/** Línea de tiempo del pedido: pagado → en preparación → enviado / listo para retirar → entregado. */
export function LineaTiempo({ estado, metodo }) {
  const pasos = pasosPedido(metodo);
  const actual = pasos.indexOf(estado);
  return (
    <ol className="linea-tiempo">
      {pasos.map((p, i) => (
        <li key={p} className={actual >= 0 && i <= actual ? 'hecho' : ''}>
          <span className="linea-tiempo__punto">{actual >= 0 && i <= actual ? <Check size={12} /> : null}</span>
          <span className="linea-tiempo__texto">{ESTADOS_PEDIDO[p].texto}</span>
        </li>
      ))}
    </ol>
  );
}

export function DatosEntrega({ envio, vendedor }) {
  const referencias = useReferencias();
  if (envio.metodo === 'retiro') {
    return (
      <div className="datos-entrega">
        <Store size={18} />
        <div>
          <strong>Retiro en el local</strong>
          <span>{vendedor.direccion}, {vendedor.ciudad}, {vendedor.provincia}</span>
          <span className="texto-gris">{vendedor.horario}</span>
        </div>
      </div>
    );
  }
  return (
    <div className="datos-entrega">
      <Truck size={18} />
      <div>
        <strong>Envío a domicilio · {etiquetaDe(referencias, 'transportistas', envio.transportista)}</strong>
        <span>{envio.calle} {envio.numero}{envio.piso_depto ? `, ${envio.piso_depto}` : ''} · {envio.localidad}, {envio.provincia} ({envio.codigo_postal})</span>
        <span className="texto-gris">Demora estimada: {envio.demora_estimada} · Costo {precio(envio.costo)}</span>
        {envio.numero_seguimiento && (
          <span className="datos-entrega__seguimiento">N° de seguimiento: <strong className="mono">{envio.numero_seguimiento}</strong></span>
        )}
      </div>
    </div>
  );
}

/** Una compra con sus pedidos. `cabeceras`: el código de acceso de una compra sin cuenta (ver comprasInvitado.js). */
export function TarjetaCompra({ compra, alActualizar, cabeceras }) {
  const { avisar } = useAvisos();
  const [ocupado, setOcupado] = useState(null);
  const [error, setError] = useState(null);
  const pendiente = compra.estado === 'pendiente_pago' || compra.estado === 'pago_rechazado';

  const pagar = async () => {
    setOcupado('pagar');
    setError(null);
    try {
      const { init_point: url } = await api(`/compras/${compra.id}/pagar`, { method: 'POST', headers: cabeceras });
      window.location.href = url;
    } catch (err) {
      setError(err);
      setOcupado(null);
    }
  };

  const verificar = async () => {
    setOcupado('verificar');
    setError(null);
    try {
      const r = await api(`/compras/${compra.id}/verificar-pago`, { method: 'POST', headers: cabeceras });
      alActualizar(r.compra);
      avisar(r.pagos_encontrados ? `Estado actualizado: ${ESTADOS_COMPRA[r.compra.estado].texto}.` : 'Mercado Pago todavía no registra pagos para esta compra.', r.pagos_encontrados ? 'exito' : 'info');
    } catch (err) {
      setError(err);
    } finally {
      setOcupado(null);
    }
  };

  return (
    <article className="tarjeta compra">
      <header className="compra__cabecera">
        <div>
          <h2>Compra #{compra.id}</h2>
          <span className="texto-gris texto-chico">{fechaYHora(compra.creado_en)} · {compra.pedidos.length} {compra.pedidos.length === 1 ? 'vendedor' : 'vendedores'}</span>
        </div>
        <div className="compra__total">
          <EtiquetaEstado estado={compra.estado} mapa={ESTADOS_COMPRA} />
          <strong>{precio(compra.total)}</strong>
        </div>
      </header>

      {pendiente && (
        <div className="compra__pago-pendiente">
          <AlertTriangle size={18} />
          <span>{compra.estado === 'pago_rechazado' ? 'El último intento de pago fue rechazado.' : 'Esta compra todavía no está pagada.'} El stock se descuenta recién cuando Mercado Pago aprueba el pago.</span>
          <div className="fila fila--envolver">
            <button type="button" className="btn btn--mp btn--chico" onClick={pagar} disabled={Boolean(ocupado)}>
              <CreditCard size={16} /> {ocupado === 'pagar' ? 'Abriendo…' : 'Pagar con Mercado Pago'}
            </button>
            <button type="button" className="btn btn--chico" onClick={verificar} disabled={Boolean(ocupado)}>
              <RefreshCw size={16} /> {ocupado === 'verificar' ? 'Consultando…' : 'Ya pagué: verificar'}
            </button>
          </div>
        </div>
      )}
      <ErrorMensaje error={error} />

      <div className="compra__pedidos">
        {compra.pedidos.map((p) => (
          <section key={p.id} className="pedido">
            <header className="pedido__cabecera">
              <Link to={`/vendedores/${p.vendedor.slug}`} className="pedido__vendedor"><Store size={17} /> {p.vendedor.nombre_comercial}</Link>
              <span className="texto-gris texto-chico">Pedido #{p.id}</span>
              <EtiquetaEstado estado={p.estado} mapa={ESTADOS_PEDIDO} />
            </header>
            {p.estado !== 'pendiente_pago' && p.estado !== 'cancelado' && <LineaTiempo estado={p.estado} metodo={p.envio.metodo} />}
            <ul className="pedido__items">
              {p.items.map((i) => (
                <li key={i.id}>
                  <img src={imagen(i.imagen)} alt="" />
                  <span><Link to={`/producto/${i.producto_id}`}>{i.nombre}</Link><small className="texto-gris"> · {i.numero_pieza} · {i.condicion}</small></span>
                  <span className="texto-gris">{i.cantidad} × {precio(i.precio_unitario)}</span>
                  <strong>{precio(i.subtotal)}</strong>
                </li>
              ))}
            </ul>
            <DatosEntrega envio={p.envio} vendedor={p.vendedor} />
            {p.reintegro && (
              <p className={`alerta ${p.reintegro.estado === 'aprobado' ? 'alerta--info' : 'alerta--aviso'} texto-chico`}>
                <Undo2 size={16} />
                <span>
                  Pedido cancelado por tu arrepentimiento. Reintegro de <strong>{precio(p.reintegro.monto)}</strong> al mismo medio de pago:{' '}
                  <strong>{p.reintegro.estado === 'aprobado' ? 'aprobado por Mercado Pago' : 'en proceso'}</strong>.
                  {p.reintegro.estado === 'aprobado' && ' Según tu medio de pago puede tardar unos días en verse (con tarjeta de crédito, en el próximo resumen).'}
                </span>
              </p>
            )}
            {p.nota && !p.reintegro && <p className="alerta alerta--aviso texto-chico">{p.nota}</p>}
            <footer className="pedido__pie">
              <span>Productos {precio(p.subtotal)} · Envío {p.costo_envio > 0 ? precio(p.costo_envio) : 'gratis'}</span>
              <strong>{precio(p.total)}</strong>
            </footer>
          </section>
        ))}
      </div>
      {compra.arrepentimiento && (
        <p className="alerta alerta--info compra__arrepentimiento">
          <Undo2 size={18} />
          <span>
            Pediste revocar esta compra el {fechaYHora(compra.arrepentimiento.creado_en)}. Código: <strong className="mono">{compra.arrepentimiento.codigo}</strong>.{' '}
            {compra.arrepentimiento.estado === 'resuelto'
              ? 'Ya se cancelaron todos los pedidos y se pidió el reintegro del total.'
              : 'Los pedidos quedan frenados: cada vendedor los cancela y te reintegramos el total. Si ya recibiste algún producto, el vendedor coordina con vos la devolución.'}
          </span>
        </p>
      )}
      {compra.estado === 'pagada' && (
        <div className="compra__comprobante fila fila--envolver">
          <Link to={`/comprobante/${compra.id}`} className="btn btn--chico"><FileText size={16} /> Comprobante para guardar o compartir</Link>
          {!compra.arrepentimiento && (
            <Link to={`/arrepentimiento?compra=${compra.id}`} className="btn btn--chico btn--fantasma"><Undo2 size={16} /> Botón de arrepentimiento</Link>
          )}
        </div>
      )}
      {compra.ultimo_pago?.mp_pago_id && (
        <p className="texto-mini texto-gris compra__pago">
          Pago Mercado Pago <span className="mono">{compra.ultimo_pago.mp_pago_id}</span> · {ESTADOS_PAGO_MP[compra.ultimo_pago.estado] || compra.ultimo_pago.estado}
          {compra.ultimo_pago.medio_pago ? ` · ${MEDIOS_PAGO_MP[compra.ultimo_pago.medio_pago] || compra.ultimo_pago.medio_pago}` : ''}
        </p>
      )}
    </article>
  );
}

export default function MisCompras() {
  useTitulo('Mis compras');
  const { state } = useLocation();
  const { datos, error, cargando, setDatos } = useApi('/compras');

  const actualizar = (compra) => setDatos((lista) => lista.map((c) => (c.id === compra.id ? compra : c)));

  return (
    <div className="contenedor pagina mis-compras">
      <h1 className="titulo-seccion">Mis compras</h1>
      {state?.errorPago && (
        <div className="alerta alerta--aviso">
          <AlertTriangle size={20} />
          <span>La compra #{state.compraId} quedó registrada pero no se pudo abrir Mercado Pago: {state.errorPago} Podés reintentar el pago desde acá.</span>
        </div>
      )}
      {cargando && <Cargando />}
      <ErrorMensaje error={error} />
      {datos?.length === 0 && (
        <Vacio icono={Package} titulo="Todavía no hiciste compras" accion={<Link to="/catalogo" className="btn btn--primario">Buscar repuestos</Link>}>
          Cuando compres vas a ver acá el estado de cada pedido y su envío.
        </Vacio>
      )}
      <div className="pila">
        {datos?.map((c) => <TarjetaCompra key={c.id} compra={c} alActualizar={actualizar} />)}
      </div>
      {datos?.length > 0 && <p className="texto-chico texto-gris"><MapPin size={14} /> Cada vendedor actualiza el estado de su pedido desde su panel.</p>}
    </div>
  );
}

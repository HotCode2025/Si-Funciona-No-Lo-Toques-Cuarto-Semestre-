import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CircleCheck, ClipboardList, Mail, Phone, RefreshCw, Undo2, User } from 'lucide-react';
import { Cargando, ErrorMensaje, EtiquetaEstado, Vacio } from '../../components/Estados.jsx';
import { useAvisos } from '../../context/AvisosContext.jsx';
import { api } from '../../lib/api.js';
import { etiquetaDe, useApi, useReferencias, useTitulo } from '../../lib/hooks.js';
import { fechaYHora, imagen, precio } from '../../lib/formato.js';
import { ACCIONES_PEDIDO, ESTADOS_PEDIDO, TRANSPORTISTAS_CON_SEGUIMIENTO } from '../../lib/constantes.js';
import { DatosEntrega, LineaTiempo } from '../MisCompras.jsx';

const FILTROS = [
  ['activos', 'Activos'], ['pagado', 'Pagados'], ['en_preparacion', 'En preparación'], ['enviado', 'Enviados'],
  ['listo_para_retirar', 'Listos para retirar'], ['entregado', 'Entregados'], ['arrepentimiento', 'Arrepentimientos'],
  ['cancelado', 'Cancelados'], ['todos', 'Todos'],
];

const ESTADOS_REINTEGRO = { aprobado: 'aprobado por Mercado Pago', pendiente: 'en proceso', error: 'con error' };

/**
 * Botón de arrepentimiento del comprador: el pedido queda frenado (no se prepara ni se despacha). El vendedor lo cancela
 * —si el comprador ya tiene el producto, cuando se lo devuelve— y AUTONEX reintegra el total con Mercado Pago.
 */
function ArrepentimientoPedido({ pedido, alCambiar }) {
  const { avisar } = useAvisos();
  const [devuelto, setDevuelto] = useState(false);
  const [reponer, setReponer] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  const a = pedido.arrepentimiento;
  const r = pedido.reintegro;

  const ejecutar = async (accion) => {
    setOcupado(true);
    setError(null);
    try {
      await accion();
    } catch (err) {
      setError(err);
    } finally {
      setOcupado(false);
    }
  };
  const revocar = () => {
    if (!window.confirm(`¿Cancelar el pedido #${pedido.id} y reintegrarle ${precio(pedido.total)} al comprador? No se puede deshacer.`)) return;
    ejecutar(async () => {
      const actualizado = await api(`/vendedor/pedidos/${pedido.id}/arrepentimiento`, {
        method: 'POST', body: { producto_devuelto: devuelto, reponer_stock: reponer },
      });
      alCambiar({ ...pedido, ...actualizado });
      avisar(actualizado.reintegro.estado === 'aprobado'
        ? `Pedido #${pedido.id} cancelado. Mercado Pago aprobó el reintegro de ${precio(actualizado.reintegro.monto)}.`
        : `Pedido #${pedido.id} cancelado. El reintegro quedó ${ESTADOS_REINTEGRO[actualizado.reintegro.estado]}.`,
      actualizado.reintegro.estado === 'error' ? 'error' : 'exito', 6000);
    });
  };
  const reintentar = () => ejecutar(async () => {
    const { reintegro } = await api(`/vendedor/pedidos/${pedido.id}/reintegro`, { method: 'POST' });
    alCambiar({ ...pedido, reintegro });
    avisar(reintegro.estado === 'aprobado' ? 'Mercado Pago aprobó el reintegro.' : `El reintegro sigue ${ESTADOS_REINTEGRO[reintegro.estado]}.`,
      reintegro.estado === 'aprobado' ? 'exito' : 'error');
  });

  if (r) {
    return (
      <div className={`alerta ${r.estado === 'error' ? 'alerta--error' : 'alerta--info'} pedido-vendedor__arrepentimiento`}>
        {r.estado === 'aprobado' ? <CircleCheck size={18} /> : <Undo2 size={18} />}
        <div>
          <span>
            <strong>Pedido cancelado por arrepentimiento</strong>{a && <> ({a.codigo})</>}. Reintegro de <strong>{precio(r.monto)}</strong> al comprador:{' '}
            <strong>{ESTADOS_REINTEGRO[r.estado]}</strong>{r.mp_reintegro_id && <> · Mercado Pago <span className="mono">{r.mp_reintegro_id}</span></>}.
          </span>
          {r.detalle && <p className="texto-chico">{r.detalle}</p>}
          {r.estado === 'error' && (
            <button type="button" className="btn btn--chico" disabled={ocupado} onClick={reintentar}>
              <RefreshCw size={15} /> {ocupado ? 'Reintentando…' : 'Reintentar el reintegro'}
            </button>
          )}
          <ErrorMensaje error={error} />
        </div>
      </div>
    );
  }
  if (!a) return null;
  if (!pedido.revocable) {
    return (
      <p className="alerta alerta--aviso pedido-vendedor__arrepentimiento">
        <Undo2 size={18} />
        <span>El comprador usó el Botón de arrepentimiento (<strong className="mono">{a.codigo}</strong>) el {fechaYHora(a.creado_en)}.</span>
      </p>
    );
  }
  return (
    <div className="alerta alerta--error pedido-vendedor__arrepentimiento pedido-vendedor__arrepentimiento--abierto">
      <Undo2 size={20} />
      <div className="pila pila--chica">
        <p>
          <strong>El comprador pidió revocar la compra</strong> con el Botón de arrepentimiento el {fechaYHora(a.creado_en)}.
          Código <strong className="mono">{a.codigo}</strong>.{a.motivo && <> Motivo: “{a.motivo}”.</>}
        </p>
        {pedido.en_manos_del_comprador ? (
          <p>El comprador ya tiene el producto. Coordiná con él la devolución (el envío de vuelta corre por tu cuenta) y, cuando lo recibas, cancelá el pedido para reintegrarle el dinero.</p>
        ) : (
          <p><strong>No prepares ni despaches este pedido:</strong> quedó frenado. Cancelalo para reintegrarle el dinero al comprador.</p>
        )}
        <div className="fila fila--envolver">
          {pedido.en_manos_del_comprador && (
            <label className="check"><input type="checkbox" checked={devuelto} onChange={(e) => setDevuelto(e.target.checked)} /> Ya recibí el producto devuelto</label>
          )}
          <label className="check"><input type="checkbox" checked={reponer} onChange={(e) => setReponer(e.target.checked)} /> Volver a poner las unidades en stock</label>
        </div>
        <div>
          <button type="button" className="btn btn--primario btn--chico" disabled={ocupado || (pedido.en_manos_del_comprador && !devuelto)} onClick={revocar}>
            <Undo2 size={15} /> {ocupado ? 'Cancelando…' : `Cancelar el pedido y reintegrar ${precio(pedido.total)}`}
          </button>
        </div>
        <small>AUTONEX le devuelve el total del pedido (productos y envío) por Mercado Pago, al mismo medio con el que pagó.</small>
        <ErrorMensaje error={error} />
      </div>
    </div>
  );
}

function TarjetaPedido({ pedido, alCambiar }) {
  const { avisar } = useAvisos();
  const referencias = useReferencias();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  const [seguimiento, setSeguimiento] = useState(pedido.envio.numero_seguimiento || '');
  const c = pedido.compra;
  // Envíos por transportista: el número de seguimiento se carga al despacharlo (y se puede corregir después)
  const conSeguimiento = pedido.envio.metodo === 'domicilio' && TRANSPORTISTAS_CON_SEGUIMIENTO.includes(pedido.envio.transportista)
    && ['en_preparacion', 'enviado', 'entregado'].includes(pedido.estado);
  const yaDespachado = ['enviado', 'entregado'].includes(pedido.estado);

  const conEnvio = (r) => ({
    ...pedido.envio,
    numero_seguimiento: r.numero_seguimiento ?? pedido.envio.numero_seguimiento,
    despachado_en: r.despachado_en ?? pedido.envio.despachado_en,
  });

  const avanzar = async (estado) => {
    setOcupado(true);
    setError(null);
    try {
      const body = { estado, ...(estado === 'enviado' && seguimiento.trim() ? { numero_seguimiento: seguimiento } : {}) };
      const r = await api(`/vendedor/pedidos/${pedido.id}/estado`, { method: 'PATCH', body });
      alCambiar({ ...pedido, estado: r.estado, siguientes_estados: r.siguientes_estados, envio: conEnvio(r) });
      avisar(`Pedido #${pedido.id}: ${ESTADOS_PEDIDO[r.estado].texto.toLowerCase()}.`);
    } catch (err) {
      setError(err);
    } finally {
      setOcupado(false);
    }
  };

  const guardarSeguimiento = async () => {
    setOcupado(true);
    setError(null);
    try {
      const r = await api(`/vendedor/pedidos/${pedido.id}/seguimiento`, { method: 'PUT', body: { numero_seguimiento: seguimiento } });
      setSeguimiento(r.numero_seguimiento);
      alCambiar({ ...pedido, envio: conEnvio(r) });
      avisar(`Pedido #${pedido.id}: número de seguimiento guardado.`, 'exito');
    } catch (err) {
      setError(err);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <article className="tarjeta pedido-vendedor">
      <header className="pedido-vendedor__cabecera">
        <div>
          <h2>Pedido #{pedido.id} <small className="texto-gris">· compra #{c.id}</small></h2>
          <span className="texto-gris texto-chico">Pagado el {fechaYHora(c.pagada_en || pedido.creado_en)}</span>
        </div>
        <EtiquetaEstado estado={pedido.estado} mapa={ESTADOS_PEDIDO} />
      </header>

      <ArrepentimientoPedido pedido={pedido} alCambiar={alCambiar} />
      {pedido.estado !== 'cancelado' && <LineaTiempo estado={pedido.estado} metodo={pedido.envio.metodo} />}

      <div className="pedido-vendedor__grilla">
        <div className="pedido-vendedor__bloque">
          <h3>Comprador</h3>
          <p><User size={15} /> {c.nombre} {c.apellido} · DNI {c.dni}</p>
          <p><Phone size={15} /> <a href={`tel:${c.telefono}`}>{c.telefono}</a></p>
          <p><Mail size={15} /> <a href={`mailto:${c.email}`}>{c.email}</a></p>
        </div>
        <div className="pedido-vendedor__bloque">
          <h3>Entrega</h3>
          {pedido.envio.metodo === 'retiro' ? (
            <p><strong>Retira en el local.</strong> Avisale cuando esté listo.</p>
          ) : (
            <DatosEntrega envio={pedido.envio} vendedor={{}} />
          )}
          {pedido.envio.observaciones && <p className="texto-chico">“{pedido.envio.observaciones}”</p>}
          {conSeguimiento && (
            <div className="seguimiento-vendedor">
              <label htmlFor={`seguimiento-${pedido.id}`}>N° de seguimiento de {etiquetaDe(referencias, 'transportistas', pedido.envio.transportista)}</label>
              <div className="fila">
                <input id={`seguimiento-${pedido.id}`} className="input" value={seguimiento} maxLength={40} placeholder="Ej: 360002345678"
                  onChange={(e) => setSeguimiento(e.target.value)} />
                {yaDespachado && (
                  <button type="button" className="btn btn--chico" onClick={guardarSeguimiento}
                    disabled={ocupado || !seguimiento.trim() || seguimiento.trim().toUpperCase() === pedido.envio.numero_seguimiento}>
                    Guardar
                  </button>
                )}
              </div>
              <small className="texto-gris">
                {yaDespachado ? 'El comprador lo ve en su compra y en el comprobante.' : 'Cargalo y marcá el pedido como enviado: el comprador lo ve en su compra y en el comprobante.'}
              </small>
            </div>
          )}
        </div>
      </div>

      <ul className="pedido__items">
        {pedido.items.map((i) => (
          <li key={i.id}>
            <img src={imagen(i.imagen)} alt="" />
            <span>{i.nombre}<small className="texto-gris"> · {i.numero_pieza} · {i.condicion}</small></span>
            <span className="texto-gris">{i.cantidad} × {precio(i.precio_unitario)}</span>
            <strong>{precio(i.subtotal)}</strong>
          </li>
        ))}
      </ul>
      {pedido.nota && <p className="alerta alerta--aviso texto-chico">{pedido.nota}</p>}
      <ErrorMensaje error={error} />
      <footer className="pedido-vendedor__pie">
        <span>Productos {precio(pedido.subtotal)}{pedido.costo_envio > 0 && <> · Envío {precio(pedido.costo_envio)}</>} · <strong>Total {precio(pedido.total)}</strong></span>
        <div className="fila">
          {pedido.siguientes_estados.map((s) => (
            <button key={s} type="button" className="btn btn--primario btn--chico" disabled={ocupado} onClick={() => avanzar(s)}>
              {ACCIONES_PEDIDO[s]}
            </button>
          ))}
          {pedido.siguientes_estados.length === 0 && (
            <span className="texto-gris texto-chico">
              {pedido.revocable ? 'Frenado por arrepentimiento' : pedido.estado === 'cancelado' ? 'Pedido cancelado' : 'Pedido finalizado'}
            </span>
          )}
        </div>
      </footer>
    </article>
  );
}

export default function PanelPedidos() {
  useTitulo('Pedidos recibidos');
  const [params, setParams] = useSearchParams();
  const estado = params.get('estado') || 'activos';
  const { datos, error, cargando, setDatos } = useApi(`/vendedor/pedidos?estado=${estado}`);

  const actualizar = (pedido) => setDatos((lista) => lista.map((p) => (p.id === pedido.id ? { ...p, ...pedido } : p)));

  return (
    <div>
      <div className="chips panel__filtros">
        {FILTROS.map(([valor, texto]) => (
          <button key={valor} type="button" className={`chip ${estado === valor ? 'activo' : ''}`} onClick={() => setParams({ estado: valor })}>{texto}</button>
        ))}
      </div>
      {cargando && !datos && <Cargando />}
      <ErrorMensaje error={error} />
      {datos?.length === 0 && (
        <Vacio icono={ClipboardList} titulo="No hay pedidos en esta vista">
          Los pedidos aparecen acá cuando Mercado Pago aprueba el pago del comprador.
        </Vacio>
      )}
      <div className="pila">
        {datos?.map((p) => <TarjetaPedido key={p.id} pedido={p} alCambiar={actualizar} />)}
      </div>
    </div>
  );
}

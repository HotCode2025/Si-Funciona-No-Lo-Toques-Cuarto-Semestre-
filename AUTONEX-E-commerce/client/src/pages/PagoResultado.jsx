import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock3, FileText, RefreshCw, Store, Truck, XCircle } from 'lucide-react';
import { Cargando, ErrorMensaje } from '../components/Estados.jsx';
import { Emblema } from '../components/Logo.jsx';
import { api } from '../lib/api.js';
import { cabeceraCompra } from '../lib/comprasInvitado.js';
import { useAuth } from '../context/AuthContext.jsx';
import { etiquetaDe, useReferencias, useTitulo } from '../lib/hooks.js';
import { precio } from '../lib/formato.js';

const PANTALLAS = {
  aprobado: {
    icono: CheckCircle2, clase: 'resultado--aprobado', titulo: '¡Pago aprobado!',
    texto: 'Listo: tu compra en AUTONEX está confirmada. Cada vendedor ya recibió su pedido y empieza a prepararlo.',
  },
  pendiente: {
    icono: Clock3, clase: 'resultado--pendiente', titulo: 'Pago pendiente',
    texto: 'Mercado Pago todavía está procesando el pago. Apenas se acredite confirmamos tu compra y avisamos a los vendedores.',
  },
  rechazado: {
    icono: XCircle, clase: 'resultado--rechazado', titulo: 'El pago fue rechazado',
    texto: 'No se descontó dinero. Podés intentar de nuevo con otra tarjeta o medio de pago: tu compra quedó guardada.',
  },
};

function pantallaPara(compra, pagoEstado, ruta) {
  if (compra?.estado === 'pagada' || pagoEstado === 'approved') return 'aprobado';
  if (compra?.estado === 'pago_rechazado' || ['rejected', 'cancelled'].includes(pagoEstado)) return 'rechazado';
  if (['pending', 'in_process', 'authorized'].includes(pagoEstado)) return 'pendiente';
  return ruta === 'fallo' ? 'rechazado' : 'pendiente';
}

export default function PagoResultado() {
  const referencias = useReferencias();
  const { resultado: ruta } = useParams(); // exito | pendiente | fallo (back_urls de Mercado Pago)
  const [params] = useSearchParams();
  const pagoId = params.get('payment_id') || params.get('collection_id');
  const compraId = params.get('external_reference');
  const [estado, setEstado] = useState({ cargando: true, compra: null, pago: null, error: null });
  const [reintentando, setReintentando] = useState(false);
  const { usuario } = useAuth();

  useEffect(() => {
    let cancelado = false;
    async function confirmar() {
      try {
        if (pagoId && pagoId !== 'null') {
          // El backend consulta el pago a Mercado Pago y actualiza la compra (no confiamos en los parámetros de la URL).
          const r = await api('/pagos/confirmar', { method: 'POST', body: { payment_id: pagoId }, headers: cabeceraCompra(compraId) });
          if (!cancelado) setEstado({ cargando: false, compra: r.compra, compraId: r.compra_id, pago: r.pago, error: null });
        } else if (compraId) {
          const compra = await api(`/compras/${compraId}`, { headers: cabeceraCompra(compraId) });
          if (!cancelado) setEstado({ cargando: false, compra, pago: null, error: null });
        } else {
          setEstado({ cargando: false, compra: null, pago: null, error: null });
        }
      } catch (error) {
        if (!cancelado) setEstado({ cargando: false, compra: null, pago: null, error });
      }
    }
    confirmar();
    return () => { cancelado = true; };
  }, [pagoId, compraId]);

  const clave = pantallaPara(estado.compra, estado.pago?.estado, ruta);
  const pantalla = PANTALLAS[clave];
  useTitulo(pantalla.titulo);

  const reintentar = async () => {
    setReintentando(true);
    try {
      const { init_point: url } = await api(`/compras/${estado.compra.id}/pagar`, { method: 'POST', headers: cabeceraCompra(estado.compra.id) });
      window.location.href = url;
    } catch (error) {
      setEstado((e) => ({ ...e, error }));
      setReintentando(false);
    }
  };

  if (estado.cargando) return <div className="contenedor pagina"><Cargando texto="Confirmando el pago con Mercado Pago…" /></div>;

  const Icono = pantalla.icono;
  const compra = estado.compra;
  return (
    <div className="contenedor pagina">
      <div className={`tarjeta resultado ${pantalla.clase}`}>
        <div className="resultado__cabecera">
          <span className="resultado__marca"><Emblema tamano={30} /><span>AUTON<span className="logo__ex">EX</span></span></span>
          <Icono size={64} className="resultado__icono" aria-hidden="true" />
          <h1>{pantalla.titulo}</h1>
          <p>{pantalla.texto}</p>
          {compra && <p className="resultado__numero">Compra <strong>#{compra.id}</strong> · Total <strong>{precio(compra.total)}</strong>{estado.pago && <> · Pago MP <span className="mono">{estado.pago.id}</span></>}</p>}
          {!compra && estado.compraId && (
            <p className="resultado__numero">
              Compra <strong>#{estado.compraId}</strong>{estado.pago && <> · Pago MP <span className="mono">{estado.pago.id}</span></>}.
              {' '}Para ver el detalle, buscala en <Link to={`/seguir-compra?compra=${estado.compraId}`}>Seguí tu compra</Link> con el email que usaste
              {' '}(o en Mis compras si compraste con tu cuenta).
            </p>
          )}
        </div>

        <ErrorMensaje error={estado.error} />

        {compra && (
          <div className="resultado__pedidos">
            {compra.pedidos.map((p) => (
              <div key={p.id} className="resultado__pedido">
                <strong><Store size={16} /> {p.vendedor.nombre_comercial}</strong>
                <span className="texto-chico">{p.items.map((i) => `${i.cantidad} × ${i.nombre}`).join(' · ')}</span>
                <span className="texto-chico texto-gris">
                  {p.envio.metodo === 'retiro'
                    ? <>Retiro en el local: {p.vendedor.direccion}, {p.vendedor.ciudad} · {p.vendedor.horario}</>
                    : <><Truck size={13} /> Envío por {etiquetaDe(referencias, 'transportistas', p.envio.transportista)} · {p.envio.demora_estimada}</>}
                </span>
              </div>
            ))}
          </div>
        )}

        {clave === 'aprobado' && compra && (
          <p className="resultado__comprobante texto-chico">
            Guardá o compartí el comprobante: tiene el número de compra para seguirla y, cuando el vendedor despache tu
            pedido, el número de seguimiento del envío.
          </p>
        )}

        <div className="resultado__acciones">
          {clave === 'aprobado' && compra && (
            <Link to={`/comprobante/${compra.id}`} className="btn btn--primario"><FileText size={18} /> Comprobante</Link>
          )}
          {clave === 'rechazado' && compra && (
            <button type="button" className="btn btn--mp" onClick={reintentar} disabled={reintentando}>
              <RefreshCw size={18} /> {reintentando ? 'Abriendo Mercado Pago…' : 'Intentar pagar de nuevo'}
            </button>
          )}
          {usuario
            ? <Link to="/mis-compras" className="btn btn--oscuro">Ver mis compras</Link>
            : <Link to={`/seguir-compra${compra || estado.compraId ? `?compra=${compra?.id || estado.compraId}` : ''}`} className="btn btn--oscuro">Seguir mi compra</Link>}
          <Link to="/catalogo" className="btn">Seguir comprando</Link>
        </div>
      </div>
    </div>
  );
}

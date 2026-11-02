import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Copy, Download, MessageCircle, PackageSearch, Share2, Store, Truck } from 'lucide-react';
import { Cargando, EtiquetaEstado } from '../components/Estados.jsx';
import { Emblema } from '../components/Logo.jsx';
import { useAvisos } from '../context/AvisosContext.jsx';
import { api } from '../lib/api.js';
import { cabeceraCompra } from '../lib/comprasInvitado.js';
import { textoComprobante, urlSeguimiento } from '../lib/comprobante.js';
import { ESTADOS_COMPRA, ESTADOS_PAGO_MP, ESTADOS_PEDIDO, MEDIOS_PAGO_MP, TRANSPORTISTAS_CON_SEGUIMIENTO } from '../lib/constantes.js';
import { fechaYHora, precio } from '../lib/formato.js';
import { etiquetaDe, useReferencias, useTitulo } from '../lib/hooks.js';

/** Número de seguimiento del envío, o en qué momento va a aparecer. */
function Seguimiento({ pedido, referencias }) {
  const { envio } = pedido;
  const transportista = etiquetaDe(referencias, 'transportistas', envio.transportista);
  if (envio.numero_seguimiento) {
    return (
      <p className="comprobante__tracking">
        <span>N° de seguimiento {transportista}</span>
        <strong className="mono">{envio.numero_seguimiento}</strong>
        {envio.despachado_en && <small>Despachado el {fechaYHora(envio.despachado_en)}</small>}
      </p>
    );
  }
  if (!TRANSPORTISTAS_CON_SEGUIMIENTO.includes(envio.transportista)) {
    return <p className="comprobante__tracking comprobante__tracking--pendiente">Lo lleva el vendedor en moto: te avisa cuando sale.</p>;
  }
  if (['enviado', 'entregado'].includes(pedido.estado)) {
    return (
      <p className="comprobante__tracking comprobante__tracking--pendiente">
        N° de seguimiento {transportista}: el vendedor no lo cargó. Pedíselo a {pedido.vendedor.nombre_comercial}
        {pedido.vendedor.telefono ? ` (${pedido.vendedor.telefono})` : ''}.
      </p>
    );
  }
  return (
    <p className="comprobante__tracking comprobante__tracking--pendiente">
      N° de seguimiento {transportista}: todavía no fue despachado. El vendedor lo carga cuando lo envía y lo vas a ver en
      “Seguí tu compra”.
    </p>
  );
}

/**
 * Comprobante de una compra para guardar (PDF) o compartir. Lo ve el dueño: con sesión o, si compró sin cuenta, desde la
 * misma pestaña donde compró (código de acceso). Si no, se busca con número + email en "Seguí tu compra".
 */
export default function Comprobante() {
  const { id } = useParams();
  const navegar = useNavigate();
  const referencias = useReferencias();
  const { avisar } = useAvisos();
  const [estado, setEstado] = useState({ cargando: true, compra: null, error: null });
  useTitulo(`Comprobante de la compra #${id}`);

  useEffect(() => {
    let cancelado = false;
    api(`/compras/${id}`, { headers: cabeceraCompra(id) })
      .then((compra) => { if (!cancelado) setEstado({ cargando: false, compra, error: null }); })
      .catch((error) => { if (!cancelado) setEstado({ cargando: false, compra: null, error }); });
    return () => { cancelado = true; };
  }, [id]);

  if (estado.cargando) return <div className="contenedor pagina"><Cargando texto="Armando el comprobante…" /></div>;

  const { compra } = estado;
  if (!compra) {
    return (
      <div className="contenedor pagina">
        <div className="tarjeta tarjeta--padding comprobante-sin-acceso">
          <PackageSearch size={36} aria-hidden="true" />
          <h1 className="titulo-seccion">No pudimos abrir el comprobante</h1>
          <p className="texto-gris">
            Por privacidad, las compras sin cuenta no quedan guardadas en el navegador. Buscá la compra #{id} con el email que
            usaste y desde ahí abrí el comprobante.
          </p>
          <Link to={`/seguir-compra?compra=${id}`} className="btn btn--primario">Ir a Seguí tu compra</Link>
        </div>
      </div>
    );
  }

  const texto = textoComprobante(compra, referencias);
  const pago = compra.ultimo_pago?.mp_pago_id ? compra.ultimo_pago : null;

  const compartir = async () => {
    try {
      await navigator.share({ title: `Comprobante AUTONEX · Compra #${compra.id}`, text: texto });
    } catch (error) {
      if (error?.name !== 'AbortError') avisar('No se pudo compartir desde este navegador: probá con WhatsApp o copiando el texto.', 'error');
    }
  };
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      avisar('Copiamos el comprobante: pegalo donde quieras.', 'exito');
    } catch {
      avisar('No se pudo copiar automáticamente.', 'error');
    }
  };

  return (
    <div className="contenedor pagina comprobante-pagina">
      <div className="comprobante__acciones no-imprimir">
        <button type="button" className="btn btn--chico" onClick={() => navegar(-1)}><ArrowLeft size={16} /> Volver</button>
        <div className="fila fila--envolver">
          {typeof navigator.share === 'function' && (
            <button type="button" className="btn btn--primario btn--chico" onClick={compartir}><Share2 size={16} /> Compartir</button>
          )}
          <a className="btn btn--chico btn--whatsapp" href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={16} /> WhatsApp
          </a>
          <button type="button" className="btn btn--chico" onClick={copiar}><Copy size={16} /> Copiar</button>
          <button type="button" className="btn btn--oscuro btn--chico" onClick={() => window.print()}><Download size={16} /> Descargar PDF</button>
        </div>
      </div>

      <article className="tarjeta comprobante">
        <header className="comprobante__cabecera">
          <span className="resultado__marca"><Emblema tamano={28} /><span>AUTON<span className="logo__ex">EX</span></span></span>
          <div className="comprobante__titulo">
            <h1>Comprobante de compra</h1>
            <span className="texto-gris">Compra #{compra.id} · {fechaYHora(compra.creado_en)}</span>
          </div>
          <EtiquetaEstado estado={compra.estado} mapa={ESTADOS_COMPRA} />
        </header>

        <section className="comprobante__seguir">
          <div>
            <small>Número de compra</small>
            <strong>#{compra.id}</strong>
          </div>
          <div>
            <small>Seguila en</small>
            <a href={urlSeguimiento(compra.id)}>{urlSeguimiento(compra.id).replace(/^https?:\/\//, '')}</a>
            <span className="texto-chico texto-gris">con este número y el email {compra.comprador_email}</span>
          </div>
        </section>

        <dl className="comprobante__datos">
          <div><dt>Comprador</dt><dd>{compra.comprador_nombre} {compra.comprador_apellido}</dd></div>
          <div>
            <dt>Pago</dt>
            <dd>
              {pago
                ? <>Mercado Pago · operación <span className="mono">{pago.mp_pago_id}</span> · {ESTADOS_PAGO_MP[pago.estado] || pago.estado}{pago.medio_pago ? ` · ${MEDIOS_PAGO_MP[pago.medio_pago] || pago.medio_pago}` : ''}</>
                : 'Todavía sin pagar'}
            </dd>
          </div>
          {compra.pagada_en && <div><dt>Pagada el</dt><dd>{fechaYHora(compra.pagada_en)}</dd></div>}
        </dl>

        {compra.pedidos.map((p) => (
          <section key={p.id} className="comprobante__pedido">
            <header>
              <strong><Store size={16} aria-hidden="true" /> {p.vendedor.nombre_comercial}</strong>
              <span className="texto-gris texto-chico">Pedido #{p.id}</span>
              <EtiquetaEstado estado={p.estado} mapa={ESTADOS_PEDIDO} />
            </header>
            <table className="comprobante__items">
              <thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead>
              <tbody>
                {p.items.map((i) => (
                  <tr key={i.id}>
                    <td>{i.nombre}<small className="texto-gris"> · {i.numero_pieza} · {i.condicion}</small></td>
                    <td>{i.cantidad}</td>
                    <td>{precio(i.precio_unitario)}</td>
                    <td>{precio(i.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="comprobante__entrega">
              {p.envio.metodo === 'retiro' ? (
                <p>
                  <Store size={15} aria-hidden="true" /> <strong>Retiro en el local:</strong> {p.vendedor.direccion}, {p.vendedor.ciudad}, {p.vendedor.provincia}
                  {p.vendedor.horario && <span className="texto-gris"> · {p.vendedor.horario}</span>}
                </p>
              ) : (
                <>
                  <p>
                    <Truck size={15} aria-hidden="true" /> <strong>Envío a domicilio por {etiquetaDe(referencias, 'transportistas', p.envio.transportista)}:</strong>{' '}
                    {p.envio.calle} {p.envio.numero}{p.envio.piso_depto ? `, ${p.envio.piso_depto}` : ''} · {p.envio.localidad}, {p.envio.provincia} ({p.envio.codigo_postal})
                    {p.envio.demora_estimada && <span className="texto-gris"> · Demora estimada: {p.envio.demora_estimada}</span>}
                  </p>
                  <Seguimiento pedido={p} referencias={referencias} />
                </>
              )}
            </div>
            <p className="comprobante__subtotal">
              Productos {precio(p.subtotal)} · Envío {p.costo_envio > 0 ? precio(p.costo_envio) : 'gratis'} · <strong>{precio(p.total)}</strong>
            </p>
          </section>
        ))}

        <footer className="comprobante__pie">
          <div className="comprobante__total">
            <span>Productos {precio(compra.subtotal_productos)} · Envíos {precio(compra.total_envios)}</span>
            <strong>Total {precio(compra.total)}</strong>
          </div>
          <p className="texto-chico texto-gris">
            Comprobante de compra de AUTONEX, no es una factura: cada vendedor emite la suya. Ante cualquier consulta sobre un
            pedido, comunicate con el vendedor. Tenés 10 días corridos desde que recibís el producto para arrepentirte de la
            compra: <span className="mono">{`${window.location.host}${import.meta.env.BASE_URL}arrepentimiento`}</span>
            {' '}(Botón de arrepentimiento). Garantía legal: 6 meses para productos nuevos y 3 meses para usados.
          </p>
        </footer>
      </article>
    </div>
  );
}

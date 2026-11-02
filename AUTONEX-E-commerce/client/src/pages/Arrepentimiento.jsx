import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Copy, Undo2 } from 'lucide-react';
import { ErrorMensaje } from '../components/Estados.jsx';
import { useAvisos } from '../context/AvisosContext.jsx';
import { api } from '../lib/api.js';
import { fechaYHora } from '../lib/formato.js';
import { useTitulo } from '../lib/hooks.js';

/**
 * Botón de arrepentimiento (Resolución 424/2020): el comprador pide revocar una compra con el número de compra y su email
 * y recibe en el momento el código de identificación de su pedido de revocación.
 */
export default function Arrepentimiento() {
  useTitulo('Botón de arrepentimiento');
  const [params] = useSearchParams();
  const { avisar } = useAvisos();
  const [datos, setDatos] = useState({ compra_id: params.get('compra') || '', email: '', motivo: '' });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [resultado, setResultado] = useState(null);

  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const r = await api('/arrepentimientos', {
        method: 'POST',
        body: { compra_id: Number(datos.compra_id), email: datos.email.trim(), motivo: datos.motivo.trim() || undefined },
      });
      setResultado(r);
    } catch (err) {
      setError(err);
    } finally {
      setEnviando(false);
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(resultado.codigo);
      avisar('Código copiado.', 'exito');
    } catch {
      avisar('No se pudo copiar: anotalo a mano.', 'error');
    }
  };

  const campo = (nombre) => ({ id: `arr-${nombre}`, value: datos[nombre], onChange: (e) => setDatos((d) => ({ ...d, [nombre]: e.target.value })) });

  return (
    <div className="contenedor pagina legal">
      <h1 className="titulo-seccion">Botón de arrepentimiento</h1>
      <p>
        Podés <strong>revocar tu compra dentro de los 10 días corridos</strong> desde que recibiste el producto o desde que
        compraste, lo último que ocurra, sin explicar el motivo y sin costo (artículo 34 de la Ley 24.240 y artículo 1110 del
        Código Civil y Comercial). Más información en los <Link to="/terminos#arrepentimiento">Términos y condiciones</Link>.
      </p>

      {resultado ? (
        <div className="tarjeta tarjeta--padding arrepentimiento__resultado" role="status">
          <CheckCircle2 size={40} aria-hidden="true" />
          <h2>{resultado.ya_existia ? 'Ya pediste revocar esta compra' : 'Recibimos tu pedido de revocación'}</h2>
          <p>Código de identificación de tu pedido:</p>
          <p className="arrepentimiento__codigo"><strong className="mono">{resultado.codigo}</strong>
            <button type="button" className="btn btn--chico" onClick={copiar}><Copy size={15} /> Copiar</button>
          </p>
          <p className="texto-gris texto-chico">Compra #{resultado.compra_id} · pedido registrado el {fechaYHora(resultado.creado_en)}</p>
          <ol>
            <li>Guardá este código: identifica tu pedido de revocación.</li>
            <li>Tus pedidos quedan frenados: cada vendedor ya lo ve en su panel y no los prepara ni los despacha.</li>
            <li>Si ya recibiste algún producto, el vendedor se comunica con vos para coordinar la devolución, que es a su cargo.</li>
            <li>Cuando el vendedor cancela el pedido, te reintegramos el total (productos y envío) con Mercado Pago, al mismo medio de pago. Te avisamos por mail.</li>
          </ol>
          <Link to={`/seguir-compra?compra=${resultado.compra_id}`} className="btn btn--oscuro">Ver mi compra</Link>
        </div>
      ) : (
        <form className="tarjeta tarjeta--padding arrepentimiento__form pila" onSubmit={enviar}>
          <div className="grilla-form">
            <div className="campo">
              <label htmlFor="arr-compra_id">Número de compra</label>
              <input className="input" type="number" min="1" inputMode="numeric" required placeholder="Ej: 125" {...campo('compra_id')} />
              <span className="campo__ayuda">Está en el comprobante y en "Mis compras".</span>
            </div>
            <div className="campo">
              <label htmlFor="arr-email">Email que usaste al comprar</label>
              <input className="input" type="email" required placeholder="tu@email.com" {...campo('email')} />
            </div>
            <div className="campo ancho-total">
              <label htmlFor="arr-motivo">Motivo <small className="texto-gris">(opcional)</small></label>
              <textarea className="textarea" maxLength={500} {...campo('motivo')} />
            </div>
          </div>
          <ErrorMensaje error={error} titulo="No pudimos registrar el pedido" />
          <div>
            <button type="submit" className="btn btn--primario" disabled={enviando}>
              <Undo2 size={18} /> {enviando ? 'Enviando…' : 'Quiero arrepentirme de mi compra'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

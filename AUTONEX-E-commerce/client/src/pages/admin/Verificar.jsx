import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import Modal from '../../components/Modal.jsx';
import { ErrorMensaje } from '../../components/Estados.jsx';
import { useAvisos } from '../../context/AvisosContext.jsx';
import { api } from '../../lib/api.js';
import { useReferencias } from '../../lib/hooks.js';
import { plural } from '../../lib/formato.js';
import { SelectorFuente, useFuentes } from './comun.jsx';

/**
 * Cambia el estado de verificación de varios registros. VERIFIED exige una fuente real (no de demostración)
 * o una nota con la referencia; todo queda en el historial.
 */
export default function Verificar({ entidad, ids, alCerrar, alListo }) {
  const { avisar } = useAvisos();
  const referencias = useReferencias();
  const fuentes = useFuentes();
  const [estado, setEstado] = useState('VERIFIED');
  const [fuenteId, setFuenteId] = useState('');
  const [fuenteUrl, setFuenteUrl] = useState('');
  const [nota, setNota] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const r = await api('/admin/verificacion', {
        method: 'POST',
        body: {
          entidad, ids, estado,
          ...(fuenteId ? { fuente_id: Number(fuenteId) } : {}),
          ...(fuenteUrl ? { fuente_url: fuenteUrl } : {}),
          ...(nota ? { nota } : {}),
        },
      });
      avisar(`${plural(r.actualizados, 'registro actualizado', 'registros actualizados')}.`);
      alListo();
    } catch (err) {
      setError(err);
      setEnviando(false);
    }
  };

  return (
    <Modal abierto alCerrar={alCerrar} titulo={`Cambiar verificación · ${plural(ids.length, 'registro', 'registros')}`} ancho={620}>
      <form className="pila" onSubmit={enviar}>
        <div className="campo">
          <label htmlFor="ver-estado">Nuevo estado</label>
          <select id="ver-estado" className="select" value={estado} onChange={(e) => setEstado(e.target.value)}>
            {referencias?.estados_verificacion.map((x) => <option key={x.valor} value={x.valor}>{x.etiqueta} — {x.descripcion}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="ver-fuente">Fuente con la que lo confirmaste {estado === 'VERIFIED' && <span className="texto-rojo">*</span>}</label>
          <SelectorFuente id="ver-fuente" valor={fuenteId} fuentes={fuentes.datos} sinDemo alCambiar={setFuenteId}
            vacio={estado === 'VERIFIED' ? 'Elegí la fuente…' : 'Sin cambios'} />
        </div>
        <div className="campo">
          <label htmlFor="ver-url">URL o página del catálogo <small className="texto-gris">(opcional)</small></label>
          <input id="ver-url" className="input" type="url" value={fuenteUrl} onChange={(e) => setFuenteUrl(e.target.value)} placeholder="https://…" />
        </div>
        <div className="campo">
          <label htmlFor="ver-nota">Nota <small className="texto-gris">(qué revisaste, página del catálogo…)</small></label>
          <input id="ver-nota" className="input" maxLength={500} value={nota} onChange={(e) => setNota(e.target.value)} />
        </div>
        {estado === 'VERIFIED' && (
          <p className="alerta alerta--info texto-chico">
            Marcá como verificado solo lo que confirmaste con una fuente confiable. Los datos de demostración no se pueden verificar.
          </p>
        )}
        <ErrorMensaje error={error} />
        <div className="fila fila--fin">
          <button type="button" className="btn" onClick={alCerrar}>Cancelar</button>
          <button type="submit" className="btn btn--primario" disabled={enviando}><ShieldCheck size={16} /> Aplicar</button>
        </div>
      </form>
    </Modal>
  );
}

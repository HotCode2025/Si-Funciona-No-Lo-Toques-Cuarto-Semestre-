import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Save, Trash2 } from 'lucide-react';
import Modal from '../../components/Modal.jsx';
import { Cargando, ErrorMensaje } from '../../components/Estados.jsx';
import { SelloVerificacion } from '../../components/Verificacion.jsx';
import { useAvisos } from '../../context/AvisosContext.jsx';
import { api } from '../../lib/api.js';
import { fechaYHora } from '../../lib/formato.js';
import { CampoReferencia, SelectorFuente, useEtiquetaLista, useFuentes } from './comun.jsx';
import RelacionesRepuesto from './RelacionesRepuesto.jsx';

function Campo({ campo, valor, etiquetaRef, listas, padreValor, alCambiar }) {
  const id = `campo-${campo.nombre}`;
  const etiquetaLista = useEtiquetaLista();
  let control;
  if (campo.tipo === 'ref') {
    control = (
      <CampoReferencia id={id} entidad={campo.ref} valor={valor} etiquetaInicial={etiquetaRef} requerido={campo.requerido}
        padre={campo.filtroPadre ? padreValor : undefined} alCambiar={(v) => alCambiar(v)} />
    );
  } else if (campo.tipo === 'lista') {
    control = (
      <select id={id} className="select" value={valor ?? ''} required={campo.requerido} onChange={(e) => alCambiar(e.target.value || null)}>
        <option value="">—</option>
        {(listas[campo.lista] || []).map((v) => <option key={v} value={v}>{etiquetaLista(campo.lista, v)}</option>)}
      </select>
    );
  } else if (campo.tipo === 'booleano' && campo.triestado) {
    // Sí / No / sin dato: "sin dato" queda NULL (no se asume que no)
    control = (
      <select id={id} className="select" value={valor === true ? 'si' : valor === false ? 'no' : ''}
        onChange={(e) => alCambiar(e.target.value === '' ? null : e.target.value === 'si')}>
        <option value="">Sin dato</option>
        <option value="si">Sí</option>
        <option value="no">No</option>
      </select>
    );
  } else if (campo.tipo === 'booleano') {
    return (
      <label className="check campo">
        <input type="checkbox" checked={Boolean(valor)} onChange={(e) => alCambiar(e.target.checked)} />
        <span>{campo.etiqueta}</span>
      </label>
    );
  } else if (campo.multilinea) {
    control = <textarea id={id} className="textarea" value={valor ?? ''} maxLength={campo.max} onChange={(e) => alCambiar(e.target.value)} />;
  } else {
    const numerico = ['entero', 'anio'].includes(campo.tipo);
    control = (
      <input id={id} className="input" type={numerico ? 'number' : campo.tipo === 'url' ? 'url' : 'text'} value={valor ?? ''}
        required={campo.requerido} maxLength={campo.max} min={campo.min} max={campo.max && numerico ? campo.max : undefined}
        onChange={(e) => alCambiar(e.target.value)} />
    );
  }
  return (
    <div className={`campo ${campo.multilinea ? 'ancho-total' : ''}`}>
      <label htmlFor={id}>{campo.etiqueta}{campo.requerido && <span className="texto-rojo"> *</span>}</label>
      {control}
    </div>
  );
}

/**
 * Alta o edición de un registro de cualquier entidad del panel.
 * Al guardar cambios sobre un dato VERIFIED, el servidor lo vuelve a "sin verificar" (queda en el historial).
 */
export default function FormularioEntidad({ entidad, definicion, listas, registroId, alCerrar, alGuardar }) {
  const { avisar } = useAvisos();
  const fuentes = useFuentes();
  const [detalle, setDetalle] = useState(null);
  const [valores, setValores] = useState({});
  const [etiquetas, setEtiquetas] = useState({});
  const [traza, setTraza] = useState({ fuente_id: '', fuente_url: '' });
  const [error, setError] = useState(null);
  const [duplicado, setDuplicado] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const esNuevo = !registroId;

  const cargar = async () => {
    if (esNuevo) return;
    try {
      const d = await api(`/admin/datos/${entidad}/${registroId}`);
      setDetalle(d);
      setValores(Object.fromEntries(definicion.campos.map((c) => [c.nombre, d.registro[c.nombre]])));
      setEtiquetas(d.referencias || {});
      setTraza({ fuente_id: d.registro.fuente_id || '', fuente_url: d.registro.fuente_url || '' });
    } catch (e) {
      setError(e);
    }
  };
  useEffect(() => { cargar(); }, [entidad, registroId]); // eslint-disable-line react-hooks/exhaustive-deps

  const guardar = async (e, confirmar = false) => {
    e?.preventDefault();
    setGuardando(true);
    setError(null);
    const datos = {};
    const limpiar = [];
    for (const c of definicion.campos) {
      const v = valores[c.nombre];
      const original = detalle?.registro[c.nombre];
      if (!esNuevo && JSON.stringify(v ?? null) === JSON.stringify(original ?? null)) continue;
      if (v === '' || v === null || v === undefined) {
        if (!esNuevo && original !== null && original !== undefined && original !== '') limpiar.push(c.nombre);
      } else {
        datos[c.nombre] = v;
      }
    }
    const cuerpo = { datos, ...(limpiar.length ? { limpiar } : {}), ...(confirmar ? { confirmar_duplicado: true } : {}) };
    if (definicion.trazable) {
      if (traza.fuente_id) cuerpo.fuente_id = Number(traza.fuente_id);
      if (traza.fuente_url && traza.fuente_url !== detalle?.registro.fuente_url) cuerpo.fuente_url = traza.fuente_url;
    }
    try {
      const r = esNuevo
        ? await api(`/admin/datos/${entidad}`, { method: 'POST', body: cuerpo })
        : await api(`/admin/datos/${entidad}/${registroId}`, { method: 'PATCH', body: cuerpo });
      avisar(esNuevo ? `${definicion.singular} creado.` : r.cambios?.length ? 'Cambios guardados.' : 'No había cambios para guardar.');
      setDuplicado(null);
      alGuardar(r.registro);
    } catch (err) {
      if (err.status === 409 && err.cuerpo?.requiere_confirmacion) setDuplicado(err.cuerpo);
      else setError(err);
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async () => {
    if (!window.confirm(`¿Eliminar ${definicion.singular.toLowerCase()} #${registroId}? No se puede deshacer.`)) return;
    try {
      await api(`/admin/datos/${entidad}/${registroId}`, { method: 'DELETE' });
      avisar(`${definicion.singular} eliminado.`);
      alGuardar(null);
    } catch (err) {
      setError(err);
    }
  };

  const titulo = esNuevo ? `Nuevo: ${definicion.singular.toLowerCase()}` : `${definicion.singular} #${registroId}`;
  const padreCampo = definicion.campos.find((c) => c.filtroPadre)?.filtroPadre;

  return (
    <Modal abierto alCerrar={alCerrar} titulo={titulo} ancho={entidad === 'productos' ? 980 : 820}>
      {!esNuevo && !detalle && !error && <Cargando />}
      {(esNuevo || detalle) && (
        <form className="pila" onSubmit={guardar}>
          {detalle && definicion.trazable && (
            <div className="admin-traza">
              <SelloVerificacion estado={detalle.registro.estado_verificacion} />
              <span>Fuente: <strong>{detalle.fuente?.nombre || 'sin fuente'}</strong></span>
              {detalle.registro.confianza && <span>Confianza {detalle.registro.confianza}</span>}
              {detalle.registro.importado_en && <span>Importado {fechaYHora(detalle.registro.importado_en)}</span>}
              {detalle.importacion && <Link to={`/admin/importaciones/${detalle.importacion.id}`}>Importación #{detalle.importacion.id}</Link>}
              {detalle.registro.verificado_en && <span>Verificado {fechaYHora(detalle.registro.verificado_en)}</span>}
              {entidad === 'productos' && <Link to={`/producto/${registroId}`} target="_blank"><ExternalLink size={14} /> Ver en la tienda</Link>}
            </div>
          )}

          <div className="grilla-form">
            {definicion.campos.map((c) => (
              <Campo key={c.nombre} campo={c} valor={valores[c.nombre]} etiquetaRef={etiquetas[c.nombre]} listas={listas}
                padreValor={padreCampo ? valores[padreCampo] : undefined}
                alCambiar={(v) => setValores((x) => ({ ...x, [c.nombre]: v }))} />
            ))}
          </div>

          {definicion.trazable && (
            <fieldset className="admin-fieldset">
              <legend>Origen del dato</legend>
              <div className="grilla-form">
                <div className="campo">
                  <label htmlFor="traza-fuente">Fuente</label>
                  <SelectorFuente id="traza-fuente" valor={traza.fuente_id} fuentes={fuentes.datos}
                    vacio={esNuevo ? 'Carga manual (por defecto)' : 'Sin cambios'} alCambiar={(v) => setTraza((t) => ({ ...t, fuente_id: v }))} />
                </div>
                <div className="campo">
                  <label htmlFor="traza-url">URL de respaldo <small className="texto-gris">(página o catálogo donde figura)</small></label>
                  <input id="traza-url" className="input" type="url" value={traza.fuente_url} placeholder="https://…"
                    onChange={(e) => setTraza((t) => ({ ...t, fuente_url: e.target.value }))} />
                </div>
              </div>
              <p className="texto-chico texto-gris">
                Los datos nuevos o editados quedan <strong>sin verificar</strong>. Para marcarlos como verificados usá “Verificar” en la lista.
              </p>
            </fieldset>
          )}

          {duplicado && (
            <div className="alerta alerta--aviso">
              <div>
                <strong>{duplicado.mensaje}</strong>
                <div className="fila">
                  <button type="button" className="btn btn--chico" onClick={() => setDuplicado(null)}>Revisar</button>
                  <button type="button" className="btn btn--chico btn--oscuro" onClick={(e) => guardar(e, true)}>Es otro: crear igual</button>
                </div>
              </div>
            </div>
          )}
          <ErrorMensaje error={error} />

          <div className="fila fila--entre">
            {!esNuevo ? <button type="button" className="btn btn--fantasma texto-rojo" onClick={eliminar}><Trash2 size={16} /> Eliminar</button> : <span />}
            <div className="fila">
              <button type="button" className="btn" onClick={alCerrar}>Cerrar</button>
              <button type="submit" className="btn btn--primario" disabled={guardando}><Save size={16} /> {esNuevo ? 'Crear' : 'Guardar cambios'}</button>
            </div>
          </div>

          {detalle?.historial_verificacion?.length > 0 && (
            <details className="admin-historial">
              <summary>Historial de verificación ({detalle.historial_verificacion.length})</summary>
              <ul>
                {detalle.historial_verificacion.map((h) => (
                  <li key={`${h.creado_en}-${h.estado_nuevo}`}>
                    <span className="texto-gris">{fechaYHora(h.creado_en)}</span>
                    {' '}{h.estado_anterior || '—'} → <strong>{h.estado_nuevo}</strong>
                    {h.fuente && <> · {h.fuente}</>}{h.usuario && <> · {h.usuario}</>}{h.nota && <> · {h.nota}</>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </form>
      )}
      {!esNuevo && error && !detalle && <ErrorMensaje error={error} />}

      {entidad === 'productos' && detalle && (
        <RelacionesRepuesto productoId={registroId} detalle={detalle} alCambiar={cargar} fuentes={fuentes.datos} />
      )}
    </Modal>
  );
}

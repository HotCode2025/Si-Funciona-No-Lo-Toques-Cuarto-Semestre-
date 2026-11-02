import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, FileCheck2, Upload } from 'lucide-react';
import { Cargando, ErrorMensaje } from '../../components/Estados.jsx';
import { useAvisos } from '../../context/AvisosContext.jsx';
import { api, descargar } from '../../lib/api.js';
import { useApi, useReferencias, useTitulo } from '../../lib/hooks.js';
import { SelectorFuente, useEsquema, useFuentes } from './comun.jsx';

function Resultado({ r }) {
  const datos = [
    ['Filas', r.filas], ['Nuevas', r.creado], ['Actualizadas', r.actualizado], ['Sin cambios', r.sin_cambios],
    ['Posibles duplicados', r.duplicado], ['Con error', r.error],
  ];
  return (
    <div className={`tarjeta tarjeta--padding admin-resultado ${r.solo_validacion ? 'admin-resultado--vista' : ''}`}>
      <h3>{r.solo_validacion ? 'Vista previa (no se guardó nada)' : `Importación #${r.importacion_id} terminada`}</h3>
      <dl className="admin-resultado__numeros">
        {datos.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
      {Object.keys(r.creados_por_entidad || {}).length > 0 && (
        <p className="texto-chico">Altas: {Object.entries(r.creados_por_entidad).map(([k, v]) => `${v} ${k}`).join(' · ')}</p>
      )}
      {r.columnas_ignoradas?.length > 0 && (
        <p className="texto-chico texto-ambar">Columnas que no se reconocieron (se ignoraron): {r.columnas_ignoradas.join(', ')}</p>
      )}
      {Object.entries(r.notas || {}).map(([nota, n]) => <p key={nota} className="texto-chico texto-gris">{n} × {nota}</p>)}
      {r.primeros_errores?.length > 0 && (
        <details open={r.solo_validacion}>
          <summary>Primeros errores</summary>
          <ul className="texto-chico">
            {r.primeros_errores.map((e) => <li key={`${e.fila}-${e.campo}-${e.mensaje}`}>Fila {e.fila}{e.campo ? ` (${e.campo})` : ''}: {e.mensaje}</li>)}
          </ul>
        </details>
      )}
      {r.duplicado > 0 && !r.solo_validacion && (
        <p className="texto-chico">Las filas parecidas a registros existentes quedaron para revisar en <Link to="/admin/duplicados">Duplicados</Link>.</p>
      )}
      {!r.solo_validacion && <Link to={`/admin/importaciones/${r.importacion_id}`} className="enlace">Ver el detalle y descargar los errores</Link>}
    </div>
  );
}

/**
 * Importar un archivo (CSV, Excel o JSON) de una fuente autorizada. Primero se valida (vista previa sin guardar)
 * y después se importa. Toda fila queda con su fuente, la importación y su estado de verificación.
 */
export default function AdminImportar() {
  useTitulo('Admin · Importar');
  const { avisar } = useAvisos();
  const { esquema } = useEsquema();
  const referencias = useReferencias();
  const fuentes = useFuentes();
  const proveedores = useApi('/admin/datos/proveedores', { query: { limite: 200 } });
  const [form, setForm] = useState({ entidad: 'repuestos', fuente: '', proveedor_id: '', estado_por_defecto: '', confianza_por_defecto: '', duplicados: 'retener', hoja: '' });
  const [archivo, setArchivo] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  if (!esquema) return <Cargando />;
  const importable = esquema.importables.find((i) => i.entidad === form.entidad);
  const set = (k) => (e) => { setForm({ ...form, [k]: e.target.value }); setResultado(null); };

  const enviar = async (soloValidar) => {
    if (!archivo) return setError({ message: 'Elegí el archivo a importar.' });
    if (!form.fuente) return setError({ message: 'Elegí la fuente de los datos.' });
    setEnviando(true);
    setError(null);
    const datos = new FormData();
    for (const [k, v] of Object.entries(form)) if (v) datos.append(k, v);
    if (soloValidar) datos.append('solo_validar', 'true');
    datos.append('archivo', archivo);
    try {
      const r = await api('/admin/importaciones', { method: 'POST', body: datos });
      setResultado(r);
      if (!soloValidar) avisar(`Importación #${r.importacion_id}: ${r.creado} nuevas, ${r.actualizado} actualizadas, ${r.error} con error.`);
    } catch (e) {
      setError(e);
    } finally {
      setEnviando(false);
    }
  };

  const fuenteElegida = fuentes.datos?.find((f) => String(f.id) === String(form.fuente));
  return (
    <div className="admin-importar">
      <div className="tarjeta tarjeta--padding pila">
        <div className="grilla-form">
          <div className="campo">
            <label htmlFor="imp-entidad">Qué vas a importar</label>
            <select id="imp-entidad" className="select" value={form.entidad} onChange={set('entidad')}>
              {esquema.importables.map((i) => <option key={i.entidad} value={i.entidad}>{i.titulo}</option>)}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="imp-fuente">Fuente de los datos <span className="texto-rojo">*</span></label>
            <SelectorFuente id="imp-fuente" valor={form.fuente} fuentes={fuentes.datos} alCambiar={(v) => { setForm({ ...form, fuente: v }); setResultado(null); }} />
            <small className="texto-gris">¿No está? Creala en <Link to="/admin/datos/fuentes">Fuentes</Link> con su licencia y términos revisados.</small>
          </div>
          <div className="campo">
            <label htmlFor="imp-proveedor">Proveedor <small className="texto-gris">(opcional)</small></label>
            <select id="imp-proveedor" className="select" value={form.proveedor_id} onChange={set('proveedor_id')}>
              <option value="">—</option>
              {proveedores.datos?.registros.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="imp-archivo">Archivo (CSV, Excel, JSON o XML, hasta {esquema.max_filas.toLocaleString('es-AR')} filas)</label>
            <input id="imp-archivo" className="input" type="file" accept=".csv,.txt,.xlsx,.json,.xml"
              onChange={(e) => { setArchivo(e.target.files[0] || null); setResultado(null); }} />
          </div>
          <div className="campo">
            <label htmlFor="imp-estado">Estado de las filas sin estado</label>
            <select id="imp-estado" className="select" value={form.estado_por_defecto} onChange={set('estado_por_defecto')}>
              <option value="">Sin verificar (recomendado)</option>
              {referencias?.estados_verificacion.map((x) => <option key={x.valor} value={x.valor}>{x.etiqueta}</option>)}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="imp-dup">Si una fila se parece a un registro existente</label>
            <select id="imp-dup" className="select" value={form.duplicados} onChange={set('duplicados')}>
              <option value="retener">No crearla: dejarla para revisar</option>
              <option value="marcar">Crearla y marcarla para revisar</option>
              <option value="crear">Crearla sin avisar</option>
            </select>
          </div>
          {/\.xlsx$/i.test(archivo?.name || '') && (
            <div className="campo">
              <label htmlFor="imp-hoja">Hoja del Excel <small className="texto-gris">(vacío = la primera)</small></label>
              <input id="imp-hoja" className="input" value={form.hoja} onChange={set('hoja')} />
            </div>
          )}
        </div>
        {form.estado_por_defecto === 'VERIFIED' && (
          <p className="alerta alerta--aviso texto-chico">
            Vas a importar las filas como verificadas: hacelo solo si la fuente es el catálogo oficial y ya lo revisaste.
            {fuenteElegida?.tipo === 'demo' && ' Una fuente de demostración no puede cargar datos verificados.'}
          </p>
        )}
        <ErrorMensaje error={error} />
        <div className="fila fila--fin">
          <button type="button" className="btn" disabled={enviando} onClick={() => enviar(true)}><FileCheck2 size={16} /> Validar sin guardar</button>
          <button type="button" className="btn btn--primario" disabled={enviando || !resultado?.solo_validacion} onClick={() => enviar(false)}
            title={!resultado?.solo_validacion ? 'Primero validá el archivo' : undefined}>
            <Upload size={16} /> Importar
          </button>
        </div>
        {enviando && <Cargando texto="Procesando el archivo…" />}
      </div>

      {resultado && <Resultado r={resultado} />}

      {importable && (
        <div className="tarjeta tarjeta--padding">
          <div className="fila fila--entre fila--envolver">
            <h3>Columnas de “{importable.titulo}”</h3>
            <button type="button" className="btn btn--chico" onClick={() => descargar(`/admin/plantillas/${importable.entidad}`, `plantilla-${importable.entidad}.csv`).catch(setError)}>
              <Download size={15} /> Descargar plantilla CSV
            </button>
          </div>
          <p className="texto-chico texto-gris">
            La primera fila tiene que tener los nombres de las columnas (en castellano o en inglés). Las que no se reconocen se ignoran.
            {importable.admite_columnas_extra && ' Las columnas extra se guardan como datos de la fuente.'}
          </p>
          <div className="tabla-contenedor">
            <table className="tabla">
              <thead><tr><th>Columna</th><th>Qué es</th><th>Tipo</th><th>También acepta</th></tr></thead>
              <tbody>
                {importable.columnas.map((c) => (
                  <tr key={c.nombre}>
                    <td className="mono">{c.nombre}{c.requerido && <span className="texto-rojo"> *</span>}</td>
                    <td>{c.etiqueta}</td>
                    <td className="texto-chico">{c.lista ? `lista: ${(esquema.listas[c.lista] || []).join(', ')}` : c.tipo}</td>
                    <td className="texto-chico texto-gris">{c.alias.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

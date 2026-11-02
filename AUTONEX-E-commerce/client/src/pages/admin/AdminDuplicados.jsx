import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GitMerge, Plus, ScanSearch, X } from 'lucide-react';
import { Cargando, ErrorMensaje, Vacio } from '../../components/Estados.jsx';
import { Paginacion } from '../../components/Producto.jsx';
import { SelloVerificacion } from '../../components/Verificacion.jsx';
import { useAvisos } from '../../context/AvisosContext.jsx';
import { api } from '../../lib/api.js';
import { useApi, useTitulo } from '../../lib/hooks.js';
import { plural } from '../../lib/formato.js';

const ENTIDADES = {
  marcas: 'Marcas', modelos: 'Modelos', generaciones: 'Generaciones', vehiculos: 'Versiones', motores: 'Motores',
  marcas_repuesto: 'Marcas de repuesto', productos: 'Repuestos',
};
const ESTADOS = { pendiente: 'Pendientes', fusionado: 'Fusionados', descartado: 'Descartados', creado: 'Creados' };

function Registro({ titulo, r }) {
  if (!r) return null;
  return (
    <div className="duplicado__registro">
      <small className="texto-gris">{titulo}</small>
      <strong>{r.etiqueta}</strong>
      <span className="fila texto-chico"><span className="mono texto-gris">#{r.id}</span><SelloVerificacion estado={r.estado_verificacion} />{r.fuente && <span className="texto-gris">{r.fuente}</span>}</span>
    </div>
  );
}

function FilaImportada({ d }) {
  const datos = d.datos_nuevos?.datos || {};
  return (
    <div className="duplicado__registro duplicado__registro--nuevo">
      <small className="texto-gris">Fila {d.datos_nuevos?.fila} de “{d.archivo || 'importación'}” ({d.fuente_importacion}) · no se creó</small>
      <span className="texto-chico">{Object.entries(datos).filter(([, v]) => v).slice(0, 8).map(([k, v]) => `${k}: ${v}`).join(' · ')}</span>
    </div>
  );
}

/** Posibles duplicados: nada se fusiona ni se crea solo; el administrador decide caso por caso. */
export default function AdminDuplicados() {
  useTitulo('Admin · Duplicados');
  const { avisar } = useAvisos();
  const [params, setParams] = useSearchParams();
  const estado = params.get('estado') || 'pendiente';
  const entidad = params.get('entidad') || '';
  const pagina = Number(params.get('pagina')) || 1;
  const { datos, error, cargando, recargar } = useApi('/admin/duplicados', { query: { estado, entidad, pagina } }, `${estado}-${entidad}-${pagina}`);
  const [errorAccion, setErrorAccion] = useState(null);
  const [ocupado, setOcupado] = useState(null);

  const cambiar = (k, v) => {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v); else n.delete(k);
    if (k !== 'pagina') n.delete('pagina');
    setParams(n);
  };

  const resolver = async (d, accion, conservar) => {
    setOcupado(d.id);
    setErrorAccion(null);
    try {
      await api(`/admin/duplicados/${d.id}/resolver`, { method: 'POST', body: { accion, ...(conservar ? { conservar } : {}) } });
      avisar(accion === 'fusionar' ? 'Registros fusionados.' : accion === 'crear' ? 'Registro creado.' : 'Sugerencia descartada.');
      recargar();
    } catch (e) {
      setErrorAccion(e);
    } finally {
      setOcupado(null);
    }
  };

  const escanear = async () => {
    setOcupado('escaneo');
    try {
      const r = await api('/admin/duplicados/escanear', { method: 'POST', body: {} });
      avisar(r.nuevos ? `${plural(r.nuevos, 'posible duplicado nuevo', 'posibles duplicados nuevos')}.` : 'No se encontraron duplicados nuevos.');
      recargar();
    } catch (e) {
      setErrorAccion(e);
    } finally {
      setOcupado(null);
    }
  };

  return (
    <div className="pila">
      <div className="admin-filtros">
        <div className="segmentos" role="group" aria-label="Estado">
          {Object.entries(ESTADOS).map(([k, t]) => (
            <button key={k} type="button" className={estado === k ? 'activo' : ''} aria-pressed={estado === k} onClick={() => cambiar('estado', k === 'pendiente' ? '' : k)}>{t}</button>
          ))}
        </div>
        <select className="select" value={entidad} onChange={(e) => cambiar('entidad', e.target.value)} aria-label="Tipo de dato">
          <option value="">Todos los tipos</option>
          {Object.entries(ENTIDADES).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
        </select>
        <button type="button" className="btn" onClick={escanear} disabled={ocupado === 'escaneo'}><ScanSearch size={16} /> Buscar duplicados en la base</button>
      </div>
      <ErrorMensaje error={error || errorAccion} />
      {cargando && !datos && <Cargando />}
      {datos && !datos.registros.length && <Vacio titulo={estado === 'pendiente' ? 'No hay posibles duplicados pendientes' : 'No hay casos con ese filtro'} />}
      {datos?.registros.map((d) => (
        <article key={d.id} className="tarjeta tarjeta--padding duplicado">
          <header className="fila fila--entre fila--envolver">
            <span><strong>{ENTIDADES[d.entidad] || d.entidad}</strong> · {d.motivo}{d.similitud ? ` · similitud ${Math.round(d.similitud * 100)} %` : ''}</span>
            <small className="texto-gris">Caso #{d.id}</small>
          </header>
          <div className="duplicado__comparacion">
            <Registro titulo="Registro existente" r={d.existente} />
            {d.otro ? <Registro titulo="Posible duplicado" r={d.otro} /> : <FilaImportada d={d} />}
          </div>
          {d.estado === 'pendiente' && (
            <div className="fila fila--envolver duplicado__acciones">
              {d.otro ? (
                <>
                  <button type="button" className="btn btn--oscuro btn--chico" disabled={ocupado === d.id} onClick={() => resolver(d, 'fusionar', d.registro_id)}>
                    <GitMerge size={15} /> Son el mismo: conservar #{d.registro_id}
                  </button>
                  <button type="button" className="btn btn--chico" disabled={ocupado === d.id} onClick={() => resolver(d, 'fusionar', d.duplicado_id)}>
                    <GitMerge size={15} /> Conservar #{d.duplicado_id}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="btn btn--oscuro btn--chico" disabled={ocupado === d.id} onClick={() => resolver(d, 'fusionar')}>
                    <GitMerge size={15} /> Es el mismo: usar el existente
                  </button>
                  <button type="button" className="btn btn--chico" disabled={ocupado === d.id} onClick={() => resolver(d, 'crear')}>
                    <Plus size={15} /> Es otro: crearlo
                  </button>
                </>
              )}
              <button type="button" className="btn btn--fantasma btn--chico" disabled={ocupado === d.id} onClick={() => resolver(d, 'descartar')}>
                <X size={15} /> No son el mismo
              </button>
            </div>
          )}
        </article>
      ))}
      {datos && <Paginacion pagina={datos.pagina} paginas={datos.paginas} alCambiar={(n) => cambiar('pagina', String(n))} />}
    </div>
  );
}

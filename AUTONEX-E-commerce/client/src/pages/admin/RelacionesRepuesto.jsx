import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { ErrorMensaje } from '../../components/Estados.jsx';
import { SelloVerificacion } from '../../components/Verificacion.jsx';
import { useAvisos } from '../../context/AvisosContext.jsx';
import { api } from '../../lib/api.js';
import { useApi } from '../../lib/hooks.js';
import { plural } from '../../lib/formato.js';
import { CampoReferencia, SelectorFuente } from './comun.jsx';

/** Compatibilidades, números OEM y equivalencias de un repuesto, con su fuente y estado. */
export default function RelacionesRepuesto({ productoId, detalle, alCambiar, fuentes }) {
  const { avisar } = useAvisos();
  const [error, setError] = useState(null);
  const [fuenteId, setFuenteId] = useState('');
  const [compat, setCompat] = useState({ modelo_id: null, modelo: '', anio_desde: '', anio_hasta: '', posicion: '' });
  const [oem, setOem] = useState({ marca_vehiculo_id: null, numero_oem: '' });
  const [eq, setEq] = useState({ marca_repuesto_id: null, numero_pieza: '', tipo: 'equivalente' });
  const compatibles = useApi(`/admin/compatibilidades?producto=${productoId}`, {}, `${productoId}-${detalle.registro.actualizado_en}`);

  const ejecutar = async (accion, mensaje) => {
    setError(null);
    try {
      const r = await accion();
      avisar(typeof mensaje === 'function' ? mensaje(r) : mensaje);
      alCambiar();
      compatibles.recargar();
      return true;
    } catch (e) {
      setError(e);
      return false;
    }
  };
  const traza = () => (fuenteId ? { fuente_id: Number(fuenteId) } : {});

  const agregarCompat = (e) => {
    e.preventDefault();
    ejecutar(() => api(`/admin/productos/${productoId}/compatibilidades`, {
      method: 'POST',
      body: {
        modelo_id: compat.modelo_id, anio_desde: Number(compat.anio_desde) || undefined, anio_hasta: Number(compat.anio_hasta) || undefined,
        posicion: compat.posicion || undefined, ...traza(),
      },
    }), (r) => `${plural(r.agregadas, 'versión agregada', 'versiones agregadas')} (${r.ya_existian} ya estaban) · ${r.estado}.`);
  };

  const quitarCompat = (vehiculoId) => ejecutar(() => api(`/admin/productos/${productoId}/compatibilidades/quitar`, {
    method: 'POST', body: { vehiculo_ids: [vehiculoId] },
  }), 'Compatibilidad quitada.');

  const agregarOem = async (e) => {
    e.preventDefault();
    if (await ejecutar(() => api(`/admin/productos/${productoId}/oem`, { method: 'POST', body: { ...oem, ...traza() } }), 'Número OEM agregado.')) {
      setOem({ marca_vehiculo_id: null, numero_oem: '' });
    }
  };

  const agregarEq = async (e) => {
    e.preventDefault();
    if (await ejecutar(() => api(`/admin/productos/${productoId}/equivalencias`, { method: 'POST', body: { ...eq, ...traza() } }), 'Equivalencia agregada.')) {
      setEq({ marca_repuesto_id: null, numero_pieza: '', tipo: 'equivalente' });
    }
  };

  const porEstado = detalle.compatibilidades_por_estado || {};
  return (
    <section className="admin-relaciones">
      <div className="fila fila--entre fila--envolver">
        <h3>Relaciones del repuesto</h3>
        <label className="fila texto-chico">
          Fuente de lo que agregues:
          <SelectorFuente valor={fuenteId} fuentes={fuentes} sinDemo vacio="Carga manual" alCambiar={setFuenteId} />
        </label>
      </div>
      <ErrorMensaje error={error} />

      <h4>Compatibilidades <small className="texto-gris">{Object.entries(porEstado).map(([k, v]) => `${v} ${k}`).join(' · ') || 'ninguna'}</small></h4>
      <form className="admin-relaciones__alta" onSubmit={agregarCompat}>
        <CampoReferencia entidad="modelos" valor={compat.modelo_id} etiquetaInicial={compat.modelo} requerido
          alCambiar={(id, etiqueta) => setCompat((c) => ({ ...c, modelo_id: id, modelo: etiqueta }))} />
        <input className="input" type="number" placeholder="Año desde" value={compat.anio_desde} onChange={(e) => setCompat({ ...compat, anio_desde: e.target.value })} />
        <input className="input" type="number" placeholder="Año hasta" value={compat.anio_hasta} onChange={(e) => setCompat({ ...compat, anio_hasta: e.target.value })} />
        <input className="input" placeholder="Posición (opcional)" value={compat.posicion} onChange={(e) => setCompat({ ...compat, posicion: e.target.value })} />
        <button type="submit" className="btn btn--oscuro btn--chico" disabled={!compat.modelo_id}><Plus size={15} /> Agregar versiones</button>
      </form>
      <p className="texto-chico texto-gris">Agrega todas las versiones del modelo que se venden en esos años. Quedan sin verificar salvo que elijas una fuente real y las verifiques.</p>
      {compatibles.datos?.registros.length > 0 && (
        <div className="tabla-contenedor admin-relaciones__tabla">
          <table className="tabla">
            <tbody>
              {compatibles.datos.registros.map((c) => (
                <tr key={c.id}>
                  <td>{c.marca} {c.modelo} <span className="texto-gris">{c.version}</span></td>
                  <td className="mono">{c.anio_desde}–{c.anio_hasta || 'hoy'}</td>
                  <td>{c.posicion}</td>
                  <td><SelloVerificacion estado={c.estado_verificacion} /> <small className="texto-gris">{c.fuente}</small></td>
                  <td><button type="button" className="btn-icono" aria-label="Quitar" onClick={() => quitarCompat(c.vehiculo_id)}><Trash2 size={15} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {compatibles.datos.total > compatibles.datos.registros.length && (
            <p className="texto-chico texto-gris">Mostrando {compatibles.datos.registros.length} de {compatibles.datos.total}. Ver todas en “Compatibilidades”.</p>
          )}
        </div>
      )}

      <h4>Números OEM</h4>
      <ul className="lista-codigos">
        {detalle.oem.map((o) => (
          <li key={o.id}>
            <span>{o.marca}</span><code>{o.numero_oem}</code><SelloVerificacion estado={o.estado_verificacion} />
            <small className="texto-gris">{o.fuente}</small>
            <button type="button" className="btn-icono" aria-label="Quitar" onClick={() => ejecutar(() => api(`/admin/productos/${productoId}/oem/${o.id}`, { method: 'DELETE' }), 'Número OEM quitado.')}><Trash2 size={15} /></button>
          </li>
        ))}
      </ul>
      <form className="admin-relaciones__alta" onSubmit={agregarOem}>
        <CampoReferencia entidad="marcas" valor={oem.marca_vehiculo_id} etiquetaInicial="" requerido
          alCambiar={(id) => setOem((o) => ({ ...o, marca_vehiculo_id: id }))} />
        <input className="input" placeholder="Número OEM" required value={oem.numero_oem} onChange={(e) => setOem({ ...oem, numero_oem: e.target.value })} />
        <button type="submit" className="btn btn--oscuro btn--chico" disabled={!oem.marca_vehiculo_id}><Plus size={15} /> Agregar OEM</button>
      </form>

      <h4>Equivalencias</h4>
      <ul className="lista-codigos">
        {detalle.equivalencias.map((e) => (
          <li key={e.id}>
            <span>{e.marca}</span><code>{e.numero_pieza}</code>{e.sku_equivalente && <small>({e.sku_equivalente})</small>}
            <small className="texto-gris">{e.tipo}</small><SelloVerificacion estado={e.estado_verificacion} />
            <button type="button" className="btn-icono" aria-label="Quitar" onClick={() => ejecutar(() => api(`/admin/productos/${productoId}/equivalencias/${e.id}`, { method: 'DELETE' }), 'Equivalencia quitada.')}><Trash2 size={15} /></button>
          </li>
        ))}
      </ul>
      <form className="admin-relaciones__alta" onSubmit={agregarEq}>
        <CampoReferencia entidad="marcas_repuesto" valor={eq.marca_repuesto_id} etiquetaInicial="" requerido
          alCambiar={(id) => setEq((x) => ({ ...x, marca_repuesto_id: id }))} />
        <input className="input" placeholder="Número de pieza" required value={eq.numero_pieza} onChange={(e) => setEq({ ...eq, numero_pieza: e.target.value })} />
        <select className="select" value={eq.tipo} onChange={(e) => setEq({ ...eq, tipo: e.target.value })} aria-label="Tipo de equivalencia">
          <option value="equivalente">Equivalente</option>
          <option value="reemplaza">Reemplaza a</option>
          <option value="reemplazado_por">Reemplazado por</option>
        </select>
        <button type="submit" className="btn btn--oscuro btn--chico" disabled={!eq.marca_repuesto_id}><Plus size={15} /> Agregar</button>
      </form>
    </section>
  );
}

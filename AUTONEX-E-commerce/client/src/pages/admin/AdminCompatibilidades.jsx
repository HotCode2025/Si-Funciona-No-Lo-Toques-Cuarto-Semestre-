import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { Cargando, ErrorMensaje, Vacio } from '../../components/Estados.jsx';
import { Paginacion } from '../../components/Producto.jsx';
import { SelloVerificacion } from '../../components/Verificacion.jsx';
import { useApi, useReferencias, useTitulo } from '../../lib/hooks.js';
import { plural } from '../../lib/formato.js';
import { useFuentes } from './comun.jsx';
import Verificar from './Verificar.jsx';

/** Cola de revisión de compatibilidades repuesto ↔ vehículo, con verificación masiva. */
export default function AdminCompatibilidades() {
  useTitulo('Admin · Compatibilidades');
  const referencias = useReferencias();
  const fuentes = useFuentes();
  const [params, setParams] = useSearchParams();
  const consulta = { estado: params.get('estado') || 'NEEDS_REVIEW', fuente: params.get('fuente'), producto: params.get('producto'), pagina: params.get('pagina') || 1 };
  const { datos, error, cargando, recargar } = useApi('/admin/compatibilidades', { query: consulta }, JSON.stringify(consulta));
  const [seleccion, setSeleccion] = useState([]);
  const [verificando, setVerificando] = useState(false);

  const cambiar = (k, v) => {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v); else n.delete(k);
    if (k !== 'pagina') n.delete('pagina');
    setParams(n);
    setSeleccion([]);
  };
  const registros = datos?.registros || [];
  const todos = registros.length > 0 && registros.every((r) => seleccion.includes(r.id));

  return (
    <div className="pila">
      <div className="admin-filtros">
        <select className="select" value={consulta.estado} onChange={(e) => cambiar('estado', e.target.value)} aria-label="Estado">
          {referencias?.estados_verificacion.map((x) => <option key={x.valor} value={x.valor}>{x.etiqueta}</option>)}
        </select>
        <select className="select" value={consulta.fuente || ''} onChange={(e) => cambiar('fuente', e.target.value)} aria-label="Fuente">
          <option value="">Todas las fuentes</option>
          {fuentes.datos?.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
        </select>
        {consulta.producto && <button type="button" className="chip" onClick={() => cambiar('producto', null)}>Repuesto #{consulta.producto} ✕</button>}
      </div>
      {seleccion.length > 0 && (
        <div className="admin-seleccion">
          <span>{plural(seleccion.length, 'compatibilidad seleccionada', 'compatibilidades seleccionadas')}</span>
          <button type="button" className="btn btn--oscuro btn--chico" onClick={() => setVerificando(true)}><ShieldCheck size={15} /> Cambiar verificación</button>
        </div>
      )}
      <ErrorMensaje error={error} />
      {cargando && !datos && <Cargando />}
      {datos && (registros.length === 0 ? <Vacio titulo="No hay compatibilidades con esos filtros" /> : (
        <>
          <p className="texto-gris texto-chico">{plural(datos.total, 'compatibilidad', 'compatibilidades')}</p>
          <div className="tabla-contenedor">
            <table className="tabla tabla--admin">
              <thead>
                <tr>
                  <th><input type="checkbox" checked={todos} aria-label="Seleccionar todas" onChange={() => setSeleccion(todos ? [] : registros.map((r) => r.id))} /></th>
                  <th>Repuesto</th><th>Vehículo</th><th>Años</th><th>Posición</th><th>Estado</th><th>Fuente</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((c) => (
                  <tr key={c.id}>
                    <td><input type="checkbox" checked={seleccion.includes(c.id)} aria-label="Seleccionar"
                      onChange={() => setSeleccion((s) => (s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id]))} /></td>
                    <td>
                      <Link to={`/admin/datos/productos?id=${c.producto_id}`} className="enlace">{c.producto}</Link>
                      <small className="texto-gris"> · {c.marca_repuesto} {c.numero_pieza} · {c.sku}</small>
                    </td>
                    <td>{c.marca} {c.modelo} <small className="texto-gris">{c.version}</small></td>
                    <td className="mono">{c.anio_desde}–{c.anio_hasta || 'hoy'}</td>
                    <td>{c.posicion || '—'}</td>
                    <td><SelloVerificacion estado={c.estado_verificacion} /></td>
                    <td className="texto-chico">{c.fuente}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Paginacion pagina={datos.pagina} paginas={datos.paginas} alCambiar={(n) => cambiar('pagina', String(n))} />
        </>
      ))}
      {verificando && (
        <Verificar entidad="compatibilidades" ids={seleccion} alCerrar={() => setVerificando(false)}
          alListo={() => { setVerificando(false); setSeleccion([]); recargar(); }} />
      )}
    </div>
  );
}

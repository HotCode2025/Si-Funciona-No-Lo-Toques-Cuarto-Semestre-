import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download } from 'lucide-react';
import { Cargando, ErrorMensaje, EtiquetaEstado, Vacio } from '../../components/Estados.jsx';
import { Paginacion } from '../../components/Producto.jsx';
import { descargar } from '../../lib/api.js';
import { useApi, useTitulo } from '../../lib/hooks.js';
import { fechaYHora } from '../../lib/formato.js';
import { ESTADOS_IMPORTACION } from './comun.jsx';

function Detalle({ id }) {
  const [pagina, setPagina] = useState(1);
  const [error, setError] = useState(null);
  const { datos, error: errorCarga, cargando } = useApi(`/admin/importaciones/${id}?pagina_errores=${pagina}`);
  useTitulo(`Admin · Importación #${id}`);
  if (cargando && !datos) return <Cargando />;
  if (errorCarga) return <ErrorMensaje error={errorCarga} />;
  const i = datos.importacion;
  const numeros = [
    ['Filas', i.filas_total], ['Nuevas', i.filas_creadas], ['Actualizadas', i.filas_actualizadas],
    ['Sin cambios', i.filas_sin_cambios], ['Posibles duplicados', i.filas_duplicadas], ['Con error', i.filas_error],
  ];
  return (
    <div className="pila">
      <Link to="/admin/importaciones" className="enlace"><ArrowLeft size={15} /> Todas las importaciones</Link>
      <div className="tarjeta tarjeta--padding">
        <div className="fila fila--entre fila--envolver">
          <h2>Importación #{i.id} · {i.entidad}</h2>
          <EtiquetaEstado estado={i.estado} mapa={ESTADOS_IMPORTACION} />
        </div>
        <p className="texto-gris texto-chico">
          {i.archivo} ({i.formato}) · fuente <strong>{i.fuente}</strong>{i.proveedor && <> · proveedor {i.proveedor}</>}
          {' · '}{fechaYHora(i.iniciada_en)}
        </p>
        <dl className="admin-resultado__numeros">
          {numeros.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
        {i.resumen?.columnas_ignoradas?.length > 0 && <p className="texto-chico texto-ambar">Columnas ignoradas: {i.resumen.columnas_ignoradas.join(', ')}</p>}
        {i.resumen?.error && <p className="alerta alerta--error">{i.resumen.error}</p>}
      </div>
      {datos.errores_total > 0 && (
        <div className="tarjeta tarjeta--padding">
          <div className="fila fila--entre fila--envolver">
            <h3>Errores ({datos.errores_total})</h3>
            <button type="button" className="btn btn--chico" onClick={() => descargar(`/admin/importaciones/${id}/errores.csv`, `importacion-${id}-errores.csv`).catch(setError)}>
              <Download size={15} /> Descargar CSV para corregir
            </button>
          </div>
          <ErrorMensaje error={error} />
          <div className="tabla-contenedor">
            <table className="tabla">
              <thead><tr><th>Fila</th><th>Campo</th><th>Error</th><th>Datos</th></tr></thead>
              <tbody>
                {datos.errores.map((e, n) => (
                  <tr key={`${e.fila}-${n}`}>
                    <td className="mono">{e.fila}</td>
                    <td>{e.campo || '—'}</td>
                    <td>{e.mensaje}</td>
                    <td className="texto-chico texto-gris admin-datos-crudos">{Object.entries(e.datos || {}).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(' · ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Paginacion pagina={pagina} paginas={datos.errores_paginas} alCambiar={setPagina} />
        </div>
      )}
    </div>
  );
}

export default function AdminImportaciones() {
  const { id } = useParams();
  const [pagina, setPagina] = useState(1);
  const { datos, error, cargando } = useApi(id ? null : `/admin/importaciones?pagina=${pagina}`);
  useTitulo('Admin · Importaciones');
  if (id) return <Detalle id={id} />;
  if (cargando && !datos) return <Cargando />;
  if (error) return <ErrorMensaje error={error} />;
  if (!datos.registros.length) return <Vacio titulo="Todavía no hay importaciones" accion={<Link to="/admin/importar" className="btn btn--primario">Importar un archivo</Link>} />;
  return (
    <>
      <div className="tabla-contenedor">
        <table className="tabla tabla--admin">
          <thead>
            <tr><th>#</th><th>Fecha</th><th>Qué</th><th>Archivo</th><th>Fuente</th><th>Estado</th><th>Filas</th><th>Nuevas</th><th>Act.</th><th>Dup.</th><th>Errores</th></tr>
          </thead>
          <tbody>
            {datos.registros.map((i) => (
              <tr key={i.id}>
                <td><Link to={`/admin/importaciones/${i.id}`} className="enlace">{i.id}</Link></td>
                <td className="texto-chico">{fechaYHora(i.iniciada_en)}</td>
                <td>{i.entidad}</td>
                <td className="texto-chico">{i.archivo}</td>
                <td className="texto-chico">{i.fuente}</td>
                <td><EtiquetaEstado estado={i.estado} mapa={ESTADOS_IMPORTACION} /></td>
                <td className="mono">{i.filas_total}</td>
                <td className="mono">{i.filas_creadas}</td>
                <td className="mono">{i.filas_actualizadas}</td>
                <td className="mono">{i.filas_duplicadas}</td>
                <td className="mono">{i.filas_error}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Paginacion pagina={datos.pagina} paginas={datos.paginas} alCambiar={setPagina} />
    </>
  );
}

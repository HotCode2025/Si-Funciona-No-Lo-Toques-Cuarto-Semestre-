import { Link, NavLink, Route, Routes } from 'react-router-dom';
import { AlertTriangle, Copy, Database, FileUp, History, LayoutDashboard, Link2 } from 'lucide-react';
import { Cargando, ErrorMensaje, EtiquetaEstado } from '../../components/Estados.jsx';
import { useApi, useReferencias, useTitulo } from '../../lib/hooks.js';
import { fechaYHora } from '../../lib/formato.js';
import { ESTADOS_IMPORTACION } from './comun.jsx';
import AdminDatos from './AdminDatos.jsx';
import AdminImportar from './AdminImportar.jsx';
import AdminImportaciones from './AdminImportaciones.jsx';
import AdminDuplicados from './AdminDuplicados.jsx';
import AdminCompatibilidades from './AdminCompatibilidades.jsx';

const NOMBRES = {
  marcas: 'Marcas', modelos: 'Modelos', generaciones: 'Generaciones', motores: 'Motores', vehiculos: 'Versiones',
  marcas_repuesto: 'Marcas de repuesto', productos: 'Repuestos', compatibilidades: 'Compatibilidades', oem: 'Números OEM',
  equivalencias: 'Equivalencias',
};
const ENLACES = {
  marcas: '/admin/datos/marcas', modelos: '/admin/datos/modelos', generaciones: '/admin/datos/generaciones',
  motores: '/admin/datos/motores', vehiculos: '/admin/datos/vehiculos', marcas_repuesto: '/admin/datos/marcas_repuesto',
  productos: '/admin/datos/productos', compatibilidades: '/admin/compatibilidades',
};
const ESTADOS = ['VERIFIED', 'UNVERIFIED', 'NEEDS_REVIEW', 'DISCONTINUED'];

function Resumen() {
  useTitulo('Admin · Catálogo');
  const referencias = useReferencias();
  const { datos, error, cargando } = useApi('/admin/resumen');
  if (cargando) return <Cargando />;
  if (error) return <ErrorMensaje error={error} />;
  const etiqueta = (e) => referencias?.estados_verificacion.find((x) => x.valor === e)?.etiqueta || e;
  const a = datos.alertas;
  const duplicados = Object.values(datos.duplicados_pendientes).reduce((s, n) => s + n, 0);
  const alertas = [
    duplicados && { texto: `${duplicados} posibles duplicados para revisar`, enlace: '/admin/duplicados' },
    a.productos_sin_compatibilidad && { texto: `${a.productos_sin_compatibilidad} repuestos no universales sin compatibilidades`, enlace: '/admin/datos/productos' },
    a.fuentes_sin_revisar && { texto: `${a.fuentes_sin_revisar} fuentes con términos o licencia sin revisar`, enlace: '/admin/datos/fuentes' },
    a.productos_sin_fuente && { texto: `${a.productos_sin_fuente} repuestos sin fuente`, enlace: '/admin/datos/productos' },
    a.modelos_sin_versiones && { texto: `${a.modelos_sin_versiones} modelos sin versiones`, enlace: '/admin/datos/modelos' },
  ].filter(Boolean);

  return (
    <div className="pila">
      {alertas.length > 0 && (
        <div className="alerta alerta--aviso">
          <AlertTriangle size={20} aria-hidden="true" />
          <ul>{alertas.map((x) => <li key={x.texto}><Link to={x.enlace}>{x.texto}</Link></li>)}</ul>
        </div>
      )}

      <div className="tabla-contenedor">
        <table className="tabla tabla--admin">
          <thead>
            <tr><th>Dato</th><th>Total</th>{ESTADOS.map((e) => <th key={e}>{etiqueta(e)}</th>)}</tr>
          </thead>
          <tbody>
            {Object.entries(datos.por_estado).map(([entidad, n]) => (
              <tr key={entidad}>
                <td>{ENLACES[entidad] ? <Link to={ENLACES[entidad]} className="enlace">{NOMBRES[entidad]}</Link> : NOMBRES[entidad]}</td>
                <td className="mono"><strong>{n.total.toLocaleString('es-AR')}</strong></td>
                {ESTADOS.map((e) => <td key={e} className="mono">{(n[e] || 0).toLocaleString('es-AR')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="admin-resumen__grilla">
        <section className="tarjeta tarjeta--padding">
          <h3>Fuentes</h3>
          <ul className="admin-lista">
            {datos.fuentes.map((f) => (
              <li key={f.id}>
                <Link to={`/admin/datos/fuentes?id=${f.id}`} className="enlace">{f.nombre}</Link>
                <small className="texto-gris">
                  {f.licencia || 'sin licencia indicada'} · {f.vehiculos} versiones · {f.productos} repuestos · {f.compatibilidades} compatibilidades
                  {!f.checklist_ok && <span className="texto-ambar"> · checklist incompleto</span>}
                </small>
              </li>
            ))}
          </ul>
        </section>
        <section className="tarjeta tarjeta--padding">
          <div className="fila fila--entre"><h3>Últimas importaciones</h3><Link to="/admin/importar" className="btn btn--chico btn--primario"><FileUp size={15} /> Importar</Link></div>
          <ul className="admin-lista">
            {datos.ultimas_importaciones.map((i) => (
              <li key={i.id}>
                <span className="fila"><Link to={`/admin/importaciones/${i.id}`} className="enlace">#{i.id} · {i.entidad}</Link><EtiquetaEstado estado={i.estado} mapa={ESTADOS_IMPORTACION} /></span>
                <small className="texto-gris">{fechaYHora(i.iniciada_en)} · {i.fuente} · {i.filas_total} filas · {i.filas_creadas} nuevas · {i.filas_error} errores</small>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

/** Panel de administración del catálogo (solo rol admin). */
export default function Admin() {
  return (
    <div className="contenedor pagina panel admin">
      <header className="admin__cabecera">
        <span className="texto-gris texto-chico">Administración</span>
        <h1>Catálogo AUTONEX</h1>
        <p className="texto-gris texto-chico">
          Cada dato guarda su fuente y su estado de verificación. Lo que no está verificado nunca se muestra como confirmado en la tienda.
        </p>
      </header>
      <nav className="pestanas" aria-label="Secciones de administración">
        <NavLink to="/admin" end><LayoutDashboard size={18} /> Resumen</NavLink>
        <NavLink to="/admin/datos"><Database size={18} /> Datos</NavLink>
        <NavLink to="/admin/compatibilidades"><Link2 size={18} /> Compatibilidades</NavLink>
        <NavLink to="/admin/importar"><FileUp size={18} /> Importar</NavLink>
        <NavLink to="/admin/importaciones"><History size={18} /> Importaciones</NavLink>
        <NavLink to="/admin/duplicados"><Copy size={18} /> Duplicados</NavLink>
      </nav>
      <Routes>
        <Route index element={<Resumen />} />
        <Route path="datos" element={<AdminDatos />} />
        <Route path="datos/:entidad" element={<AdminDatos />} />
        <Route path="compatibilidades" element={<AdminCompatibilidades />} />
        <Route path="importar" element={<AdminImportar />} />
        <Route path="importaciones" element={<AdminImportaciones />} />
        <Route path="importaciones/:id" element={<AdminImportaciones />} />
        <Route path="duplicados" element={<AdminDuplicados />} />
      </Routes>
    </div>
  );
}

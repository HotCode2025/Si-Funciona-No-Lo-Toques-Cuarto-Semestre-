import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Search, ShieldCheck } from 'lucide-react';
import { Cargando, ErrorMensaje, Vacio } from '../../components/Estados.jsx';
import { Paginacion } from '../../components/Producto.jsx';
import { SelloVerificacion } from '../../components/Verificacion.jsx';
import { useApi, useReferencias, useTitulo } from '../../lib/hooks.js';
import { plural } from '../../lib/formato.js';
import { formatoCelda, useEsquema, useEtiquetaLista, useFuentes } from './comun.jsx';
import FormularioEntidad from './FormularioEntidad.jsx';
import Verificar from './Verificar.jsx';

const ETIQUETAS_COLUMNA = {
  nombre: 'Nombre', marca: 'Marca', modelo: 'Modelo', version: 'Versión', segmento: 'Segmento', estado_mercado: 'Mercado',
  modelos: 'Modelos', versiones: 'Versiones', popularidad: 'Registros', tipo: 'Tipo', anio_desde: 'Desde', anio_hasta: 'Hasta',
  codigo: 'Código', motor: 'Motor', cilindrada_cc: 'cc', combustible: 'Combustible', potencia_cv: 'CV', ruta: 'Ubicación',
  slug: 'Slug', destacada: 'Destacada', productos: 'Repuestos', pais: 'País', sku: 'SKU', numero_pieza: 'N° de pieza',
  categoria: 'Categoría', compatibilidades: 'Compat.', licencia: 'Licencia', nivel_confianza: 'Confianza', datos: 'Datos',
  actualizado_en: 'Actualizado', formato_catalogo: 'Formato', ultima_importacion: 'Última importación',
};

/** Listado de una entidad del catálogo con búsqueda, filtros de verificación y fuente, alta, edición y verificación masiva. */
export default function AdminDatos() {
  const { entidad = 'marcas' } = useParams();
  const navegar = useNavigate();
  const [params, setParams] = useSearchParams();
  const { esquema, error: errorEsquema } = useEsquema();
  const referencias = useReferencias();
  const fuentes = useFuentes();
  const etiquetaLista = useEtiquetaLista();
  const [texto, setTexto] = useState(params.get('q') || '');
  const [seleccion, setSeleccion] = useState([]);
  const [editando, setEditando] = useState(params.get('id') ? Number(params.get('id')) : null);
  const [verificando, setVerificando] = useState(false);

  const definicion = esquema?.entidades[entidad];
  useTitulo(definicion ? `Admin · ${definicion.titulo}` : 'Admin');
  const consulta = { q: params.get('q'), estado: params.get('estado'), fuente: params.get('fuente'), pagina: params.get('pagina') || 1 };
  const lista = useApi(definicion ? `/admin/datos/${entidad}` : null, { query: consulta }, `${entidad}-${JSON.stringify(consulta)}`);

  useEffect(() => {
    setSeleccion([]);
    setTexto(params.get('q') || '');
  }, [entidad]); // eslint-disable-line react-hooks/exhaustive-deps

  const cambiar = (cambios) => {
    const nuevos = new URLSearchParams(params);
    for (const [k, v] of Object.entries(cambios)) {
      if (v === null || v === undefined || v === '') nuevos.delete(k);
      else nuevos.set(k, v);
    }
    if (!('pagina' in cambios)) nuevos.delete('pagina');
    setParams(nuevos);
  };

  if (errorEsquema) return <ErrorMensaje error={errorEsquema} />;
  if (!esquema) return <Cargando />;
  if (!definicion) return <Vacio titulo="Esa sección no existe" />;

  const registros = lista.datos?.registros || [];
  const todos = registros.length > 0 && registros.every((r) => seleccion.includes(r.id));
  const alternar = (id) => setSeleccion((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const cerrarEditor = () => {
    setEditando(null);
    cambiar({ id: null });
  };
  const columnaLista = (col) => definicion.campos.find((c) => c.nombre === col && c.tipo === 'lista')?.lista;

  return (
    <div className="admin-datos">
      <div className="admin-entidades" role="tablist" aria-label="Qué querés administrar">
        {Object.entries(esquema.entidades).map(([clave, d]) => (
          <button key={clave} type="button" role="tab" aria-selected={clave === entidad} className={clave === entidad ? 'activo' : ''}
            onClick={() => navegar(`/admin/datos/${clave}`)}>{d.titulo}</button>
        ))}
      </div>

      <div className="admin-filtros">
        <form className="admin-filtros__buscar" onSubmit={(e) => { e.preventDefault(); cambiar({ q: texto.trim() }); }}>
          <Search size={16} aria-hidden="true" />
          <input className="input" type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={`Buscar en ${definicion.titulo.toLowerCase()}…`} aria-label="Buscar" />
        </form>
        {definicion.trazable && (
          <>
            <select className="select" value={params.get('estado') || ''} onChange={(e) => cambiar({ estado: e.target.value })} aria-label="Estado de verificación">
              <option value="">Todos los estados</option>
              {referencias?.estados_verificacion.map((x) => <option key={x.valor} value={x.valor}>{x.etiqueta}</option>)}
            </select>
            <select className="select" value={params.get('fuente') || ''} onChange={(e) => cambiar({ fuente: e.target.value })} aria-label="Fuente">
              <option value="">Todas las fuentes</option>
              {fuentes.datos?.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
            </select>
          </>
        )}
        <button type="button" className="btn btn--primario" onClick={() => setEditando(0)}><Plus size={16} /> Nuevo</button>
      </div>

      {seleccion.length > 0 && definicion.trazable && (
        <div className="admin-seleccion">
          <span>{plural(seleccion.length, 'seleccionado', 'seleccionados')}</span>
          <button type="button" className="btn btn--oscuro btn--chico" onClick={() => setVerificando(true)}><ShieldCheck size={15} /> Cambiar verificación</button>
          <button type="button" className="enlace" onClick={() => setSeleccion([])}>Quitar selección</button>
        </div>
      )}

      <ErrorMensaje error={lista.error} />
      {lista.cargando && !lista.datos && <Cargando />}
      {lista.datos && (
        <>
          <p className="texto-gris texto-chico">{plural(lista.datos.total, 'registro', 'registros')}</p>
          {registros.length === 0 ? <Vacio titulo="No hay registros con esos filtros" /> : (
            <div className="tabla-contenedor">
              <table className={`tabla tabla--admin ${lista.cargando ? 'cargando-suave' : ''}`}>
                <thead>
                  <tr>
                    {definicion.trazable && (
                      <th><input type="checkbox" checked={todos} aria-label="Seleccionar todos"
                        onChange={() => setSeleccion(todos ? [] : registros.map((r) => r.id))} /></th>
                    )}
                    <th>#</th>
                    {definicion.columnas.map((c) => <th key={c}>{ETIQUETAS_COLUMNA[c] || c}</th>)}
                    {definicion.trazable && <><th>Estado</th><th>Fuente</th></>}
                  </tr>
                </thead>
                <tbody>
                  {registros.map((r) => (
                    <tr key={r.id} onClick={() => setEditando(r.id)} className="tabla__fila-clic">
                      {definicion.trazable && (
                        <td onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={seleccion.includes(r.id)} onChange={() => alternar(r.id)} aria-label={`Seleccionar ${r.etiqueta}`} />
                        </td>
                      )}
                      <td className="mono texto-gris">{r.id}</td>
                      {definicion.columnas.map((c) => (
                        <td key={c}>{columnaLista(c) ? etiquetaLista(columnaLista(c), r[c]) || '—' : formatoCelda(c, r[c])}</td>
                      ))}
                      {definicion.trazable && <><td><SelloVerificacion estado={r.estado_verificacion} /></td><td className="texto-chico">{r.fuente || '—'}</td></>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Paginacion pagina={lista.datos.pagina} paginas={lista.datos.paginas} alCambiar={(n) => cambiar({ pagina: n })} />
        </>
      )}

      {editando !== null && (
        <FormularioEntidad entidad={entidad} definicion={definicion} listas={esquema.listas} registroId={editando || null}
          alCerrar={cerrarEditor} alGuardar={() => { cerrarEditor(); lista.recargar(); }} />
      )}
      {verificando && (
        <Verificar entidad={entidad} ids={seleccion} alCerrar={() => setVerificando(false)}
          alListo={() => { setVerificando(false); setSeleccion([]); lista.recargar(); }} />
      )}
    </div>
  );
}

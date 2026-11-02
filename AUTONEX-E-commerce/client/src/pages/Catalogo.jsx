import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Bike, Car, Search, ShieldCheck, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { Paginacion, TarjetaProducto } from '../components/Producto.jsx';
import TarjetaMarcaRepuesto from '../components/MarcaRepuesto.jsx';
import { Cargando, ErrorMensaje, Vacio } from '../components/Estados.jsx';
import { useVehiculo } from '../context/VehiculoContext.jsx';
import { useApi, useCategorias, useReferencias, useTitulo } from '../lib/hooks.js';
import { plural, precio } from '../lib/formato.js';

const ORDENES = [
  ['relevancia', 'Más relevantes'],
  ['precio_asc', 'Menor precio'],
  ['precio_desc', 'Mayor precio'],
];

function Grupo({ titulo, children }) {
  return (
    <fieldset className="filtros__grupo">
      <legend>{titulo}</legend>
      {children}
    </fieldset>
  );
}

/** N° de parte, OEM, SKU, EAN/UPC o equivalencia ("0 986 494 133" = "0986494133"). */
function FiltroCodigo({ valor, alAplicar }) {
  const [codigo, setCodigo] = useState(valor || '');
  useEffect(() => setCodigo(valor || ''), [valor]);
  return (
    <form className="filtros__precio" onSubmit={(e) => { e.preventDefault(); alAplicar(codigo.trim()); }}>
      <input className="input" value={codigo} onChange={(e) => setCodigo(e.target.value)} maxLength={60}
        placeholder="Ej: 0986494133" aria-label="Número de parte, OEM o código de barras" />
      <button type="submit" className="btn btn--oscuro btn--chico" aria-label="Buscar código"><Search size={15} /></button>
    </form>
  );
}

const MARCAS_VISIBLES = 12;

/**
 * Repuestos de motos: subcategorías (aunque todavía no tengan productos publicados) y las marcas que fabrican lo de
 * esta categoría, con sus líneas. Así la sección no queda vacía mientras se cargan los catálogos de los proveedores.
 */
function ExplorarMotos({ categoria }) {
  const categorias = useCategorias();
  const hijas = categorias.filter((c) => c.padre_id === categoria.id);
  const marcas = useApi(`/marcas-repuesto?categoria=${encodeURIComponent(categoria.slug)}`);
  const [todas, setTodas] = useState(false);
  useEffect(() => setTodas(false), [categoria.slug]);
  const lista = marcas.datos || [];
  return (
    <section className="explorar-motos" aria-label={`Explorar ${categoria.nombre}`}>
      {hijas.length > 0 && (
        <div className="explorar-motos__bloque">
          <h2 className="explorar-motos__titulo">Categorías</h2>
          <div className="chips">
            {hijas.map((c) => (
              <Link key={c.slug} to={`/catalogo?categoria=${c.slug}`} className="chip">
                {c.nombre}{Number(c.cantidad) > 0 && <span className="chip__contador">{c.cantidad}</span>}
              </Link>
            ))}
          </div>
        </div>
      )}
      {lista.length > 0 && (
        <div className="explorar-motos__bloque">
          <h2 className="explorar-motos__titulo">Marcas que fabrican {categoria.slug === 'motos' ? 'repuestos para motos' : categoria.nombre.toLowerCase()}</h2>
          <div className="marcas-repuesto">
            {(todas ? lista : lista.slice(0, MARCAS_VISIBLES)).map((m) => <TarjetaMarcaRepuesto key={m.id} marca={m} />)}
          </div>
          {!todas && lista.length > MARCAS_VISIBLES && (
            <button type="button" className="btn btn--fantasma btn--bloque" onClick={() => setTodas(true)}>Ver las {lista.length} marcas</button>
          )}
        </div>
      )}
      <p className="texto-chico texto-gris">
        Las marcas y lo que fabrica cada una son de la lista de AUTONEX (sin verificar). Los repuestos con número de parte,
        precio y compatibilidad se publican cuando una casa de repuestos carga su catálogo · <Link to="/marcas-repuestos">Todas las marcas de repuestos para motos</Link>
      </p>
    </section>
  );
}

function FiltroPrecio({ min, max, rango, alAplicar }) {
  const [desde, setDesde] = useState(min || '');
  const [hasta, setHasta] = useState(max || '');
  useEffect(() => {
    setDesde(min || '');
    setHasta(max || '');
  }, [min, max]);
  const aplicar = (e) => {
    e.preventDefault();
    alAplicar(desde, hasta);
  };
  return (
    <form className="filtros__precio" onSubmit={aplicar}>
      <input className="input" type="number" min="0" inputMode="numeric" placeholder={rango?.min ? `Mín. ${Math.floor(rango.min)}` : 'Mínimo'}
        value={desde} onChange={(e) => setDesde(e.target.value)} aria-label="Precio mínimo" />
      <span aria-hidden="true">–</span>
      <input className="input" type="number" min="0" inputMode="numeric" placeholder={rango?.max ? `Máx. ${Math.ceil(rango.max)}` : 'Máximo'}
        value={hasta} onChange={(e) => setHasta(e.target.value)} aria-label="Precio máximo" />
      <button type="submit" className="btn btn--oscuro btn--chico">Aplicar</button>
    </form>
  );
}

export default function Catalogo() {
  const [params, setParams] = useSearchParams();
  const { vehiculo, abrirSelector } = useVehiculo();
  const referencias = useReferencias();
  const [panelAbierto, setPanelAbierto] = useState(false);

  const filtros = Object.fromEntries(params);
  const ignorarVehiculo = filtros.todos === '1';
  const vehiculoActivo = vehiculo && !ignorarVehiculo ? vehiculo : null;
  const marcasElegidas = filtros.marca ? filtros.marca.split(',') : [];
  // "Ver repuestos" de un modelo (por ejemplo una moto sin versiones cargadas) o de una marca: manda sobre el vehículo elegido
  const porModelo = Boolean(filtros.modelo || filtros.marca_vehiculo);

  const consulta = {
    q: filtros.q, categoria: filtros.categoria, marca: filtros.marca, condicion: filtros.condicion,
    provincia: filtros.provincia, precio_min: filtros.precio_min, precio_max: filtros.precio_max,
    orden: filtros.orden || 'relevancia', pagina: filtros.pagina || 1, por_pagina: 24,
    vehiculo: porModelo ? undefined : vehiculoActivo?.id, tipo_pieza: filtros.tipo_pieza,
    modelo: filtros.modelo, marca_vehiculo: filtros.marca_vehiculo, anio: porModelo ? filtros.anio : undefined,
    rubro: filtros.rubro, codigo: filtros.codigo, sin_stock: filtros.sin_stock === '1' ? true : undefined,
    solo_verificados: vehiculoActivo && !porModelo && filtros.verificados === '1' ? true : undefined,
    // "pastillas hilux": el servidor detecta el vehículo en el texto, salvo que se pida buscar el texto literal
    detectar_vehiculo: filtros.literal === '1' ? false : undefined,
  };
  const { datos, error, cargando } = useApi('/productos', { query: consulta }, JSON.stringify(consulta));
  const facetas = datos?.facetas;
  const categoriaActual = datos?.categoria;
  const rutaCategoria = categoriaActual?.ruta || [];
  const categoriaPadre = rutaCategoria.length > 1 ? rutaCategoria[rutaCategoria.length - 2] : null;
  const detectado = datos?.vehiculo_detectado;
  const filtroVehiculo = datos?.filtro_vehiculo;
  // Si el texto nombra otro vehículo ("pastillas hilux" con un Gol elegido), la búsqueda no filtra por el elegido
  const vehiculoFiltro = detectado?.reemplaza_vehiculo || porModelo ? null : vehiculoActivo;
  const hojaActual = Boolean(categoriaActual && facetas?.categorias.some((c) => c.slug === categoriaActual.slug));
  const categoriaMotos = categoriaActual?.rubro === 'motos' ? categoriaActual : null;

  useTitulo(filtros.q ? `Resultados para "${filtros.q}"` : categoriaActual?.nombre || 'Catálogo');

  const cambiar = (cambios, { mantenerPagina = false } = {}) => {
    const nuevos = new URLSearchParams(params);
    for (const [k, v] of Object.entries(cambios)) {
      if (v === undefined || v === null || v === '') nuevos.delete(k);
      else nuevos.set(k, v);
    }
    if (!mantenerPagina) nuevos.delete('pagina');
    setParams(nuevos);
  };

  const alternarMarca = (m) => {
    const lista = marcasElegidas.includes(m) ? marcasElegidas.filter((x) => x !== m) : [...marcasElegidas, m];
    cambiar({ marca: lista.join(',') });
  };

  const chips = [];
  if (filtros.q) chips.push(['q', `"${filtros.q}"`]);
  if (categoriaActual) chips.push(['categoria', categoriaActual.nombre]);
  marcasElegidas.forEach((m) => chips.push([`marca:${m}`, m]));
  if (filtros.condicion) chips.push(['condicion', filtros.condicion === 'usado' ? 'Usados' : 'Nuevos']);
  if (filtros.provincia) chips.push(['provincia', filtros.provincia]);
  if (filtros.tipo_pieza) {
    chips.push(['tipo_pieza', referencias?.tipos_pieza.find((t) => t.valor === filtros.tipo_pieza)?.etiqueta || filtros.tipo_pieza]);
  }
  if (filtros.verificados === '1' && vehiculoActivo && !porModelo) chips.push(['verificados', 'Solo compatibilidad verificada']);
  if (filtros.rubro) chips.push(['rubro', referencias?.rubros?.find((r) => r.valor === filtros.rubro)?.etiqueta || filtros.rubro]);
  if (filtros.codigo) chips.push(['codigo', `Código ${filtros.codigo}`]);
  if (filtros.sin_stock === '1') chips.push(['sin_stock', 'Incluye sin stock']);
  if (filtros.precio_min || filtros.precio_max) {
    chips.push(['precio', `${filtros.precio_min ? precio(filtros.precio_min) : '$ 0'} – ${filtros.precio_max ? precio(filtros.precio_max) : 'sin tope'}`]);
  }
  const quitarChip = (clave) => {
    if (clave.startsWith('marca:')) alternarMarca(clave.slice(6));
    else if (clave === 'precio') cambiar({ precio_min: null, precio_max: null });
    else cambiar({ [clave]: null });
  };

  const titulo = filtros.q ? `Resultados para "${filtros.q}"` : categoriaActual?.nombre || 'Todos los repuestos';

  return (
    <div className="contenedor pagina catalogo">
      <nav className="migas" aria-label="Ubicación">
        <Link to="/">Inicio</Link><span aria-hidden="true">/</span>
        <Link to="/catalogo">Catálogo</Link>
        {rutaCategoria.map((c, i) => (
          <span key={c.slug} className="migas__item">
            <span aria-hidden="true">/</span>
            {i < rutaCategoria.length - 1
              ? <Link to={`/catalogo?categoria=${c.slug}`}>{c.nombre}</Link>
              : <span>{c.nombre}</span>}
          </span>
        ))}
      </nav>

      <div className="catalogo__cabecera">
        <div>
          <h1 className="catalogo__titulo">{titulo}</h1>
          <p className="texto-gris catalogo__conteo">
            {datos ? plural(datos.total, 'repuesto encontrado', 'repuestos encontrados') : 'Buscando…'}
            {vehiculoFiltro && <> · compatibles con tu <strong>{vehiculoFiltro.marca} {vehiculoFiltro.modelo} {vehiculoFiltro.anio}</strong></>}
          </p>
        </div>
        <div className="catalogo__orden">
          <button type="button" className="btn btn--chico catalogo__abrir-filtros" onClick={() => setPanelAbierto(true)}>
            <SlidersHorizontal size={16} /> Filtros
          </button>
          <label htmlFor="orden" className="texto-chico texto-gris">Ordenar por</label>
          <select id="orden" className="select" value={filtros.orden || 'relevancia'} onChange={(e) => cambiar({ orden: e.target.value })}>
            {ORDENES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </div>
      </div>

      {datos?.vehiculo_sin_resultados && (
        <div className="aviso-vehiculo aviso-vehiculo--detectado">
          <Sparkles size={18} aria-hidden="true" />
          <span>
            No hay repuestos cargados para <strong>{datos.vehiculo_sin_resultados.marca} {datos.vehiculo_sin_resultados.modelo}</strong>:
            te mostramos los resultados de “<strong>{filtros.q}</strong>”.
          </span>
          <button type="button" className="enlace"
            onClick={() => abrirSelector({ id: datos.vehiculo_sin_resultados.marca_id, nombre: datos.vehiculo_sin_resultados.marca })}>
            Elegir el vehículo exacto
          </button>
        </div>
      )}

      {detectado && (
        <div className="aviso-vehiculo aviso-vehiculo--detectado">
          <Sparkles size={18} aria-hidden="true" />
          <span>
            Buscamos {detectado.texto_restante ? <>“<strong>{detectado.texto_restante}</strong>” </> : 'repuestos '}
            para <strong>{detectado.marca}{detectado.modelo ? ` ${detectado.modelo}` : ''}{detectado.anio ? ` ${detectado.anio}` : ''}</strong>
            {detectado.modelo ? ' (todas sus versiones)' : ' (todos sus modelos)'}
            {detectado.reemplaza_vehiculo && vehiculo && <>, no para tu {vehiculo.modelo}</>}.
          </span>
          <button type="button" className="enlace" onClick={() => abrirSelector({ id: detectado.marca_id, nombre: detectado.marca })}>
            Elegir la versión exacta
          </button>
          <button type="button" className="enlace enlace--gris" onClick={() => cambiar({ literal: '1' })}>Buscar el texto tal cual</button>
        </div>
      )}

      {filtroVehiculo && (
        <div className="aviso-vehiculo aviso-vehiculo--detectado">
          {filtroVehiculo.segmento === 'moto' ? <Bike size={18} aria-hidden="true" /> : <Car size={18} aria-hidden="true" />}
          <span>
            Repuestos para <strong>{filtroVehiculo.marca}{filtroVehiculo.modelo ? ` ${filtroVehiculo.modelo}` : ''}{filtroVehiculo.anio ? ` ${filtroVehiculo.anio}` : ''}</strong>
            {filtroVehiculo.modelo ? ' (todas sus versiones)' : ' (todos sus modelos)'}, más los universales.
          </span>
          <button type="button" className="enlace" onClick={() => cambiar({ modelo: null, marca_vehiculo: null, anio: null })}>Quitar</button>
        </div>
      )}

      {vehiculo && !detectado?.reemplaza_vehiculo && !porModelo && (
        <div className={`aviso-vehiculo ${ignorarVehiculo ? 'aviso-vehiculo--apagado' : ''}`}>
          <Car size={18} aria-hidden="true" />
          {ignorarVehiculo
            ? <span>Estás viendo <strong>todo el catálogo</strong>, sin filtrar por tu {vehiculo.modelo}.</span>
            : <span>Solo repuestos que le sirven a tu <strong>{vehiculo.marca} {vehiculo.modelo} {vehiculo.anio} · {vehiculo.version}</strong> (incluye universales).</span>}
          <button type="button" className="enlace" onClick={() => cambiar({ todos: ignorarVehiculo ? null : '1' })}>
            {ignorarVehiculo ? 'Filtrar por mi vehículo' : 'Ver todo el catálogo'}
          </button>
        </div>
      )}

      {chips.length > 0 && (
        <div className="chips catalogo__chips">
          {chips.map(([clave, texto]) => (
            <button key={clave} type="button" className="chip" onClick={() => quitarChip(clave)} aria-label={`Quitar filtro ${texto}`}>
              {texto} <X size={14} />
            </button>
          ))}
          <button type="button" className="enlace texto-chico" onClick={() => setParams(ignorarVehiculo ? { todos: '1' } : {})}>Limpiar filtros</button>
        </div>
      )}

      {categoriaMotos && <ExplorarMotos categoria={categoriaMotos} />}

      <div className="catalogo__cuerpo">
        <aside className={`filtros ${panelAbierto ? 'filtros--abierto' : ''}`} aria-label="Filtros">
          <div className="filtros__cabecera-movil">
            <strong>Filtros</strong>
            <button type="button" className="btn-icono" onClick={() => setPanelAbierto(false)} aria-label="Cerrar filtros"><X size={18} /></button>
          </div>
          {!vehiculo && (
            <button type="button" className="filtros__vehiculo" onClick={() => abrirSelector()}>
              <Car size={20} />
              <span><strong>Elegí tu vehículo</strong><small>y filtramos por compatibilidad</small></span>
            </button>
          )}
          {facetas && (
            <>
              {vehiculoActivo && !porModelo && (
                <Grupo titulo="Compatibilidad">
                  <label className="check">
                    <input type="checkbox" checked={filtros.verificados === '1'} onChange={(e) => cambiar({ verificados: e.target.checked ? '1' : null })} />
                    <span><ShieldCheck size={15} aria-hidden="true" /> Solo verificada con una fuente</span>
                  </label>
                </Grupo>
              )}
              <Grupo titulo="Categoría">
                <ul className="filtros__lista">
                  {categoriaActual && (
                    <li>
                      <button type="button" className="filtros__subir" onClick={() => cambiar({ categoria: categoriaPadre?.slug || null })}>
                        <ArrowLeft size={14} aria-hidden="true" /> {categoriaPadre ? categoriaPadre.nombre : 'Todas las categorías'}
                      </button>
                    </li>
                  )}
                  {/* Con subcategorías se muestran debajo de la actual; en una hoja, sus hermanas al mismo nivel */}
                  {categoriaActual && !hojaActual && (
                    <li><button type="button" className="activo" onClick={() => cambiar({ categoria: categoriaActual.slug })}>{categoriaActual.nombre}</button></li>
                  )}
                  {facetas.categorias.map((c) => (
                    <li key={c.slug} className={categoriaActual && !hojaActual ? 'filtros__hija' : ''}>
                      <button type="button" className={filtros.categoria === c.slug ? 'activo' : ''}
                        onClick={() => cambiar({ categoria: c.slug })}>
                        {c.nombre} <span>{c.cantidad}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Grupo>
              {referencias?.rubros && (
                <Grupo titulo="Rubro">
                  <div className="chips">
                    <button type="button" className={`chip ${!filtros.rubro ? 'activo' : ''}`} onClick={() => cambiar({ rubro: null })}>Todos</button>
                    {referencias.rubros.filter((r) => r.valor !== 'general').map((r) => (
                      <button key={r.valor} type="button" className={`chip ${filtros.rubro === r.valor ? 'activo' : ''}`}
                        onClick={() => cambiar({ rubro: r.valor })}>{r.etiqueta}</button>
                    ))}
                  </div>
                </Grupo>
              )}
              <Grupo titulo="Marca del repuesto">
                <div className="filtros__marcas">
                  {facetas.marcas.map((m) => (
                    <label key={m.marca} className="check">
                      <input type="checkbox" checked={marcasElegidas.includes(m.marca)} onChange={() => alternarMarca(m.marca)} />
                      <span>{m.marca} <small className="texto-gris">({m.cantidad})</small></span>
                    </label>
                  ))}
                </div>
              </Grupo>
              {referencias && (
                <Grupo titulo="Tipo de pieza">
                  <select className="select" value={filtros.tipo_pieza || ''} onChange={(e) => cambiar({ tipo_pieza: e.target.value })} aria-label="Tipo de pieza">
                    <option value="">Todos los tipos</option>
                    {referencias.tipos_pieza.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
                  </select>
                </Grupo>
              )}
              <Grupo titulo="Condición">
                <div className="chips">
                  <button type="button" className={`chip ${!filtros.condicion ? 'activo' : ''}`} onClick={() => cambiar({ condicion: null })}>Todas</button>
                  {facetas.condiciones.map((c) => (
                    <button key={c.condicion} type="button" className={`chip ${filtros.condicion === c.condicion ? 'activo' : ''}`}
                      onClick={() => cambiar({ condicion: c.condicion })}>
                      {c.condicion === 'usado' ? 'Usado' : 'Nuevo'} <span className="chip__contador">{c.cantidad}</span>
                    </button>
                  ))}
                </div>
              </Grupo>
              <Grupo titulo="Provincia del vendedor">
                <select className="select" value={filtros.provincia || ''} onChange={(e) => cambiar({ provincia: e.target.value })}
                  aria-label="Provincia del vendedor">
                  <option value="">Todas las provincias</option>
                  {facetas.provincias.map((p) => <option key={p.provincia} value={p.provincia}>{p.provincia} ({p.cantidad})</option>)}
                </select>
              </Grupo>
              <Grupo titulo="N° de parte, OEM o EAN">
                <FiltroCodigo valor={filtros.codigo} alAplicar={(codigo) => cambiar({ codigo })} />
              </Grupo>
              <Grupo titulo="Stock">
                <label className="check">
                  <input type="checkbox" checked={filtros.sin_stock === '1'} onChange={(e) => cambiar({ sin_stock: e.target.checked ? '1' : null })} />
                  <span>Incluir publicaciones sin stock</span>
                </label>
              </Grupo>
              <Grupo titulo="Precio">
                <FiltroPrecio min={filtros.precio_min} max={filtros.precio_max} rango={facetas.precio}
                  alAplicar={(desde, hasta) => cambiar({ precio_min: desde, precio_max: hasta })} />
              </Grupo>
            </>
          )}
          <button type="button" className="btn btn--primario btn--bloque filtros__ver" onClick={() => setPanelAbierto(false)}>
            Ver {datos ? plural(datos.total, 'resultado', 'resultados') : 'resultados'}
          </button>
        </aside>
        {panelAbierto && <div className="filtros__fondo" onClick={() => setPanelAbierto(false)} aria-hidden="true" />}

        <section className="catalogo__resultados" aria-live="polite">
          {error && <ErrorMensaje error={error} />}
          {cargando && !datos && <Cargando texto="Buscando repuestos…" />}
          {datos && datos.productos.length === 0 && categoriaMotos && chips.length <= 1 && (
            <Vacio titulo={`Todavía no hay repuestos publicados en ${categoriaMotos.nombre}`}>
              Arriba ves qué marcas los fabrican. Los repuestos aparecen acá cuando una casa de
              repuestos publica su catálogo con el número de parte, el precio y las motos compatibles.
            </Vacio>
          )}
          {datos && datos.productos.length === 0 && !(categoriaMotos && chips.length <= 1) && (
            <Vacio titulo="No encontramos repuestos con esos filtros"
              accion={<>
                {chips.length > 0 && <button type="button" className="btn" onClick={() => setParams({})}>Limpiar filtros</button>}
                {vehiculoActivo && !porModelo && <button type="button" className="btn btn--oscuro" onClick={() => cambiar({ todos: '1' })}>Ver todo el catálogo</button>}
                {porModelo && <button type="button" className="btn btn--oscuro" onClick={() => cambiar({ modelo: null, marca_vehiculo: null, anio: null })}>Ver todo el catálogo</button>}
              </>}>
              Probá con otra búsqueda o quitá algún filtro.
              {vehiculoActivo && !porModelo && <> También podés buscar fuera de los compatibles con tu {vehiculoActivo.modelo}.</>}
              {filtroVehiculo?.segmento === 'moto' && <> Todavía no hay repuestos con compatibilidad cargada para esta moto: se agregan importando catálogos de proveedores.</>}
            </Vacio>
          )}
          {datos && datos.productos.length > 0 && (
            <div className={`grilla-productos ${cargando ? 'cargando-suave' : ''}`}>
              {datos.productos.map((p) => <TarjetaProducto key={p.id} producto={p} vehiculo={vehiculoFiltro} />)}
            </div>
          )}
          {datos && (
            <Paginacion pagina={datos.pagina} paginas={datos.paginas}
              alCambiar={(n) => { cambiar({ pagina: n }, { mantenerPagina: true }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
          )}
        </section>
      </div>
    </div>
  );
}

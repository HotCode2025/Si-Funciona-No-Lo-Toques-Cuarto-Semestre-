import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Camera, ImagePlus, Pause, Play, Plus, Save, Tag, Trash2, Upload, X } from 'lucide-react';
import Modal from '../../components/Modal.jsx';
import { Cargando, ErrorMensaje, Vacio } from '../../components/Estados.jsx';
import { CodigoPieza, EtiquetaCondicion } from '../../components/Producto.jsx';
import { useAvisos } from '../../context/AvisosContext.jsx';
import { api } from '../../lib/api.js';
import { useApi, useCategorias, useReferencias, useTitulo } from '../../lib/hooks.js';
import { imagen, precio } from '../../lib/formato.js';

// Fotos de cada publicación: las mismas reglas que valida el servidor
const MAX_FOTOS = 6;
const MAX_MB = 8;
const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_DESCRIPCION = 2000;

/** Sube fotos elegidas a una publicación propia y devuelve la publicación actualizada. */
function subirFotos(publicacionId, archivos) {
  const datos = new FormData();
  for (const a of archivos) datos.append('fotos', a, a.name);
  return api(`/vendedor/publicaciones/${publicacionId}/fotos`, { method: 'POST', body: datos });
}

/** Fotos elegidas en la compu o el celular, todavía sin subir: valida tipo y peso y muestra la vista previa. */
function ElegirFotos({ id, archivos, setArchivos, lugar }) {
  const [aviso, setAviso] = useState(null);
  const vistas = useMemo(() => archivos.map((a) => URL.createObjectURL(a)), [archivos]);
  useEffect(() => () => vistas.forEach((u) => URL.revokeObjectURL(u)), [vistas]);

  const agregar = (lista) => {
    const validos = [];
    const problemas = [];
    for (const archivo of lista) {
      if (!TIPOS_FOTO.includes(archivo.type)) problemas.push(`"${archivo.name}" no es JPG, PNG ni WebP.`);
      else if (archivo.size > MAX_MB * 1024 * 1024) problemas.push(`"${archivo.name}" pesa más de ${MAX_MB} MB.`);
      else validos.push(archivo);
    }
    const quedan = Math.max(lugar - archivos.length, 0);
    if (validos.length > quedan) problemas.push(`Entran ${quedan === 1 ? '1 foto más' : `${quedan} fotos más`} (máximo ${MAX_FOTOS} por publicación).`);
    setArchivos([...archivos, ...validos.slice(0, quedan)]);
    setAviso(problemas.length ? problemas.join(' ') : null);
  };

  return (
    <div className="elegir-fotos">
      <div className="elegir-fotos__grilla">
        {archivos.map((a, i) => (
          <figure key={vistas[i]} className="foto-miniatura">
            <img src={vistas[i]} alt={`Foto nueva ${i + 1}`} />
            <button type="button" className="foto-miniatura__quitar" aria-label={`Quitar ${a.name}`}
              onClick={() => setArchivos(archivos.filter((_, j) => j !== i))}><X size={14} /></button>
          </figure>
        ))}
        {archivos.length < lugar && (
          <label className="elegir-fotos__agregar" htmlFor={id}>
            <ImagePlus size={22} aria-hidden="true" />
            <span>Agregar fotos</span>
            <input id={id} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only"
              onChange={(e) => { agregar([...e.target.files]); e.target.value = ''; }} />
          </label>
        )}
      </div>
      {aviso && <span className="campo__error">{aviso}</span>}
    </div>
  );
}

/** Fotos y descripción de una publicación ya creada: subir, borrar y editar el texto. */
function FotosYDescripcion({ pub, alGuardar, alCerrar }) {
  const { avisar } = useAvisos();
  const [nuevas, setNuevas] = useState([]);
  const [descripcion, setDescripcion] = useState(pub.descripcion || '');
  const [ocupado, setOcupado] = useState(null);
  const [error, setError] = useState(null);
  const lugar = MAX_FOTOS - pub.fotos.length;

  const ejecutar = async (que, accion, mensaje) => {
    setOcupado(que);
    setError(null);
    try {
      alGuardar(await accion());
      avisar(mensaje);
      return true;
    } catch (err) {
      setError(err);
      return false;
    } finally {
      setOcupado(null);
    }
  };

  const subir = async () => {
    if (await ejecutar('subir', () => subirFotos(pub.id, nuevas), nuevas.length === 1 ? 'Foto subida.' : 'Fotos subidas.')) setNuevas([]);
  };
  const borrar = (foto) => {
    if (!window.confirm('¿Borrar esta foto de tu publicación?')) return;
    ejecutar(foto.id, () => api(`/vendedor/publicaciones/${pub.id}/fotos/${foto.id}`, { method: 'DELETE' }), 'Foto borrada.');
  };
  const guardarDescripcion = () => ejecutar('descripcion',
    () => api(`/vendedor/publicaciones/${pub.id}/descripcion`, { method: 'PUT', body: { descripcion } }),
    descripcion.trim() ? 'Descripción guardada.' : 'Descripción borrada.');

  return (
    <Modal abierto alCerrar={alCerrar} titulo="Fotos y descripción" ancho={760}>
      <div className="pila">
        <p className="texto-chico texto-gris">
          {pub.producto.nombre} · {pub.producto.marca} {pub.producto.numero_pieza} · {pub.condicion === 'usado' ? 'Usado' : 'Nuevo'}
        </p>

        <section className="pila pila--chica">
          <h3 className="titulo-seccion titulo-seccion--chico">Fotos de tu publicación ({pub.fotos.length} de {MAX_FOTOS})</h3>
          {pub.fotos.length > 0 ? (
            <div className="elegir-fotos__grilla">
              {pub.fotos.map((f, i) => (
                <figure key={f.id} className="foto-miniatura">
                  <img src={imagen(f.url)} alt={`Foto ${i + 1}`} loading="lazy" />
                  {i === 0 && <span className="foto-miniatura__principal">Principal</span>}
                  <button type="button" className="foto-miniatura__quitar" aria-label={`Borrar la foto ${i + 1}`}
                    disabled={ocupado !== null} onClick={() => borrar(f)}><Trash2 size={14} /></button>
                </figure>
              ))}
            </div>
          ) : (
            <p className="alerta alerta--info texto-chico">Todavía no tiene fotos. Las publicaciones con fotos propias venden más, sobre todo los usados.</p>
          )}
          {lugar > 0 ? (
            <>
              <ElegirFotos id="fotos-publicacion" archivos={nuevas} setArchivos={setNuevas} lugar={lugar} />
              <small className="texto-gris">JPG, PNG o WebP de hasta {MAX_MB} MB. Las achicamos y optimizamos al subirlas.</small>
              {nuevas.length > 0 && (
                <div>
                  <button type="button" className="btn btn--oscuro btn--chico" disabled={ocupado !== null} onClick={subir}>
                    <Upload size={15} /> {ocupado === 'subir' ? 'Subiendo…' : `Subir ${nuevas.length === 1 ? 'la foto' : `${nuevas.length} fotos`}`}
                  </button>
                </div>
              )}
            </>
          ) : (
            <small className="texto-gris">Llegaste al máximo de {MAX_FOTOS} fotos. Borrá alguna para subir otra.</small>
          )}
        </section>

        <section className="pila pila--chica">
          <h3 className="titulo-seccion titulo-seccion--chico">Descripción</h3>
          <textarea className="textarea" rows={5} maxLength={MAX_DESCRIPCION} value={descripcion} aria-label="Descripción de tu publicación"
            placeholder="Estado de la pieza, qué incluye, garantía. En los usados: de qué vehículo salió, kilometraje y marcas de uso."
            onChange={(e) => setDescripcion(e.target.value)} />
          <div className="fila fila--entre">
            <small className="texto-gris">{descripcion.length} / {MAX_DESCRIPCION}</small>
            <button type="button" className="btn btn--oscuro btn--chico" onClick={guardarDescripcion}
              disabled={ocupado !== null || descripcion.trim() === (pub.descripcion || '')}>
              <Save size={15} /> {ocupado === 'descripcion' ? 'Guardando…' : 'Guardar descripción'}
            </button>
          </div>
        </section>

        <p className="texto-chico texto-gris">
          Las fotos y la descripción son de tu publicación: los compradores las ven en tu oferta, dentro de la ficha del repuesto.
        </p>
        <ErrorMensaje error={error} />
        <div className="fila fila--fin">
          <button type="button" className="btn" onClick={alCerrar}>Listo</button>
        </div>
      </div>
    </Modal>
  );
}

function FilaPublicacion({ pub, alGuardar, alEditarFotos }) {
  const { avisar } = useAvisos();
  const [valores, setValores] = useState({ precio: String(pub.precio), stock: String(pub.stock) });
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => setValores({ precio: String(pub.precio), stock: String(pub.stock) }), [pub.precio, pub.stock]);

  const cambiado = Number(valores.precio) !== pub.precio || Number(valores.stock) !== pub.stock;
  const fotos = pub.fotos || [];

  const guardar = async (extra = {}) => {
    const cuerpo = { ...extra };
    if (!('estado' in extra)) {
      const p = Number(valores.precio);
      const s = Number(valores.stock);
      if (!(p > 0)) return setError({ message: 'El precio tiene que ser mayor a 0.' });
      if (!Number.isInteger(s) || s < 0) return setError({ message: 'El stock tiene que ser un número entero, 0 o más.' });
      if (p !== pub.precio) cuerpo.precio = p;
      if (s !== pub.stock) cuerpo.stock = s;
    }
    setOcupado(true);
    setError(null);
    try {
      const actualizada = await api(`/vendedor/publicaciones/${pub.id}`, { method: 'PATCH', body: cuerpo });
      alGuardar(actualizada);
      avisar('estado' in extra ? (extra.estado === 'pausada' ? 'Publicación pausada.' : 'Publicación activa de nuevo.') : 'Cambios guardados.');
    } catch (err) {
      setError(err);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <tr className={pub.estado === 'pausada' ? 'publicacion--pausada' : ''}>
      <td data-titulo="Producto">
        <div className="publicacion__producto">
          <img src={imagen(fotos[0]?.url || pub.producto.imagen)} alt="" />
          <div>
            <Link to={`/producto/${pub.producto.id}`} className="publicacion__nombre">{pub.producto.nombre}</Link>
            <div className="fila fila--envolver">
              <span className="texto-mini texto-gris">{pub.producto.marca}</span>
              <CodigoPieza codigo={pub.producto.numero_pieza} />
              <EtiquetaCondicion condicion={pub.condicion} />
            </div>
            {fotos.length === 0 && (
              <button type="button" className="enlace texto-mini publicacion__sin-fotos" onClick={alEditarFotos}>
                <Camera size={13} /> Sin fotos propias · agregalas
              </button>
            )}
            {pub.competidores > 0 && (
              <span className="texto-mini texto-gris">
                {pub.competidores} vendedor(es) más{pub.mejor_precio_competencia ? ` · mejor precio de la competencia ${precio(pub.mejor_precio_competencia)}` : ''}
              </span>
            )}
          </div>
        </div>
        {error && <span className="campo__error">{error.message}</span>}
      </td>
      <td data-titulo="Precio">
        <div className="input-pesos">
          <span>$</span>
          <input className="input" type="number" min="1" step="1" value={valores.precio} aria-label="Precio"
            onChange={(e) => setValores((v) => ({ ...v, precio: e.target.value }))} />
        </div>
      </td>
      <td data-titulo="Stock">
        <input className="input input--stock" type="number" min="0" step="1" value={valores.stock} aria-label="Stock"
          aria-invalid={pub.stock === 0 ? 'true' : undefined}
          onChange={(e) => setValores((v) => ({ ...v, stock: e.target.value }))} />
      </td>
      <td data-titulo="Estado">
        <span className={`estado ${pub.estado === 'activa' ? (pub.stock === 0 ? 'estado--rojo' : 'estado--verde') : 'estado--gris'}`}>
          {pub.estado === 'pausada' ? 'Pausada' : pub.stock === 0 ? 'Sin stock' : 'Activa'}
        </span>
      </td>
      <td className="publicacion__acciones">
        <button type="button" className="btn btn--oscuro btn--chico" disabled={!cambiado || ocupado} onClick={() => guardar()}>
          <Save size={15} /> Guardar
        </button>
        <button type="button" className="btn btn--chico" onClick={alEditarFotos}>
          <Camera size={15} /> Fotos{fotos.length ? ` (${fotos.length})` : ''}
        </button>
        {pub.estado === 'activa' ? (
          <button type="button" className="btn btn--chico" disabled={ocupado} onClick={() => guardar({ estado: 'pausada' })}><Pause size={15} /> Pausar</button>
        ) : (
          <button type="button" className="btn btn--chico" disabled={ocupado} onClick={() => guardar({ estado: 'activa' })}><Play size={15} /> Reactivar</button>
        )}
      </td>
    </tr>
  );
}

/** Categorías hoja agrupadas por su categoría principal, con la ruta intermedia ("Filtros > Filtro de aceite"). */
function agruparHojas(categorias) {
  const porId = new Map(categorias.map((c) => [c.id, c]));
  const tieneHijas = new Set(categorias.map((c) => c.padre_id).filter(Boolean));
  const grupos = new Map();
  for (const c of categorias) {
    if (tieneHijas.has(c.id) || !c.padre_id) continue;
    const ruta = [c];
    let actual = c;
    while (actual.padre_id) {
      actual = porId.get(actual.padre_id);
      ruta.unshift(actual);
    }
    const [raiz, ...resto] = ruta;
    if (!grupos.has(raiz.id)) grupos.set(raiz.id, { raiz, hojas: [] });
    grupos.get(raiz.id).hojas.push({ id: c.id, ruta: resto.map((x) => x.nombre).join(' › ') });
  }
  return [...grupos.values()];
}

function SelectorCompatibles({ seleccion, setSeleccion }) {
  const marcas = useApi('/vehiculos/marcas');
  const [marcaId, setMarcaId] = useState('');
  const [modeloId, setModeloId] = useState('');
  const [anio, setAnio] = useState('');
  const modelos = useApi(marcaId ? `/vehiculos/marcas/${marcaId}/modelos` : null);
  const anios = useApi(modeloId ? `/vehiculos/modelos/${modeloId}/anios` : null);
  const versiones = useApi(modeloId && anio ? `/vehiculos/modelos/${modeloId}/versiones?anio=${anio}` : null);
  const marca = marcas.datos?.find((m) => String(m.id) === marcaId);
  const modelo = modelos.datos?.find((m) => String(m.id) === modeloId);

  const alternar = (v) => setSeleccion((s) => (s.some((x) => x.id === v.id)
    ? s.filter((x) => x.id !== v.id)
    : [...s, { id: v.id, texto: `${marca.nombre} ${modelo.nombre} ${v.version} (${v.anio_desde}-${v.anio_hasta || 'hoy'})` }]));

  return (
    <div className="selector-compatibles">
      <div className="grilla-form">
        <div className="campo">
          <label htmlFor="compat-marca">Marca</label>
          <select id="compat-marca" className="select" value={marcaId} onChange={(e) => { setMarcaId(e.target.value); setModeloId(''); setAnio(''); }}>
            <option value="">Elegí…</option>
            {marcas.datos?.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="compat-modelo">Modelo</label>
          <select id="compat-modelo" className="select" value={modeloId} onChange={(e) => { setModeloId(e.target.value); setAnio(''); }} disabled={!marcaId}>
            <option value="">Elegí…</option>
            {modelos.datos?.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="compat-anio">Año</label>
          <select id="compat-anio" className="select" value={anio} onChange={(e) => setAnio(e.target.value)} disabled={!modeloId}>
            <option value="">Elegí…</option>
            {anios.datos?.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>
      {versiones.datos && (
        <div className="selector-compatibles__versiones">
          {versiones.datos.map((v) => (
            <label key={v.id} className="check">
              <input type="checkbox" checked={seleccion.some((x) => x.id === v.id)} onChange={() => alternar(v)} />
              <span>{v.version} <small className="texto-gris">{v.motor ? `· ${v.motor} ` : ''}· {v.anio_desde}-{v.anio_hasta || 'hoy'}</small></span>
            </label>
          ))}
        </div>
      )}
      {seleccion.length > 0 && (
        <div className="chips">
          {seleccion.map((v) => (
            <button key={v.id} type="button" className="chip" onClick={() => setSeleccion((s) => s.filter((x) => x.id !== v.id))}>{v.texto} <X size={13} /></button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Alta de un repuesto del local. El vendedor no ve el catálogo de nadie: carga su repuesto con sus datos, sus fotos y su
 * descripción. Si otra casa ya vende la misma pieza (misma marca y número), la publicación se suma a esa ficha y el
 * comprador compara precios; las fotos y la descripción siguen siendo de cada local.
 */
function NuevaPublicacion({ alCrear, alCerrar }) {
  const { avisar } = useAvisos();
  const categorias = useCategorias();
  const referencias = useReferencias();
  const [oferta, setOferta] = useState({ precio: '', stock: '1', condicion: 'nuevo' });
  const [nuevo, setNuevo] = useState({ nombre: '', marca: '', numero_pieza: '', tipo_pieza: '', ean: '', categoria_id: '', descripcion: '', universal: false });
  // Solo se publica en la subcategoría más específica, agrupada por categoría principal
  const grupos = useMemo(() => agruparHojas(categorias), [categorias]);
  const [compatibles, setCompatibles] = useState([]);
  const [fotos, setFotos] = useState([]);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const crear = async (e) => {
    e.preventDefault();
    setError(null);
    const precioNum = Number(oferta.precio);
    const stockNum = Number(oferta.stock);
    if (!(precioNum > 0)) return setError({ message: 'Ingresá un precio mayor a 0.' });
    if (!Number.isInteger(stockNum) || stockNum < 0) return setError({ message: 'El stock tiene que ser un número entero.' });
    if (!nuevo.universal && compatibles.length === 0) return setError({ message: 'Indicá al menos un vehículo compatible o marcalo como universal.' });
    setEnviando(true);
    let creada;
    try {
      creada = await api('/vendedor/productos', {
        method: 'POST',
        body: {
          ...nuevo, categoria_id: Number(nuevo.categoria_id) || undefined, tipo_pieza: nuevo.tipo_pieza || undefined, ean: nuevo.ean || undefined,
          descripcion: nuevo.descripcion.trim() || undefined,
          vehiculo_ids: nuevo.universal ? undefined : compatibles.map((v) => v.id),
          precio: precioNum, stock: stockNum, condicion: oferta.condicion,
        },
      });
    } catch (err) {
      setError(err);
      setEnviando(false);
      return undefined;
    }
    // Las fotos se suben una vez creada la publicación; si fallan, la publicación queda y se pueden subir desde la lista
    let errorFotos = null;
    if (fotos.length) {
      try {
        creada = { ...await subirFotos(creada.id, fotos), unida_a_existente: creada.unida_a_existente };
      } catch (err) {
        errorFotos = err;
      }
    }
    if (errorFotos) avisar(`La publicación se creó, pero no pudimos subir las fotos: ${errorFotos.message} Subilas desde "Fotos".`, 'error', 8000);
    else if (creada.unida_a_existente) avisar('Publicación creada. Esa pieza ya la vende otra casa: los compradores van a comparar tu precio en la misma ficha.', 'exito', 6500);
    else avisar('Publicación creada.');
    return alCrear(creada);
  };

  return (
    <Modal abierto alCerrar={alCerrar} titulo="Nueva publicación" ancho={820}>
      <form onSubmit={crear} className="pila">
        <div className="grilla-form">
          <div className="campo ancho-total"><label htmlFor="np-nombre">Nombre</label><input id="np-nombre" className="input" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="Pastillas de freno delanteras VW Gol Trend" autoFocus /></div>
          <div className="campo"><label htmlFor="np-marca">Marca del repuesto</label><input id="np-marca" className="input" value={nuevo.marca} onChange={(e) => setNuevo({ ...nuevo, marca: e.target.value })} placeholder="Bosch" /></div>
          <div className="campo"><label htmlFor="np-codigo">Número de pieza del fabricante</label><input id="np-codigo" className="input" value={nuevo.numero_pieza} onChange={(e) => setNuevo({ ...nuevo, numero_pieza: e.target.value })} placeholder="Como figura en la caja" /></div>
          <div className="campo"><label htmlFor="np-cat">Categoría</label>
            <select id="np-cat" className="select" value={nuevo.categoria_id} onChange={(e) => setNuevo({ ...nuevo, categoria_id: e.target.value })}>
              <option value="">Elegí…</option>
              {grupos.map((g) => (
                <optgroup key={g.raiz.id} label={g.raiz.nombre}>
                  {g.hojas.map((h) => <option key={h.id} value={h.id}>{h.ruta}</option>)}
                </optgroup>
              ))}
            </select></div>
          <div className="campo"><label htmlFor="np-tipo">Tipo de pieza</label>
            <select id="np-tipo" className="select" value={nuevo.tipo_pieza} onChange={(e) => setNuevo({ ...nuevo, tipo_pieza: e.target.value })}>
              <option value="">Según la condición</option>
              {referencias?.tipos_pieza.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
            </select></div>
          <div className="campo"><label htmlFor="np-ean">EAN <small className="texto-gris">(opcional)</small></label><input id="np-ean" className="input" inputMode="numeric" value={nuevo.ean} onChange={(e) => setNuevo({ ...nuevo, ean: e.target.value })} placeholder="Código de barras" /></div>
          <div className="campo"><span className="campo__etiqueta">Compatibilidad</span>
            <label className="check"><input type="checkbox" checked={nuevo.universal} onChange={(e) => setNuevo({ ...nuevo, universal: e.target.checked })} /> Es universal (sirve para cualquier vehículo)</label></div>
          {!nuevo.universal && <div className="ancho-total"><span className="campo__etiqueta">Vehículos compatibles</span><SelectorCompatibles seleccion={compatibles} setSeleccion={setCompatibles} /></div>}
          <div className="campo ancho-total">
            <span className="campo__etiqueta">Fotos <small className="texto-gris">(hasta {MAX_FOTOS}, JPG, PNG o WebP de hasta {MAX_MB} MB; la primera es la principal)</small></span>
            <ElegirFotos id="np-fotos" archivos={fotos} setArchivos={setFotos} lugar={MAX_FOTOS} />
          </div>
          <div className="campo ancho-total"><label htmlFor="np-desc">Descripción <small className="texto-gris">(opcional)</small></label>
            <textarea id="np-desc" className="textarea" maxLength={MAX_DESCRIPCION} value={nuevo.descripcion} onChange={(e) => setNuevo({ ...nuevo, descripcion: e.target.value })}
              placeholder="Estado de la pieza, qué incluye, garantía. En los usados: de qué vehículo salió, kilometraje y marcas de uso." /></div>
        </div>

        <fieldset className="nueva-publicacion__oferta">
          <legend>Tu oferta</legend>
          <div className="grilla-form grilla-form--3">
            <div className="campo"><label htmlFor="np-precio">Precio (ARS)</label><input id="np-precio" className="input" type="number" min="1" value={oferta.precio} onChange={(e) => setOferta({ ...oferta, precio: e.target.value })} /></div>
            <div className="campo"><label htmlFor="np-stock">Stock</label><input id="np-stock" className="input" type="number" min="0" value={oferta.stock} onChange={(e) => setOferta({ ...oferta, stock: e.target.value })} /></div>
            <div className="campo"><label htmlFor="np-cond">Condición</label>
              <select id="np-cond" className="select" value={oferta.condicion} onChange={(e) => setOferta({ ...oferta, condicion: e.target.value })}>
                <option value="nuevo">Nuevo</option><option value="usado">Usado</option>
              </select></div>
          </div>
        </fieldset>

        <div className="alerta alerta--info texto-chico">
          <span>
            Si otra casa ya vende la misma pieza (misma marca y número de pieza), tu publicación aparece en la misma ficha para que el
            comprador compare precios. Tus fotos, tu descripción, tu precio y tu stock son solo tuyos. El repuesto y las
            compatibilidades que cargues quedan <strong>sin verificar</strong> hasta que el equipo de AUTONEX los revise.
          </span>
        </div>
        <ErrorMensaje error={error} />
        <div className="fila fila--entre">
          <button type="button" className="btn" onClick={alCerrar}>Cancelar</button>
          <button type="submit" className="btn btn--primario" disabled={enviando}>
            <Plus size={18} /> {enviando ? (fotos.length ? 'Publicando y subiendo fotos…' : 'Publicando…') : 'Publicar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function PanelPublicaciones() {
  useTitulo('Mis publicaciones');
  const [params, setParams] = useSearchParams();
  const estado = params.get('estado') || 'todas';
  const [texto, setTexto] = useState('');
  const [q, setQ] = useState('');
  const [creando, setCreando] = useState(false);
  const [fotosDe, setFotosDe] = useState(null);
  const { datos, error, cargando, setDatos } = useApi('/vendedor/publicaciones', { query: { estado, q } }, `${estado}|${q}`);

  useEffect(() => {
    const t = setTimeout(() => setQ(texto.trim()), 350);
    return () => clearTimeout(t);
  }, [texto]);

  const actualizar = (pub) => setDatos((lista) => lista.map((p) => (p.id === pub.id ? pub : p)));
  const pubFotos = fotosDe && datos?.find((p) => p.id === fotosDe);

  return (
    <div>
      <div className="fila fila--entre fila--envolver panel__barra">
        <div className="chips">
          {[['todas', 'Todas'], ['activa', 'Activas'], ['pausada', 'Pausadas'], ['sin_stock', 'Sin stock']].map(([v, t]) => (
            <button key={v} type="button" className={`chip ${estado === v ? 'activo' : ''}`} onClick={() => setParams({ estado: v })}>{t}</button>
          ))}
        </div>
        <div className="fila">
          <input className="input" type="search" placeholder="Buscar en mis publicaciones…" value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Buscar en mis publicaciones" />
          <button type="button" className="btn btn--primario" onClick={() => setCreando(true)}><Plus size={18} /> Nueva</button>
        </div>
      </div>
      {cargando && !datos && <Cargando />}
      <ErrorMensaje error={error} />
      {datos?.length === 0 && <Vacio icono={Tag} titulo="No hay publicaciones en esta vista" accion={<button type="button" className="btn btn--primario" onClick={() => setCreando(true)}>Publicar un repuesto</button>} />}
      {datos?.length > 0 && (
        <div className="tarjeta tabla-publicaciones-contenedor">
          <table className="tabla-publicaciones">
            <thead><tr><th>Producto</th><th>Precio</th><th>Stock</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead>
            <tbody>{datos.map((p) => <FilaPublicacion key={p.id} pub={p} alGuardar={actualizar} alEditarFotos={() => setFotosDe(p.id)} />)}</tbody>
          </table>
        </div>
      )}
      {datos && <p className="texto-chico texto-gris">{datos.length} publicaciones de tu local. Las pausadas no se muestran en el catálogo.</p>}
      {pubFotos && <FotosYDescripcion pub={pubFotos} alGuardar={actualizar} alCerrar={() => setFotosDe(null)} />}
      {creando && (
        <NuevaPublicacion alCerrar={() => setCreando(false)} alCrear={(pub) => { setCreando(false); setDatos((l) => [pub, ...(l || [])]); }} />
      )}
    </div>
  );
}

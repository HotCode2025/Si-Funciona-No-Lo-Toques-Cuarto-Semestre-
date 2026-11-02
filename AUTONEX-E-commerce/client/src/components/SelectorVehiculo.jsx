import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Fuel, Search, Settings2 } from 'lucide-react';
import Modal from './Modal.jsx';
import MarcaLogo from './MarcaLogo.jsx';
import { Cargando, ErrorMensaje } from './Estados.jsx';
import { useVehiculo } from '../context/VehiculoContext.jsx';
import { useAvisos } from '../context/AvisosContext.jsx';
import { etiquetaDe, useApi, useReferencias } from '../lib/hooks.js';
import { imagen, normalizar } from '../lib/formato.js';

const MARCAS_DESTACADAS = 18;

/** Filtra una lista por texto sin distinguir tildes ni mayúsculas. */
function filtrar(lista, texto, campo = 'nombre') {
  const t = normalizar(texto);
  return t ? lista.filter((x) => normalizar(x[campo]).includes(t)) : lista;
}

function Buscador({ valor, alCambiar, etiqueta }) {
  return (
    <label className="selector__buscar">
      <Search size={16} aria-hidden="true" />
      <input className="input" type="search" value={valor} onChange={(e) => alCambiar(e.target.value)} placeholder={etiqueta} aria-label={etiqueta} />
    </label>
  );
}

const PRESENCIAS = [
  ['oficial_argentina', 'Venta oficial en Argentina'], ['disponible_argentina', 'Disponible en Argentina'],
  ['historico_argentina', 'Se vendió en Argentina'], ['importado', 'Importada'], ['internacional', 'Modelo internacional'],
];

/** Ficha de un modelo sin años ni versiones verificadas: no se inventan; se puede ver qué repuestos tiene cargados. */
function FichaModelo({ ficha, referencias, alVerRepuestos }) {
  const foto = ficha.imagenes[0];
  const presencia = PRESENCIAS.filter(([clave]) => ficha.presencia?.[clave]).map(([, texto]) => texto);
  return (
    <div className="ficha-modelo">
      <figure className="ficha-modelo__foto">
        {foto ? <img src={imagen(foto.archivo)} alt={`${ficha.marca.nombre} ${ficha.nombre}`} />
          : <div className="ficha-modelo__sin-foto">Sin foto verificada (IMAGE_MISSING)</div>}
        {foto && (
          <figcaption className="texto-chico texto-gris">
            Foto: {foto.autor || 'autor sin dato'} · {foto.licencia_url ? <a href={foto.licencia_url} target="_blank" rel="noreferrer">{foto.licencia}</a> : foto.licencia}
            {' · '}<a href={foto.url_origen} target="_blank" rel="noreferrer">Wikimedia Commons</a>
          </figcaption>
        )}
      </figure>
      <div className="ficha-modelo__datos">
        <h3>{ficha.marca.nombre} {ficha.nombre}</h3>
        {ficha.categorias.length > 0 && (
          <div className="chips">
            {ficha.categorias.map((c) => <span key={c.codigo} className="chip chip--estatico">{c.nombre}</span>)}
          </div>
        )}
        <dl className="ficha-modelo__lista">
          <dt>Tipo</dt><dd>{ficha.tipo_nombre || 'Sin dato'}</dd>
          <dt>Años de fabricación</dt>
          <dd>{!ficha.anio_desde ? 'Sin dato verificado' : ficha.anio_hasta ? `${ficha.anio_desde}–${ficha.anio_hasta}` : `desde ${ficha.anio_desde} (año final sin dato)`}</dd>
          {ficha.generaciones.length > 0 && (
            <>
              <dt>Generaciones</dt>
              <dd>{ficha.generaciones.map((g) => `${g.nombre}: ${g.anio_desde}–${g.anio_hasta || 'sin dato'}`).join(' · ')}</dd>
            </>
          )}
          <dt>Versiones, motor y cilindrada</dt><dd>Sin datos verificados todavía</dd>
          {presencia.length > 0 && <><dt>Argentina</dt><dd>{presencia.join(' · ')}</dd></>}
        </dl>
        <p className="texto-chico texto-gris">
          {ficha.fuente ? <>Dato de <strong>{ficha.fuente.nombre}</strong>{ficha.fuente.licencia ? ` (${ficha.fuente.licencia})` : ''}, </> : ''}
          {etiquetaDe(referencias, 'estados_verificacion', ficha.estado_verificacion).toLowerCase()}. Los años, versiones y motores se cargan
          cuando hay una fuente verificable; mientras tanto podés ver los repuestos cargados para este modelo.
        </p>
        <button type="button" className="btn btn--primario" onClick={alVerRepuestos}>
          Ver repuestos para esta {ficha.segmento === 'moto' ? 'moto' : 'unidad'} <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

/**
 * Selector "Mi vehículo": marca → modelo → año → (generación) → versión.
 * Todo sale de la API: las marcas, modelos y versiones son las del registro automotor (DNRPA).
 */
export default function SelectorVehiculo() {
  const { selectorAbierto, cerrarSelector, elegir, marcaInicial } = useVehiculo();
  const navigate = useNavigate();
  const { avisar } = useAvisos();
  const referencias = useReferencias();
  const [segmento, setSegmento] = useState('');
  const [texto, setTexto] = useState('');
  const [marca, setMarca] = useState(null);
  const [modelo, setModelo] = useState(null);
  const [anio, setAnio] = useState(null);
  const [generacion, setGeneracion] = useState(undefined); // undefined = sin elegir; null = "no sé / todas"
  const [todas, setTodas] = useState(false);
  const [categoriaMoto, setCategoriaMoto] = useState('');

  useEffect(() => {
    if (selectorAbierto) {
      setMarca(marcaInicial);
      setModelo(null);
      setAnio(null);
      setGeneracion(undefined);
      setTexto('');
      setTodas(false);
    }
  }, [selectorAbierto, marcaInicial]);

  // Cada paso limpia el texto de búsqueda
  useEffect(() => setTexto(''), [marca, modelo, anio]);
  useEffect(() => setCategoriaMoto(''), [marca, segmento]);

  const marcas = useApi(selectorAbierto ? `/vehiculos/marcas${segmento ? `?segmento=${segmento}` : ''}` : null);
  const modelos = useApi(marca ? `/vehiculos/marcas/${marca.id}/modelos${segmento ? `?segmento=${segmento}` : ''}` : null);
  // Un modelo sin versiones cargadas (motos sin años verificados) muestra su ficha en lugar de los años
  const sinVersiones = Boolean(modelo) && Number(modelo.versiones) === 0;
  const anios = useApi(modelo && !sinVersiones ? `/vehiculos/modelos/${modelo.id}/anios` : null);
  const ficha = useApi(sinVersiones ? `/vehiculos/modelos/${modelo.id}` : null);
  const generaciones = useApi(anio ? `/vehiculos/modelos/${modelo.id}/generaciones?anio=${anio}` : null);
  const hayGeneraciones = generaciones.datos?.length > 0;
  const generacionLista = !anio ? false : generaciones.cargando ? false : !hayGeneraciones || generacion !== undefined;
  const versiones = useApi(generacionLista
    ? `/vehiculos/modelos/${modelo.id}/versiones?anio=${anio}${generacion ? `&generacion=${generacion.id}` : ''}` : null);

  const pasos = sinVersiones ? ['Marca', 'Modelo', 'Ficha'] : ['Marca', 'Modelo', 'Año', ...(hayGeneraciones ? ['Generación'] : []), 'Versión'];
  let paso = !marca ? 0 : !modelo ? 1 : !anio ? 2 : 3;
  if (paso === 3 && hayGeneraciones && generacion !== undefined) paso = 4;
  const nombrePaso = pasos[Math.min(paso, pasos.length - 1)];

  const volver = () => {
    if (generacion !== undefined && hayGeneraciones) setGeneracion(undefined);
    else if (anio) setAnio(null);
    else if (modelo) setModelo(null);
    else setMarca(null);
  };

  const confirmar = (v) => {
    elegir({
      id: v.id, marca: marca.nombre, modelo: modelo.nombre, anio, version: v.version,
      motor: v.motor, combustible: v.combustible_motor, generacion: generacion?.nombre ?? null,
    });
    cerrarSelector();
    avisar(`Listo: te mostramos repuestos para tu ${marca.nombre} ${modelo.nombre} ${anio}.`);
  };

  const elegidos = [marca?.nombre, modelo?.nombre, anio, ...(hayGeneraciones ? [generacion === null ? 'Todas' : generacion?.nombre] : [])];
  const actual = anio && generaciones.cargando ? generaciones
    : { Marca: marcas, Modelo: modelos, Año: anios, Generación: generaciones, Versión: versiones, Ficha: ficha }[nombrePaso];

  const listaMarcas = useMemo(() => {
    const lista = filtrar(marcas.datos || [], texto);
    return texto || todas ? lista : lista.slice(0, MARCAS_DESTACADAS);
  }, [marcas.datos, texto, todas]);
  const listaModelos = useMemo(
    () => filtrar(modelos.datos || [], texto).filter((m) => !categoriaMoto || m.categorias?.includes(categoriaMoto)),
    [modelos.datos, texto, categoriaMoto]);
  // Categorías de moto presentes en la marca, con la cantidad de modelos de cada una
  const categoriasMarca = useMemo(() => {
    const cuenta = new Map();
    for (const m of modelos.datos || []) for (const c of m.categorias || []) cuenta.set(c, (cuenta.get(c) || 0) + 1);
    return (referencias?.categorias_moto || []).filter((c) => cuenta.has(c.valor)).map((c) => ({ ...c, modelos: cuenta.get(c.valor) }));
  }, [modelos.datos, referencias]);
  const etiquetaCategoria = (codigo) => referencias?.categorias_moto?.find((c) => c.valor === codigo)?.etiqueta || codigo;
  const verRepuestosModelo = () => {
    cerrarSelector();
    navigate(`/catalogo?modelo=${modelo.id}`);
  };
  const listaVersiones = useMemo(() => filtrar(versiones.datos || [], texto, 'version'), [versiones.datos, texto]);
  const fuente = referencias?.atribuciones?.find((a) => /dnrpa/i.test(a.nombre));
  const fuenteMotos = referencias?.atribuciones?.find((a) => /wikidata/i.test(a.nombre));
  const esMoto = segmento === 'moto' || modelo?.segmento === 'moto';

  return (
    <Modal abierto={selectorAbierto} alCerrar={cerrarSelector} titulo="Elegí tu vehículo" ancho={820}>
      <>
        <ol className="selector__pasos" style={{ '--pasos': pasos.length }}>
          {pasos.map((nombre, i) => (
            <li key={nombre} className={i < paso ? 'hecho' : i === paso ? 'actual' : ''}>
              <span className="selector__num">{i < paso ? <Check size={14} /> : i + 1}</span>
              <span className="selector__paso-texto">
                <small>{nombre}</small>
                {elegidos[i] && <strong>{elegidos[i]}</strong>}
              </span>
            </li>
          ))}
        </ol>

        <div className="selector__barra">
          {paso > 0 && (
            <button type="button" className="btn btn--fantasma btn--chico" onClick={volver}>
              <ArrowLeft size={16} /> Volver
            </button>
          )}
          {paso <= 1 && referencias?.segmentos && (
            <div className="segmentos segmentos--chico" role="group" aria-label="Tipo de vehículo">
              <button type="button" className={!segmento ? 'activo' : ''} aria-pressed={!segmento} onClick={() => setSegmento('')}>Todos</button>
              {referencias.segmentos.filter((s) => s.valor !== 'mixto').map((s) => (
                <button key={s.valor} type="button" className={segmento === s.valor ? 'activo' : ''} aria-pressed={segmento === s.valor}
                  onClick={() => setSegmento(s.valor)}>{s.etiqueta}</button>
              ))}
            </div>
          )}
          {(paso === 0 || paso === 1 || nombrePaso === 'Versión') && (
            <Buscador valor={texto} alCambiar={setTexto}
              etiqueta={paso === 0 ? 'Buscar marca' : paso === 1 ? `Buscar modelo de ${marca.nombre}` : 'Filtrar versiones (ej: 2.8, diésel, AT)'} />
          )}
        </div>

        {actual?.cargando && <Cargando texto="Cargando…" />}
        {actual?.error && <ErrorMensaje error={actual.error} />}

        {paso === 0 && marcas.datos && (
          <>
            <div className="selector__marcas">
              {listaMarcas.map((m) => (
                <button key={m.id} type="button" className="selector__marca" onClick={() => setMarca(m)}>
                  <MarcaLogo marca={m} />
                  <span>{m.nombre}</span>
                </button>
              ))}
            </div>
            {!texto && !todas && marcas.datos.length > MARCAS_DESTACADAS && (
              <button type="button" className="btn btn--fantasma btn--bloque" onClick={() => setTodas(true)}>
                Ver las {marcas.datos.length} marcas
              </button>
            )}
            {texto && !listaMarcas.length && <p className="texto-gris">No hay marcas con “{texto}”.</p>}
          </>
        )}

        {paso === 1 && modelos.datos && categoriasMarca.length > 1 && (
          <div className="chips selector__categorias" role="group" aria-label="Categoría de moto">
            <button type="button" className={`chip ${!categoriaMoto ? 'activo' : ''}`} aria-pressed={!categoriaMoto} onClick={() => setCategoriaMoto('')}>Todas</button>
            {categoriasMarca.map((c) => (
              <button key={c.valor} type="button" className={`chip ${categoriaMoto === c.valor ? 'activo' : ''}`} aria-pressed={categoriaMoto === c.valor}
                onClick={() => setCategoriaMoto(c.valor)}>
                {c.etiqueta} <span className="chip__contador">{c.modelos}</span>
              </button>
            ))}
          </div>
        )}

        {paso === 1 && modelos.datos && (
          <div className="selector__lista">
            {listaModelos.map((m) => (
              <button key={m.id} type="button" className={`selector__opcion ${m.segmento === 'moto' ? 'selector__opcion--moto' : ''}`} onClick={() => setModelo(m)}>
                {m.segmento === 'moto' && (
                  <img className="selector__foto" src={imagen(m.foto?.archivo)} alt="" loading="lazy" />
                )}
                <span className="selector__opcion-texto">
                  <strong>{m.nombre}</strong>
                  <span className="texto-gris">
                    {[m.tipo_nombre, m.anio_desde && (m.anio_hasta ? `${m.anio_desde}–${m.anio_hasta}` : m.segmento === 'moto' ? `desde ${m.anio_desde}` : `${m.anio_desde}–hoy`), m.estado_mercado === 'comercializado' && 'se vende 0 km',
                      ...(m.categorias || []).slice(0, 2).map(etiquetaCategoria)].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </button>
            ))}
            {!listaModelos.length && <p className="texto-gris">No hay modelos{texto ? <> con “{texto}”</> : ' en esa categoría'}.</p>}
          </div>
        )}

        {nombrePaso === 'Ficha' && ficha.datos && (
          <FichaModelo ficha={ficha.datos} referencias={referencias} alVerRepuestos={verRepuestosModelo} />
        )}

        {paso === 2 && anios.datos && (
          <div className="selector__anios">
            {anios.datos.map((a) => (
              <button key={a} type="button" className="selector__anio" onClick={() => setAnio(a)}>{a}</button>
            ))}
          </div>
        )}

        {nombrePaso === 'Generación' && hayGeneraciones && (
          <div className="selector__lista">
            {generaciones.datos.map((g) => (
              <button key={g.id} type="button" className="selector__opcion" onClick={() => setGeneracion(g)}>
                <strong>{g.nombre}{g.codigo ? ` (${g.codigo})` : ''}</strong>
                <span className="texto-gris">{g.anio_desde}–{g.anio_hasta || 'hoy'}</span>
              </button>
            ))}
            <button type="button" className="selector__opcion" onClick={() => setGeneracion(null)}>
              <strong>No sé / ver todas</strong>
            </button>
          </div>
        )}

        {nombrePaso === 'Versión' && versiones.datos && (
          <div className="selector__lista">
            {listaVersiones.map((v) => (
              <button key={v.id} type="button" className="selector__opcion selector__opcion--version" onClick={() => confirmar(v)}>
                <strong>{v.version}</strong>
                <span className="texto-gris">
                  {v.motor && <><Settings2 size={14} aria-hidden="true" /> {v.motor} · </>}
                  {v.combustible_motor && <><Fuel size={14} aria-hidden="true" /> {etiquetaDe(referencias, 'combustibles', v.combustible_motor)} · </>}
                  {[etiquetaDe(referencias, 'transmisiones', v.transmision), v.traccion, v.tipo].filter(Boolean).join(' · ')}
                  {' · '}{v.anio_desde}–{v.anio_hasta}
                </span>
              </button>
            ))}
            {!listaVersiones.length && <p className="texto-gris">No hay versiones con “{texto}”.</p>}
          </div>
        )}
      </>

      {esMoto ? (
        <p className="selector__fuente texto-gris texto-chico">
          Motos: lista de AUTONEX y {fuenteMotos ? <a href={fuenteMotos.url} target="_blank" rel="noreferrer">{fuenteMotos.nombre}</a> : 'Wikidata'} (CC0), sin verificar
          {' · '}fotos de Wikimedia Commons con su licencia (ver <a href={`${import.meta.env.BASE_URL}creditos`}>créditos</a>)
        </p>
      ) : fuente && (
        <p className="selector__fuente texto-gris texto-chico">
          Marcas, modelos y versiones: <a href={fuente.url} target="_blank" rel="noreferrer">{fuente.nombre}</a>
          {fuente.licencia && <> · {fuente.licencia}</>}
        </p>
      )}
    </Modal>
  );
}

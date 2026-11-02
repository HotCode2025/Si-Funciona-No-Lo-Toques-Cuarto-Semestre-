import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cargando } from '../components/Estados.jsx';
import { useReferencias, useTitulo } from '../lib/hooks.js';
import { imagen, normalizar } from '../lib/formato.js';

const FOTOS_VISIBLES = 60;

/** Créditos de las fotos de motos (de /img/motos/fotos.json), con buscador porque son muchas. */
function CreditosMotos({ fotos }) {
  const [texto, setTexto] = useState('');
  const [todas, setTodas] = useState(false);
  const lista = useMemo(() => {
    const t = normalizar(texto);
    return t ? fotos.filter((f) => normalizar(`${f.marca} ${f.modelo}`).includes(t)) : fotos;
  }, [fotos, texto]);
  const visibles = todas ? lista : lista.slice(0, FOTOS_VISIBLES);
  return (
    <>
      <h2 className="titulo-seccion">Fotos de modelos de motos</h2>
      <p className="texto-gris">
        {fotos.length.toLocaleString('es-AR')} fotos reales de Wikimedia Commons: la imagen que Wikidata asocia a cada modelo, con su
        licencia libre. Los modelos sin foto en Commons se muestran sin imagen; nunca se usa la foto de otro modelo parecido.
      </p>
      <input className="input creditos__buscar" type="search" value={texto} onChange={(e) => setTexto(e.target.value)}
        placeholder="Buscar marca o modelo" aria-label="Buscar foto de moto por marca o modelo" />
      <div className="tabla-contenedor">
        <table className="tabla creditos__logos">
          <thead><tr><th>Moto</th><th>Archivo original</th><th>Autor</th><th>Licencia</th></tr></thead>
          <tbody>
            {visibles.map((f) => (
              <tr key={f.archivo}>
                <td>
                  <img className="creditos__moto" src={imagen(`/${f.archivo}`)} alt="" loading="lazy" />
                  {f.marca} {f.modelo}
                </td>
                <td><a href={f.origen} target="_blank" rel="noreferrer">{f.titulo}</a></td>
                <td className="texto-chico">{f.autor}</td>
                <td className="texto-chico">{f.licencia_url ? <a href={f.licencia_url} target="_blank" rel="noreferrer">{f.licencia}</a> : f.licencia}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!todas && lista.length > FOTOS_VISIBLES && (
        <button type="button" className="btn btn--fantasma btn--bloque" onClick={() => setTodas(true)}>
          Ver las {lista.length.toLocaleString('es-AR')} fotos
        </button>
      )}
    </>
  );
}

/** Fuentes de datos (con su licencia y atribución) y créditos de las fotos (de /img/creditos.json). */
export default function Creditos() {
  useTitulo('Fuentes y créditos');
  const referencias = useReferencias();
  const [creditos, setCreditos] = useState(null);
  const [logos, setLogos] = useState([]);
  const [logosRepuestos, setLogosRepuestos] = useState([]);
  const [fotosMotos, setFotosMotos] = useState([]);
  useEffect(() => {
    fetch(imagen('/img/motos/fotos.json')).then((r) => r.json()).then(setFotosMotos).catch(() => setFotosMotos([]));
    fetch(imagen('/img/creditos.json')).then((r) => r.json()).then(setCreditos).catch(() => setCreditos([]));
    fetch(imagen('/img/marcas/logos/logos.json')).then((r) => r.json()).then(setLogos).catch(() => setLogos([]));
    fetch(imagen('/img/marcas-repuesto/logos/logos.json')).then((r) => r.json()).then(setLogosRepuestos).catch(() => setLogosRepuestos([]));
  }, []);

  return (
    <div className="contenedor pagina">
      <nav className="migas" aria-label="Ubicación"><Link to="/">Inicio</Link><span aria-hidden="true">/</span><span>Créditos</span></nav>
      <h1 className="titulo-seccion">Fuentes de datos</h1>
      <div className="pila creditos__fuentes">
        {referencias?.atribuciones.map((a) => (
          <div key={a.nombre} className="tarjeta tarjeta--padding">
            <strong>{a.url ? <a href={a.url} target="_blank" rel="noreferrer">{a.nombre}</a> : a.nombre}</strong>
            <p className="texto-chico">{a.atribucion}</p>
            {a.licencia && <p className="texto-chico texto-gris">Licencia: {a.licencia_url ? <a href={a.licencia_url} target="_blank" rel="noreferrer">{a.licencia}</a> : a.licencia}</p>}
          </div>
        ))}
        <p className="texto-chico texto-gris">
          Los repuestos, vendedores, precios y stock de esta demo son ficticios y figuran como datos “a revisar”: no provienen de ningún catálogo real.
        </p>
      </div>

      <h2 className="titulo-seccion">Créditos de imágenes</h2>
      <p className="texto-gris">Las fotos provienen de Wikimedia Commons, con licencias libres. Son ilustrativas del tipo de pieza.</p>
      {!creditos && <Cargando />}
      <div className="creditos">
        {creditos?.map((c) => (
          <figure key={c.archivo} className="credito">
            <img src={imagen(`/${c.archivo}`)} alt="" loading="lazy" />
            <figcaption>
              <a href={c.fuente} target="_blank" rel="noreferrer">{c.titulo}</a>
              <span>{c.autor}</span>
              {c.licencia_url ? <a href={c.licencia_url} target="_blank" rel="noreferrer">{c.licencia}</a> : <span>{c.licencia}</span>}
            </figcaption>
          </figure>
        ))}
      </div>

      {logos.length > 0 && (
        <>
          <h2 className="titulo-seccion">Logos de marcas de vehículos</h2>
          <p className="texto-gris">
            Los logos son marcas registradas de sus respectivos dueños y se muestran solo para identificar cada marca, en un
            proyecto universitario sin fines comerciales. Su presencia no implica relación ni respaldo de los fabricantes.
            Salen de Wikimedia Commons (con la licencia indicada) y, cuando ahí no estaban, de Beepaway, que los ofrece para
            uso educativo o no comercial.
          </p>
          <div className="tabla-contenedor">
            <table className="tabla creditos__logos">
              <thead><tr><th>Marca</th><th>Archivo original</th><th>Autor</th><th>Licencia</th></tr></thead>
              <tbody>
                {logos.map((l) => (
                  <tr key={l.slug}>
                    <td>
                      <span className={`marca-logo creditos__logo ${l.fondo === 'oscuro' ? 'marca-logo--oscuro' : ''}`}>
                        <img src={imagen(`/${l.archivo}`)} alt="" loading="lazy" />
                      </span>
                      {l.marca}
                    </td>
                    <td><a href={l.origen} target="_blank" rel="noreferrer">{l.titulo}</a></td>
                    <td className="texto-chico">{l.autor}</td>
                    <td className="texto-chico">{l.licencia_url ? <a href={l.licencia_url} target="_blank" rel="noreferrer">{l.licencia}</a> : l.licencia}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {logosRepuestos.length > 0 && (
        <>
          <h2 className="titulo-seccion">Logos de marcas de repuestos</h2>
          <p className="texto-gris">
            Marcas registradas de sus dueños, mostradas solo para identificar cada marca. Salen de Wikimedia Commons con la
            licencia indicada; se usa el logo de la marca, nunca el del grupo dueño.
          </p>
          <div className="tabla-contenedor">
            <table className="tabla creditos__logos">
              <thead><tr><th>Marca</th><th>Archivo original</th><th>Autor</th><th>Licencia</th></tr></thead>
              <tbody>
                {logosRepuestos.map((l) => (
                  <tr key={l.slug}>
                    <td>
                      <span className={`marca-logo creditos__logo ${l.fondo === 'oscuro' ? 'marca-logo--oscuro' : ''}`}>
                        <img src={imagen(`/${l.archivo}`)} alt="" loading="lazy" />
                      </span>
                      {l.marca}
                    </td>
                    <td><a href={l.origen} target="_blank" rel="noreferrer">{l.titulo}</a></td>
                    <td className="texto-chico">{l.autor}</td>
                    <td className="texto-chico">{l.licencia_url ? <a href={l.licencia_url} target="_blank" rel="noreferrer">{l.licencia}</a> : l.licencia}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {fotosMotos.length > 0 && <CreditosMotos fotos={fotosMotos} />}
    </div>
  );
}

import { Fragment, useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, ScaleControl, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { TIPOS, esReciente, hace } from '../../utils/format.js';

/**
 * Mapa real de la zona: Leaflet con los mapas de OpenStreetMap.
 *
 * Por qué no Google Maps: pide una clave de API atada a una cuenta con
 * facturación. Tampoco CARTO, que empezó a pedir clave y estampa una marca
 * de agua sin ella. Los mapas de OpenStreetMap no piden nada; su política
 * permite un uso liviano como este siempre que se muestre la atribución.
 *
 * OpenStreetMap solo viene en colores claros. El modo noche sale de un
 * filtro CSS sobre las baldosas (index.css, .leaflet-tile-pane): invertir
 * y girar el tono deja la tierra oscura y el agua azul profundo, y no toca
 * los puntos, que van en otra capa.
 *
 * Lo que se resigna respecto del mapa SVG anterior: el fondo se baja de
 * internet. Sin conexión, los puntos se siguen dibujando, pero sobre agua
 * lisa.
 *
 * Todo cuelga de una zona: el mapa arranca encuadrado en su bounding box,
 * pero no la dibuja. Al reportar se puede marcar en cualquier parte del
 * océano, y el reporte queda en la zona elegida en el formulario, igual que
 * en la API real.
 */

const FONDO = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  atribucion: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
};

const limites = (z) => [[Number(z.min_lat), Number(z.min_lng)], [Number(z.max_lat), Number(z.max_lng)]];

// Leaflet escribe los colores como atributos del SVG. Se resuelven las
// variables CSS a su valor real para no depender de que el navegador
// entienda var() dentro de un atributo.
const colores = new Map();
function colorReal(valor) {
  const variable = /^var\((--[\w-]+)\)$/.exec(valor ?? '')?.[1];
  if (!variable) return valor;
  if (!colores.has(variable)) {
    const leido = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
    colores.set(variable, leido || '#7FB5B0');
  }
  return colores.get(variable);
}

/**
 * Encuadra la zona. Leaflet mide el contenedor una sola vez, al crearse, y
 * el contenedor toma su alto de aspect-ratio recién cuando la página se
 * acomoda: con esa medida vieja el mapa terminaba centrado en Río Gallegos.
 * Por eso se vuelve a medir y a encuadrar cada vez que cambia de tamaño, y
 * también cuando cambia la zona. Un zoom del usuario no dispara nada.
 */
function Encuadre({ zona }) {
  const mapa = useMap();
  useEffect(() => {
    let medido = null;
    const encuadrar = () => {
      const { clientWidth: ancho, clientHeight: alto } = mapa.getContainer();
      // Con la pestaña oculta o el mapa escondido el contenedor mide 0, y
      // Leaflet encuadra en ese caso con el zoom máximo (19, nivel calle).
      // Se ignora esa medida, y se olvida la anterior para encuadrar de
      // nuevo apenas vuelva a verse, aunque tenga el mismo tamaño que antes.
      if (ancho < 50 || alto < 50) { medido = null; return; }
      if (medido?.ancho === ancho && medido?.alto === alto) return;
      medido = { ancho, alto };
      mapa.invalidateSize({ pan: false });
      mapa.fitBounds(limites(zona), { padding: [12, 12], animate: false });
    };
    const observador = new ResizeObserver(encuadrar);
    observador.observe(mapa.getContainer());
    return () => observador.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapa, zona.slug]);
  return null;
}

function AlTocar({ alTocar }) {
  useMapEvents({ click: (evento) => alTocar(evento.latlng) });
  return null;
}

export default function MapaZona({
  zona,
  avistamientos = [],
  alto = 420,
  onSeleccionar,
  seleccionado,
  interactivo = true,
  onClickMapa,
}) {
  const [encima, setEncima] = useState(null);
  // Punto tocado. En un teléfono no hay hover, así que sin esto la ficha
  // de un reporte no se podría ver nunca.
  const [fijado, setFijado] = useState(null);

  if (!zona) return null;

  const tocarMapa = (latlng) => {
    // Tocar el agua suelta la ficha fijada; al reportar, marca el punto.
    if (!onClickMapa) { setFijado(null); return; }
    onClickMapa({ lat: latlng.lat, lng: latlng.lng });
  };

  const tocar = (a) => {
    if (onSeleccionar) onSeleccionar(a);
    else if (interactivo) setFijado((actual) => (actual === a.id ? null : a.id));
  };

  const activo = encima ?? seleccionado ?? fijado;
  const datosActivo = avistamientos.find((a) => a.id === activo);

  // scrollWheelZoom apagado: el mapa está en el medio de pantallas largas y
  // la rueda tiene que seguir bajando la página. Para acercar están + y −.
  // trackResize apagado: Leaflet tiene su propio detector de tamaño, que
  // ante un parpadeo en 0 px re-centraba el mapa por su cuenta y lo dejaba
  // corrido. Del tamaño se ocupa solo Encuadre.
  // width 100% en el contenedor: con aspect-ratio y ancho automático, Chrome
  // traslada el min-height de 240 a un ancho de 528 px (240 × 2,2), y en un
  // teléfono el mapa desbordaba la página hacia el costado. Con el ancho
  // definido, el alto sale del ancho y el mínimo solo lo estira hacia abajo.
  // (min-width: 0 no alcanza, probado.)
  return (
    <div className={`mapa-oceanos relative overflow-hidden rounded-carta border border-columna bg-abismo ${onClickMapa ? 'mapa-marcar' : ''}`}
         style={{ width: '100%', aspectRatio: 2.2, maxHeight: alto, minHeight: 240 }}>
      <MapContainer
        bounds={limites(zona)}
        boundsOptions={{ padding: [12, 12] }}
        scrollWheelZoom={false}
        trackResize={false}
        zoomSnap={0.25}
        zoomDelta={0.5}
        className="absolute inset-0 h-full w-full"
        aria-label={`Mapa de ${zona.name} con ${avistamientos.length} reportes`}>
        <TileLayer url={FONDO.url} attribution={FONDO.atribucion} maxZoom={19} />
        <ScaleControl position="bottomleft" imperial={false} />
        <Encuadre zona={zona} />
        <AlTocar alTocar={tocarMapa} />

        {avistamientos.map((a) => {
          const centro = [Number(a.lat), Number(a.lng)];
          const color = colorReal(TIPOS[a.kind]?.color ?? 'var(--color-sonda)');
          const esActivo = a.id === activo;
          const nombre = `${a.common_name ?? TIPOS[a.kind]?.etiqueta}, ${hace(a.observed_at)}`;

          return (
            <Fragment key={a.id}>
              {/* El pulso solo marca lo de las últimas 24 h: el movimiento
                  señala novedad, no decora. */}
              {esReciente(a.observed_at) && (
                <CircleMarker center={centro} radius={6} interactive={false}
                              pathOptions={{ color, weight: 2, fill: false, className: 'pulso-mapa' }} />
              )}
              <CircleMarker center={centro} radius={esActivo ? 8 : 5.5} interactive={false}
                            pathOptions={{
                              color: esActivo ? '#EDF3F1' : color, weight: esActivo ? 2 : 0,
                              fillColor: color, fillOpacity: a.status === 'verificado' ? 1 : 0.5,
                            }} />
              {/* Área de toque invisible y más grande que el punto: con el
                  dedo no se acierta a un círculo de 11 px. Además es la que
                  se puede recorrer con Tab. */}
              {interactivo && (
                <CircleMarker center={centro} radius={14} bubblingMouseEvents={false}
                              pathOptions={{ stroke: false, fillColor: color, fillOpacity: 0 }}
                              eventHandlers={{
                                mouseover: () => setEncima(a.id),
                                mouseout: () => setEncima(null),
                                click: () => tocar(a),
                                add: (evento) => {
                                  const el = evento.target.getElement();
                                  el.setAttribute('tabindex', '0');
                                  el.setAttribute('role', 'button');
                                  el.setAttribute('aria-label', nombre);
                                  el.addEventListener('focus', () => setEncima(a.id));
                                  el.addEventListener('blur', () => setEncima(null));
                                  el.addEventListener('keydown', (tecla) => {
                                    if (tecla.key === 'Enter' || tecla.key === ' ') { tecla.preventDefault(); tocar(a); }
                                  });
                                },
                              }} />
              )}
            </Fragment>
          );
        })}
      </MapContainer>

      {/* Ficha del reporte bajo el cursor o tocado */}
      {datosActivo && (
        <div className="pointer-events-none absolute bottom-9 left-3 z-[1000] max-w-xs rounded-carta border border-columna bg-abismo/95 px-3 py-2 text-carta backdrop-blur">
          <p className="text-sm font-500">
            {datosActivo.common_name ?? TIPOS[datosActivo.kind]?.etiqueta}
          </p>
          {datosActivo.scientific_name && (
            <p className="text-xs italic text-sonda">{datosActivo.scientific_name}</p>
          )}
          <p className="mt-1 text-xs text-sonda">
            {hace(datosActivo.observed_at)} · {datosActivo.reporter_name}
            {datosActivo.depth_m != null && ` · −${datosActivo.depth_m} m`}
          </p>
          {datosActivo.notes && (
            <p className="mt-1 text-xs text-carta/80">{datosActivo.notes}</p>
          )}
        </div>
      )}

      <p className="pointer-events-none absolute right-3 top-3 z-[1000] rounded-carta bg-abismo/70 px-2 py-1 text-xs text-sonda">
        {zona.name} · {zona.province}
      </p>
    </div>
  );
}

/** Leyenda de tipos, para poner debajo del mapa. */
export function LeyendaMapa({ className = '' }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-tinta/80 ${className}`}>
      {Object.entries(TIPOS).map(([clave, { etiqueta, color }]) => (
        <span key={clave} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
          {etiqueta}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5 opacity-70">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-sonda opacity-60" />
        Sin verificar
      </span>
      <span className="text-tinta/60">· Tocá un punto para ver quién lo reportó</span>
    </div>
  );
}

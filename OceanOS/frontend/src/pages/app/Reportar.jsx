import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Crosshair, Check } from 'lucide-react';
import { useFetch } from '../../hooks/useFetch.js';
import { useReglas } from '../../hooks/useReglas.js';
import { useDemo } from '../../contexts/DemoContext.jsx';
import { api } from '../../services/api.js';
import MapaZona from '../../components/mapa/MapaZona.jsx';
import {
  Panel, Boton, Campo, Entrada, Area, Selector, CajaError, Etiqueta,
} from '../../components/ui/index.jsx';
import { numero, TIPOS } from '../../utils/format.js';

const PREMIOS = {
  reporte_basico:  'Reporte enviado',
  foto_verificada: 'Reporte verificado',
  zona_nueva:      'Primero en una zona sin reportes',
  racha_semanal:   'Bono por racha',
};

/**
 * Un reporte tiene que poder cargarse con una mano, mojado y con frío.
 * Por eso: tipo primero, ubicación con un toque en el mapa o del GPS, y
 * el resto opcional.
 */
export default function Reportar() {
  const { user, refrescar } = useDemo();
  const reglas = useReglas();
  const navegar = useNavigate();

  const [zonaSlug, setZonaSlug] = useState(user?.home_zone_slug ?? 'golfo-nuevo');
  const [kind, setKind] = useState('kelp');
  const [punto, setPunto] = useState(null);
  const [form, setForm] = useState({
    speciesId: '', depthM: '', individuals: '', kelpCoverPct: '', notes: '',
  });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [listo, setListo] = useState(null);
  const [gps, setGps] = useState(null);

  const { data: zonas } = useFetch('/ecosistema/zonas');
  const { data: zonaData } = useFetch(`/ecosistema/zonas/${zonaSlug}`, [zonaSlug]);
  const { data: esp } = useFetch('/ecosistema/especies');

  const especiesDelTipo = (esp?.especies ?? []).filter((e) => e.kind === kind);

  const usarGps = () => {
    if (!navigator.geolocation) { setGps('Tu navegador no comparte ubicación'); return; }
    setGps('buscando');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const z = zonaData?.zona;
        // Lejos de la zona el punto caería fuera del mapa y el reporte
        // quedaría en otro lado del océano. En la demo es lo más común.
        if (z && (lat < z.min_lat || lat > z.max_lat || lng < z.min_lng || lng > z.max_lng)) {
          setGps(`Tu ubicación queda fuera de ${z.name}. Tocá el mapa para marcar el punto.`);
          return;
        }
        setPunto({ lat, lng });
        setGps(null);
      },
      () => setGps('No pudimos leer tu ubicación. Tocá el mapa para marcarla.'),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const enviar = async (evento) => {
    evento.preventDefault();
    if (!punto) { setError({ message: 'Marcá dónde fue: tocá el mapa o usá tu ubicación' }); return; }
    setEnviando(true);
    setError(null);
    try {
      const r = await api.post('/avistamientos', {
        zoneSlug: zonaSlug, kind,
        lat: Number(punto.lat.toFixed(6)),
        lng: Number(punto.lng.toFixed(6)),
        speciesId: form.speciesId || undefined,
        depthM: form.depthM ? Number(form.depthM) : undefined,
        individuals: form.individuals ? Number(form.individuals) : undefined,
        kelpCoverPct: form.kelpCoverPct ? Number(form.kelpCoverPct) : undefined,
        notes: form.notes || undefined,
        // En la app móvil este número lo pone el modelo on-device. Acá,
        // sin foto, el reporte entra sin clasificar y lo revisa la
        // comunidad.
        aiConfidence: undefined,
      });
      setListo(r);
      refrescar();
    } catch (e) {
      setError(e);
    } finally {
      setEnviando(false);
    }
  };

  if (listo) {
    return (
      <div className="mx-auto max-w-lg px-5 py-12">
        <Panel className="p-6 text-center">
          <p className="inline-flex items-center gap-2 font-display text-xl font-600 text-alga">
            <Check size={20} /> Reporte enviado
          </p>
          {/* El desglose muestra tanto el reporte básico como los premios
              adicionales, para que el usuario vea de dónde sale el saldo. */}
          {listo.tokensGanados > 0 && (
            <>
              <p className="cifra mt-4 font-display text-4xl font-600 text-kelp">
                +{listo.tokensGanados} OKN
              </p>
              <ul className="mx-auto mt-3 max-w-xs space-y-1 text-sm">
                {listo.desglose?.map((d) => (
                  <li key={d.motivo} className="flex justify-between gap-4 text-tinta">
                    <span>{PREMIOS[d.motivo] ?? d.motivo}</span>
                    <span className="cifra text-alga">+{d.monto}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="mt-3 text-sm text-tinta">
            Queda en revisión: sin foto clasificada, tres personas de la comunidad lo
            validan antes de que entre al índice.
            {reglas && (
              <> Si queda verificado, sumás
                <span className="cifra font-500 text-kelp"> {reglas.premios.foto_verificada} OKN</span>.</>
            )}
          </p>
          <Link to="/app/tokens" className="mt-2 inline-block text-sm text-sonda underline underline-offset-4 hover:text-kelp">
            Cómo funcionan los tokens y las rachas
          </Link>
          {listo.racha > 1 && (
            <p className="mt-3 text-sm text-tinta">
              Llevás {listo.racha} días seguidos reportando.
            </p>
          )}
          <div className="mt-6 flex justify-center gap-3">
            <Boton variante="kelp" onClick={() => { setListo(null); setPunto(null);
              setForm({ speciesId: '', depthM: '', individuals: '', kelpCoverPct: '', notes: '' }); }}>
              Cargar otro
            </Boton>
            <Boton variante="linea" onClick={() => navegar('/app')}>Ver el mapa</Boton>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-6 lg:px-8">
      <h1 className="font-display text-2xl font-600">Reportar</h1>
      <p className="mt-1.5 text-sm text-tinta">
        Qué viste y dónde. El resto es opcional.
      </p>

      <form onSubmit={enviar} className="mt-6 space-y-5">
        {/* Tipo: lo primero y lo más grande */}
        <div>
          <span className="mb-2 block text-sm font-500">¿Qué viste?</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.entries(TIPOS).map(([clave, { etiqueta, color }]) => (
              <button key={clave} type="button"
                onClick={() => { setKind(clave); setForm({ ...form, speciesId: '' }); }}
                className={`rounded-carta border px-3 py-3 text-sm font-500 transition-colors ${
                  kind === clave ? 'font-600 text-abismo' : 'border-trazo hover:bg-papel'}`}
                style={kind === clave ? { backgroundColor: color, borderColor: color } : undefined}>
                {etiqueta}
              </button>
            ))}
          </div>
        </div>

        <Campo etiqueta="Zona" requerido>
          <Selector value={zonaSlug} onChange={(e) => { setZonaSlug(e.target.value); setPunto(null); }}>
            {(zonas?.zonas ?? []).map((z) => (
              <option key={z.slug} value={z.slug}>{z.name}</option>
            ))}
          </Selector>
        </Campo>

        {/* Ubicación */}
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-sm font-500">¿Dónde? <span className="text-alerta">*</span></span>
            <button type="button" onClick={usarGps}
                    className="inline-flex items-center gap-1.5 text-sm underline underline-offset-4 hover:text-kelp">
              <Crosshair size={14} /> Usar mi ubicación
            </button>
          </div>
          <MapaZona zona={zonaData?.zona}
                    avistamientos={punto ? [{
                      id: 'nuevo', kind, lat: punto.lat, lng: punto.lng,
                      status: 'verificado', observed_at: new Date().toISOString(),
                    }] : []}
                    alto={260}
                    interactivo={false}
                    onClickMapa={setPunto} />
          <p className="mt-2 text-xs text-tinta/70">
            {punto
              ? <span className="cifra">{punto.lat.toFixed(5)}, {punto.lng.toFixed(5)}</span>
              : 'Tocá el mapa para marcar el punto'}
            {gps === 'buscando' && ' · buscando tu ubicación…'}
          </p>
          {gps && gps !== 'buscando' && <p className="mt-1 text-xs text-alerta">{gps}</p>}
        </div>

        {especiesDelTipo.length > 0 && (
          <Campo etiqueta="Especie" ayuda="Si no estás seguro, dejalo en blanco y que decida la comunidad">
            <Selector value={form.speciesId} onChange={(e) => setForm({ ...form, speciesId: e.target.value })}>
              <option value="">No sé / no figura</option>
              {especiesDelTipo.map((e) => (
                <option key={e.id} value={e.id}>{e.common_name} — {e.scientific_name}</option>
              ))}
            </Selector>
          </Campo>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Profundidad" ayuda="En metros">
            <Entrada type="number" step="0.1" min="0" value={form.depthM}
                     onChange={(e) => setForm({ ...form, depthM: e.target.value })} />
          </Campo>

          {kind === 'kelp' ? (
            <Campo etiqueta="Cobertura de cachiyuyo" requerido ayuda="Qué porcentaje del fondo cubre">
              <Entrada type="number" step="1" min="0" max="100" required value={form.kelpCoverPct}
                       onChange={(e) => setForm({ ...form, kelpCoverPct: e.target.value })} />
            </Campo>
          ) : (
            <Campo etiqueta="Cuántos" ayuda="Cantidad de individuos">
              <Entrada type="number" step="1" min="1" value={form.individuals}
                       onChange={(e) => setForm({ ...form, individuals: e.target.value })} />
            </Campo>
          )}
        </div>

        <Campo etiqueta="Notas" ayuda="Visibilidad, comportamiento, cualquier cosa que ayude a validarlo">
          <Area value={form.notes} maxLength={1000}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Campo>

        {error && <CajaError error={error} />}

        <Boton type="submit" variante="kelp" className="w-full" cargando={enviando}>
          Enviar reporte
        </Boton>
        {reglas && (
          <p className="text-center text-xs text-tinta/70">
            Reporte básico: {reglas.premios.reporte_basico > 0 ? `+${reglas.premios.reporte_basico}` : 0} OKN.
            Si queda verificado, +{reglas.premios.foto_verificada} OKN.{' '}
            <Link to="/app/tokens" className="underline underline-offset-4 hover:text-kelp">Cómo funciona</Link>
          </p>
        )}
      </form>
    </div>
  );
}

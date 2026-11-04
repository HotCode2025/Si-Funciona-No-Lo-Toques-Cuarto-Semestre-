import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Check, Info, MapPin, Sparkles, TriangleAlert, X } from 'lucide-react';
import { analizarFoto, iaConfigurada } from '../../services/ia.js';
import { Boton, Selector } from '../ui/index.jsx';

const pct = (x) => `${Math.round(x * 100)}%`;

/**
 * Foto -> la IA propone qué es, vos confirmás o corregís. Lo que confirmás es lo que aprende el modelo.
 * Nunca decide sola: la sugerencia es un punto de partida, no un dato verificado.
 */
export default function AnalisisFoto({ taxonomia, onChange, onUsarUbicacion }) {
  const entrada = useRef(null);
  const [archivoUrl, setArchivoUrl] = useState(null);
  const [fase, setFase] = useState('vacio');          // vacio | analizando | listo | error
  const [res, setRes] = useState(null);
  const [error, setError] = useState(null);
  const [elegida, setElegida] = useState(null);       // id de la especie confirmada ('ninguna' incluido)
  const [corrigiendo, setCorrigiendo] = useState(false);

  useEffect(() => () => archivoUrl && URL.revokeObjectURL(archivoUrl), [archivoUrl]);

  const emitir = (r, claseId) => {
    const t = (taxonomia ?? []).find((x) => x.id === claseId);
    const sug = r?.prediccion?.clase?.id ?? null;
    onChange?.(r && {
      fotoId: r.id, imagen: r.imagen, claseId: claseId && claseId !== 'ninguna' ? claseId : null, etiqueta: claseId ?? null,
      tipo: t?.tipo, cientifico: t?.cientifico, nombre: t?.nombre, sugeridaId: sug,
      puedeAuto: Boolean(r.puede_autoverificar && claseId && claseId === sug), confianza: r.prediccion?.confianza,
    });
  };

  const elegirArchivo = async (e) => {
    const archivo = e.target.files?.[0]; if (!archivo) return;
    setArchivoUrl(URL.createObjectURL(archivo)); setFase('analizando'); setError(null); setRes(null); setElegida(null); setCorrigiendo(false); onChange?.(null);
    try {
      const r = await analizarFoto(archivo); setRes(r); setFase('listo'); emitir(r, null);
    } catch (err) { setError(err); setFase('error'); }
    e.target.value = '';
  };
  const quitar = () => { setArchivoUrl(null); setFase('vacio'); setRes(null); setElegida(null); setCorrigiendo(false); onChange?.(null); };
  const elegir = (id) => { setElegida(id); setCorrigiendo(false); emitir(res, id); };

  if (!iaConfigurada()) {
    return (
      <p className="flex items-start gap-2 rounded-carta border border-trazo px-3.5 py-3 text-sm text-tinta/80">
        <Info size={16} className="mt-0.5 shrink-0" /> El análisis de fotos con IA todavía no está conectado en esta versión. Podés reportar igual.
      </p>
    );
  }

  const p = res?.prediccion; const nombreDe = (id) => id === 'ninguna' ? 'Ninguna de estas' : (taxonomia ?? []).find((t) => t.id === id)?.nombre ?? id;
  const confirmada = elegida && elegida !== 'ninguna';

  return (
    <div>
      <span className="mb-2 flex items-center gap-1.5 text-sm font-500">
        <Sparkles size={14} className="text-kelp" /> Foto <span className="text-xs font-400 text-tinta/60">· opcional, la IA te ayuda a identificar</span>
      </span>
      <input ref={entrada} type="file" accept="image/*" onChange={elegirArchivo} className="hidden" aria-label="Subir una foto" />

      {fase === 'vacio' && (
        <button type="button" onClick={() => entrada.current?.click()}
          className="group flex w-full flex-col items-center gap-2 rounded-carta border border-dashed border-sonda/60 px-4 py-8 text-sm text-tinta transition-colors hover:border-kelp hover:bg-papel">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-kelp/15 text-kelp transition-transform duration-500 group-hover:scale-110"><Camera size={20} /></span>
          <span className="font-500">Sacá o subí una foto</span>
          <span className="max-w-xs text-center text-xs text-tinta/60">La foto se guarda para ayudar a que el modelo aprenda. No incluye tu ubicación.</span>
        </button>
      )}

      {fase !== 'vacio' && (
        <div className="overflow-hidden rounded-carta border border-trazo">
          <div className="relative">
            <img src={archivoUrl} alt="Tu foto" className="max-h-72 w-full object-cover" />
            {fase === 'analizando' && <div className="escaneo" aria-hidden="true" />}
            {fase === 'analizando' && <p className="absolute inset-x-0 bottom-0 bg-linear-to-t from-abismo/90 to-transparent px-4 pt-8 pb-3 text-sm text-carta">Analizando la foto…</p>}
            <button type="button" onClick={quitar} aria-label="Quitar foto"
              className="absolute top-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-abismo/70 text-carta backdrop-blur transition-colors hover:bg-abismo"><X size={16} /></button>
          </div>

          {fase === 'error' && (
            <p className="flex items-start gap-2 px-4 py-3 text-sm text-alerta"><TriangleAlert size={16} className="mt-0.5 shrink-0" /> {error?.message}</p>
          )}

          {fase === 'listo' && res && (
            <div className="resultado-ia space-y-3 px-4 py-4">
              {res.calidad.problemas.map((t) => (
                <p key={t} className="flex items-start gap-2 text-sm text-alerta"><TriangleAlert size={15} className="mt-0.5 shrink-0" /> {t}</p>
              ))}
              {res.duplicado && (
                <p className="flex items-start gap-2 text-sm text-alerta"><TriangleAlert size={15} className="mt-0.5 shrink-0" /> Parece una foto que ya se subió antes.</p>
              )}
              {res.exif?.lat != null && onUsarUbicacion && (
                <button type="button" onClick={() => onUsarUbicacion({ lat: res.exif.lat, lng: res.exif.lng })}
                  className="inline-flex items-center gap-1.5 text-sm underline underline-offset-4 hover:text-kelp"><MapPin size={14} /> La foto trae ubicación: usarla en el mapa</button>
              )}

              {confirmada || elegida === 'ninguna' ? (
                <div className="flex items-center justify-between gap-3 rounded-carta bg-alga/10 px-3 py-2.5 text-sm">
                  <span className="inline-flex items-center gap-2 text-alga"><Check size={16} /> {elegida === 'ninguna' ? 'Marcaste que no es ninguna de las especies' : <>Confirmaste: <b className="font-600">{nombreDe(elegida)}</b></>}</span>
                  <button type="button" className="text-xs underline underline-offset-4" onClick={() => { setElegida(null); setCorrigiendo(true); emitir(res, null); }}>Cambiar</button>
                </div>
              ) : (
                <>
                  {p.estado === 'sugerida' && (
                    <div>
                      <p className="text-xs tracking-wide text-tinta/60 uppercase">La IA sugiere</p>
                      <p className="mt-1 font-display text-xl font-600">{p.clase.nombre}</p>
                      {p.clase.cientifico && <p className="text-sm italic text-tinta/70">{p.clase.cientifico}</p>}
                      <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-tinta/70">
                        <span className="cifra rounded-full bg-kelp/15 px-2 py-0.5 font-600 text-kelp">{pct(p.confianza)}</span>
                        {!p.validada && <span title="Todavía no se pudo medir su precisión con fotos de distintos eventos">Modelo en aprendizaje: confirmalo vos</span>}
                      </p>
                      <div className="mt-3 flex gap-2">
                        <Boton type="button" variante="kelp" className="flex-1" onClick={() => elegir(p.clase.id)}><Check size={15} /> Es correcto</Boton>
                        <Boton type="button" variante="linea" className="flex-1" onClick={() => setCorrigiendo(true)}>No, es otra</Boton>
                      </div>
                    </div>
                  )}
                  {p.estado === 'incierta' && (
                    <div>
                      <p className="font-500">No estoy seguro. ¿Será alguna de estas?</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {p.alternativas.map((a) => (
                          <button key={a.id} type="button" onClick={() => elegir(a.id)}
                            className="rounded-full border border-trazo px-3 py-1.5 text-sm transition-colors hover:border-kelp hover:bg-kelp/10">{a.nombre} <span className="cifra text-xs text-tinta/60">{pct(a.confianza)}</span></button>
                        ))}
                      </div>
                    </div>
                  )}
                  {(p.estado === 'desconocida' || p.estado === 'sin_modelo') && (
                    <div>
                      <p className="font-500">Todavía no reconozco esto.</p>
                      {res.pista_general && <p className="mt-1 text-sm text-tinta/80">Pista general: parece un {res.pista_general.nombre}.</p>}
                      {p.sugerencia_base && (
                        <button type="button" onClick={() => elegir(p.sugerencia_base.clase.id)}
                          className="mt-2 rounded-full border border-trazo px-3 py-1.5 text-sm hover:border-kelp hover:bg-kelp/10">¿Será {p.sugerencia_base.clase.nombre.toLowerCase()}?</button>
                      )}
                      <p className="mt-2 text-xs text-tinta/60">Si me decís qué es, la IA aprende de tu foto.</p>
                    </div>
                  )}
                  {(corrigiendo || p.estado === 'desconocida' || p.estado === 'sin_modelo' || p.estado === 'incierta') && (
                    <Selector value="" onChange={(e) => e.target.value && elegir(e.target.value)} aria-label="Elegir la especie">
                      <option value="">{p.estado === 'incierta' ? 'Otra especie…' : '¿Qué es?'}</option>
                      {(taxonomia ?? []).map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                      <option value="ninguna">Ninguna de estas</option>
                    </Selector>
                  )}
                </>
              )}
              <Link to="/app/ia" className="inline-block text-xs text-sonda underline underline-offset-4 hover:text-kelp">Cómo aprende la IA</Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

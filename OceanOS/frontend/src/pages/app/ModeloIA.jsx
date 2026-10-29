import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { estadoEntrenamiento, estadoModelo, iaConfigurada, reentrenar } from '../../services/ia.js';
import { Boton, Cargando, CajaError, Etiqueta, Panel } from '../../components/ui/index.jsx';
import { numero } from '../../utils/format.js';

/** Qué sabe la IA hoy, con qué fotos aprendió y cómo se reentrena. Sin maquillaje: muestra lo que no se pudo validar. */
export default function ModeloIA() {
  const [m, setM] = useState(null); const [error, setError] = useState(null);
  const [token, setToken] = useState(''); const [msg, setMsg] = useState(null); const [trabajando, setTrabajando] = useState(false);
  const cargar = useCallback(() => estadoModelo().then(setM).catch(setError), []);
  useEffect(() => { if (iaConfigurada()) cargar(); }, [cargar]);

  const entrenar = async () => {
    setTrabajando(true); setMsg(null);
    try {
      await reentrenar(token);
      for (let i = 0; i < 90; i += 1) {
        await new Promise((r) => setTimeout(r, 1500));
        const e = await estadoEntrenamiento();
        if (e.estado !== 'entrenando') {
          setMsg(e.estado === 'listo' ? `Listo: ${e.detalle.version}. ${e.detalle.motivo}.` : typeof e.detalle === 'string' ? e.detalle : 'No se pudo entrenar.');
          break;
        }
      }
      await cargar();
    } catch (e) { setMsg(e.message); } finally { setTrabajando(false); }
  };

  if (!iaConfigurada()) return <div className="mx-auto max-w-2xl px-5 py-6"><Panel className="p-5 text-sm text-tinta">El servicio de IA no está conectado. Configurá <code>VITE_IA_URL</code> (ver <code>ia/README.md</code>).</Panel></div>;
  if (error) return <div className="mx-auto max-w-2xl px-5 py-6"><CajaError error={error} onReintentar={cargar} /></div>;
  if (!m) return <div className="mx-auto max-w-2xl px-5 py-6"><Cargando /></div>;

  const meta = m.meta; const met = meta?.metricas; const clases = m.dataset.clases;
  const nombre = (id) => m.taxonomia.find((t) => t.id === id)?.nombre ?? id;
  return (
    <div className="mx-auto max-w-2xl px-5 py-6 lg:px-8">
      <h1 className="font-display text-2xl font-600">Cómo aprende la IA</h1>
      <p className="mt-1.5 text-sm text-tinta">
        Cada foto que alguien confirma o que la comunidad verifica pasa a ser material de estudio. Cuanto más variada, mejor reconoce.
      </p>

      <Panel className="mt-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs tracking-wide text-tinta/60 uppercase">Versión activa</p>
            <p className="cifra font-display text-2xl font-600">{m.version ?? 'sin entrenar'}</p>
          </div>
          <Etiqueta color={meta?.apto_autoverificar ? 'var(--color-alga)' : 'var(--color-alerta)'}>
            {meta?.apto_autoverificar ? 'Validada' : 'En aprendizaje'}
          </Etiqueta>
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div><dt className="text-xs text-tinta/60">Fotos de estudio</dt><dd className="cifra font-600">{numero(m.dataset.fotos_con_etiqueta)}</dd></div>
          <div><dt className="text-xs text-tinta/60">Subidas por gente</dt><dd className="cifra font-600">{numero(m.dataset.fotos_de_gente)}</dd></div>
          <div><dt className="text-xs text-tinta/60">Precisión medida</dt><dd className="cifra font-600">{met ? `${Math.round(met.exactitud * 100)}%` : 'sin medir'}</dd></div>
        </dl>
        {met && met.exactitud < 0.5 && (
          <p className="mt-3 rounded-carta bg-alerta/10 px-3 py-2 text-sm text-alerta">
            Con las fotos actuales, la IA todavía no generaliza a escenas nuevas ({Math.round(met.exactitud * 100)}% de acierto al probarla con eventos que no vio). Por eso te pide confirmar siempre.
          </p>
        )}
        {!met && <p className="mt-3 text-sm text-tinta/70">La precisión no se puede medir hasta tener fotos de al menos 3 eventos distintos.</p>}
      </Panel>

      <h2 className="mt-7 font-display text-lg font-600">Qué especies conoce</h2>
      <div className="mt-3 space-y-3">
        {Object.entries(clases).map(([id, c]) => {
          const entra = Boolean(meta?.clases?.[id]); const val = meta?.clases?.[id]?.validada;
          return (
            <div key={id}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span>{nombre(id)}</span>
                <span className="cifra text-xs text-tinta/70">{c.fotos} fotos · {c.grupos} {c.grupos === 1 ? 'evento' : 'eventos'}{val ? ' · validada' : entra ? '' : ` · faltan ${Math.max(0, m.min_ejemplos - c.fotos)} para entrar`}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-trazo"><div className="barra-progreso h-full rounded-full bg-kelp" style={{ width: `${Math.min(100, (c.fotos / (m.min_ejemplos * 4)) * 100)}%` }} /></div>
            </div>
          );
        })}
      </div>

      <h2 className="mt-7 font-display text-lg font-600">Reentrenar</h2>
      <p className="mt-1 text-sm text-tinta">Entrena una versión nueva con todas las fotos etiquetadas. Solo se publica si no es peor que la actual.</p>
      <div className="mt-3 flex gap-2">
        <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Clave de administrador" aria-label="Clave de administrador"
          className="min-w-0 flex-1 rounded-carta border border-trazo bg-transparent px-3 py-2 text-sm" />
        <Boton variante="kelp" cargando={trabajando} onClick={entrenar} disabled={!token}>Entrenar ahora</Boton>
      </div>
      {msg && <p className="mt-3 text-sm text-tinta">{msg}</p>}

      <h2 className="mt-7 font-display text-lg font-600">Versiones</h2>
      <ul className="mt-2 divide-y divide-trazo text-sm">
        {m.versiones.slice().reverse().map((v) => (
          <li key={v.version} className="flex items-center justify-between py-2">
            <span className="cifra">{v.version}{v.activa && <span className="ml-2 text-kelp">activa</span>}</span>
            <span className="text-xs text-tinta/70">{v.fotos} fotos · {v.clases.length} especies</span>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-xs text-tinta/60">Las sugerencias de la IA nunca se publican solas como datos verificados. <Link to="/app/verificar" className="underline underline-offset-4">Ver la cola de verificación</Link></p>
    </div>
  );
}

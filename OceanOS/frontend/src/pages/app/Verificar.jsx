import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { useFetch } from '../../hooks/useFetch.js';
import { useReglas } from '../../hooks/useReglas.js';
import { useDemo } from '../../contexts/DemoContext.jsx';
import { api } from '../../services/api.js';
import { Panel, Boton, Cargando, CajaError, Etiqueta, Vacio } from '../../components/ui/index.jsx';
import { numero, hace, TIPOS } from '../../utils/format.js';

/**
 * Cola de verificación: reportes donde el modelo quedó por debajo del 80%
 * de confianza. Tres votos ponderados por reputación los resuelven.
 */
export default function Verificar() {
  const { refrescar } = useDemo();
  const reglas = useReglas();
  const { data, error, loading, recargar } = useFetch('/avistamientos/cola/verificacion');
  const [votando, setVotando] = useState(null);
  const [falla, setFalla] = useState(null);
  const [resueltos, setResueltos] = useState({});

  const votar = async (id, agrees) => {
    setVotando(id);
    setFalla(null);
    try {
      const r = await api.post(`/avistamientos/${id}/voto`, { agrees });
      setResueltos((prev) => ({ ...prev, [id]: r }));
      refrescar();
    } catch (e) {
      setFalla(e);
    } finally {
      setVotando(null);
    }
  };

  if (loading) return <div className="mx-auto max-w-2xl px-5 py-6"><Cargando /></div>;

  const cola = data?.cola ?? [];

  return (
    <div className="mx-auto max-w-2xl px-5 py-6 lg:px-8">
      <h1 className="font-display text-2xl font-600">Verificar</h1>
      <p className="mt-1.5 text-sm text-tinta">
        Reportes que el clasificador no pudo resolver solo. Tu voto pesa según tu reputación
        {reglas ? `, y suma ${reglas.premios.voto_comunidad} OKN.` : '.'}{' '}
        <Link to="/app/tokens" className="text-sonda underline underline-offset-4 hover:text-kelp">
          Cómo funciona la votación
        </Link>
      </p>

      {error && <div className="mt-4"><CajaError error={error} onReintentar={recargar} /></div>}
      {falla && <div className="mt-4"><CajaError error={falla} /></div>}

      {cola.length === 0 ? (
        <Panel className="mt-6">
          <Vacio titulo="No queda nada por verificar"
                 detalle="Cuando alguien cargue un reporte que la IA no pueda clasificar, aparece acá." />
        </Panel>
      ) : (
        <div className="mt-6 space-y-4">
          {cola.map((a) => {
            const resuelto = resueltos[a.id];
            return (
              <Panel key={a.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Etiqueta color={TIPOS[a.kind]?.color}>{TIPOS[a.kind]?.etiqueta}</Etiqueta>
                    <p className="mt-2 font-display text-lg font-600">
                      {a.common_name ?? 'Sin clasificar'}
                    </p>
                    {a.scientific_name && (
                      <p className="text-sm italic text-tinta/70">{a.scientific_name}</p>
                    )}
                  </div>
                  {a.ai_confidence != null && (
                    <div className="text-right">
                      <p className="cifra font-display text-xl font-600 text-alerta">
                        {numero(a.ai_confidence * 100, 0)}%
                      </p>
                      <p className="text-xs text-tinta/70">confianza IA</p>
                    </div>
                  )}
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                  <div><dt className="text-xs text-tinta/70">Zona</dt><dd>{a.zone_name}</dd></div>
                  <div><dt className="text-xs text-tinta/70">Profundidad</dt>
                       <dd className="cifra">{a.depth_m != null ? `−${a.depth_m} m` : '—'}</dd></div>
                  <div><dt className="text-xs text-tinta/70">Reportó</dt><dd>{a.reporter_name}</dd></div>
                  <div><dt className="text-xs text-tinta/70">Cuándo</dt><dd>{hace(a.observed_at)}</dd></div>
                </dl>

                {a.notes && (
                  <p className="mt-3 border-l-2 border-trazo pl-3 text-sm text-tinta">{a.notes}</p>
                )}

                {!resuelto && a.votos_emitidos != null && (
                  <p className="mt-4 text-xs text-tinta/70">
                    <span className="cifra">{a.votos_emitidos} de 3</span> votos
                    {a.votos_emitidos === 2 && <span className="text-kelp"> · tu voto lo resuelve</span>}
                  </p>
                )}

                {resuelto ? (
                  <p className="mt-4 rounded-carta bg-alga/10 px-3 py-2.5 text-sm text-alga">
                    Voto registrado (+{resuelto.tokensGanados} OKN).
                    {resuelto.resuelto
                      ? ` Con ${resuelto.votos} votos el reporte quedó ${resuelto.resuelto}.`
                      : ` Van ${resuelto.votos} de 3 votos.`}
                  </p>
                ) : (
                  <div className="mt-4 flex gap-2">
                    <Boton variante="linea" className="flex-1" cargando={votando === a.id}
                           onClick={() => votar(a.id, true)}>
                      <ThumbsUp size={15} /> Coincido
                    </Boton>
                    <Boton variante="linea" className="flex-1" cargando={votando === a.id}
                           onClick={() => votar(a.id, false)}>
                      <ThumbsDown size={15} /> No es eso
                    </Boton>
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}

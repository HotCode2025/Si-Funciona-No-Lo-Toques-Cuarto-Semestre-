import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Radio, WifiOff } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useFetch } from '../../hooks/useFetch.js';
import { useOrg } from '../../hooks/useOrg.js';
import { Panel, Boton, Cargando, CajaError, Etiqueta, Selector, Vacio } from '../../components/ui/index.jsx';
import { numero, fecha, fechaCorta, PLANES } from '../../utils/format.js';

const METRICAS = {
  temperatura: { label: 'Temperatura', color: 'var(--color-alerta)' },
  salinidad:   { label: 'Salinidad',   color: 'var(--color-tinta)' },
  biomasa:     { label: 'Biomasa',     color: 'var(--color-kelp)' },
  turbidez:    { label: 'Turbidez',    color: 'var(--color-sonda)' },
  oxigeno:     { label: 'Oxígeno',     color: 'var(--color-alga)' },
  ph:          { label: 'pH',          color: 'var(--color-abismo)' },
};

export default function Sensores() {
  const org = useOrg();
  const { data, error, loading, recargar } = useFetch(
    org ? `/organizaciones/${org.id}/sensores` : null, [org?.id],
  );
  const [metrica, setMetrica] = useState('temperatura');

  // El plan sin IoT recibe un 403 del backend. No es un error a mostrar
  // como falla: es información sobre el plan.
  if (error?.code === 'FORBIDDEN') {
    return (
      <div className="mx-auto max-w-2xl px-5 py-12">
        <Panel className="p-8 text-center">
          <Radio size={28} className="mx-auto text-tinta/50" />
          <h1 className="mt-4 font-display text-xl font-600">El monitoreo IoT no entra en tu plan</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-tinta">
            Tu organización está en el plan {PLANES[org.plan]}. Los sensores de temperatura,
            salinidad y biomasa vienen desde Professional, junto con los informes automáticos
            para fondos.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Boton variante="kelp">Ver planes</Boton>
            <Link to="/panel"><Boton variante="linea">Volver al resumen</Boton></Link>
          </div>
        </Panel>
      </div>
    );
  }

  if (loading) return <div className="mx-auto max-w-4xl px-5 py-6"><Cargando /></div>;
  if (error)   return <div className="mx-auto max-w-4xl px-5 py-6"><CajaError error={error} onReintentar={recargar} /></div>;

  const sensores = data?.sensores ?? [];
  const series = data?.series ?? [];

  return <Contenido sensores={sensores} series={series} metrica={metrica} setMetrica={setMetrica} />;
}

function Contenido({ sensores, series, metrica, setMetrica }) {
  // Se arma un punto por día con una columna por sensor, que es lo que
  // recharts necesita para dibujar varias líneas sobre el mismo eje.
  const datos = useMemo(() => {
    const porDia = new Map();
    for (const p of series) {
      if (p.metric !== metrica) continue;
      const dia = p.dia.slice(0, 10);
      if (!porDia.has(dia)) porDia.set(dia, { dia: fechaCorta(p.dia) });
      porDia.get(dia)[p.sensor_id] = Number(p.valor);
    }
    return [...porDia.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [series, metrica]);

  const unidad = series.find((p) => p.metric === metrica)?.unit ?? '';
  const enLinea = sensores.filter((s) => s.is_online);

  return (
    <div className="mx-auto max-w-4xl px-5 py-6 lg:px-8">
      <h1 className="font-display text-2xl font-600">Sensores</h1>
      <p className="mt-1 text-sm text-tinta/80">
        {enLinea.length} de {sensores.length} en línea · lecturas de los últimos 30 días
      </p>

      {sensores.length === 0 ? (
        <Panel className="mt-6">
          <Vacio titulo="Todavía no hay sensores instalados"
                 detalle="Los sensores se asocian a las zonas donde tenés proyectos abiertos." />
        </Panel>
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {sensores.map((s) => (
              <Panel key={s.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-500">{s.label}</p>
                    <p className="text-xs text-tinta/70">
                      <span className="cifra">{s.code}</span> · {s.zone_name}
                      {s.depth_m != null && <> · <span className="cifra">−{s.depth_m} m</span></>}
                    </p>
                    {s.project_name && (
                      <p className="mt-1 text-xs text-tinta/70">{s.project_name}</p>
                    )}
                  </div>
                  {s.is_online
                    ? <Etiqueta color="var(--color-alga)">En línea</Etiqueta>
                    : <Etiqueta color="var(--color-alerta)"><WifiOff size={11} /> Caído</Etiqueta>}
                </div>
                {s.installed_on && (
                  <p className="mt-2 text-xs text-tinta/60">Instalado {fecha(s.installed_on)}</p>
                )}
              </Panel>
            ))}
          </div>

          <section className="mt-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-600">Series de medición</h2>
              <Selector value={metrica} onChange={(e) => setMetrica(e.target.value)} className="max-w-48">
                {Object.entries(METRICAS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </Selector>
            </div>

            <Panel className="mt-4 p-4">
              {datos.length === 0 ? (
                <Vacio titulo="Sin lecturas de esta métrica"
                       detalle="Probá con otra métrica o revisá que los sensores estén reportando." />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                    <CartesianGrid stroke="var(--color-trazo)" strokeDasharray="3 6" vertical={false} />
                    <XAxis dataKey="dia" tick={{ fontSize: 11, fill: 'var(--color-tinta)' }}
                           stroke="var(--color-trazo)" minTickGap={24} />
                    <YAxis unit={unidad ? ` ${unidad}` : ''} domain={['auto', 'auto']}
                           tick={{ fontSize: 11, fill: 'var(--color-tinta)' }}
                           stroke="var(--color-trazo)" width={64} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--color-abismo)', border: 'none',
                        borderRadius: 3, color: 'var(--color-carta)', fontSize: 12,
                      }}
                      formatter={(v, id) => [
                        `${numero(v, 2)} ${unidad}`,
                        sensores.find((s) => s.id === id)?.code ?? id,
                      ]} />
                    {enLinea.map((s, i) => (
                      <Line key={s.id} type="monotone" dataKey={s.id}
                            stroke={[
                              'var(--color-kelp)', 'var(--color-alga)',
                              'var(--color-tinta)', 'var(--color-alerta)',
                            ][i % 4]}
                            strokeWidth={1.8} dot={false} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Panel>

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-tinta/80">
              {enLinea.map((s, i) => (
                <span key={s.id} className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: ['var(--color-kelp)', 'var(--color-alga)',
                          'var(--color-tinta)', 'var(--color-alerta)'][i % 4] }} />
                  <span className="cifra">{s.code}</span> {s.label}
                </span>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

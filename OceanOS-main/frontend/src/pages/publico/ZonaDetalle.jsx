import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useFetch } from '../../hooks/useFetch.js';
import MapaZona, { LeyendaMapa } from '../../components/mapa/MapaZona.jsx';
import { Panel, Barra, Cargando, CajaError, Etiqueta, Sonda, Vacio } from '../../components/ui/index.jsx';
import { numero, colorSalud, fechaCorta, TIPOS, ESTADO_PROYECTO } from '../../utils/format.js';

export default function ZonaDetalle() {
  const { slug } = useParams();
  const { data, error, loading, recargar } = useFetch(`/ecosistema/zonas/${slug}`, [slug]);
  const { data: avist } = useFetch(`/avistamientos?zone=${slug}&limite=200`, [slug]);

  if (loading) return <div className="mx-auto max-w-5xl px-5 py-10"><Cargando /></div>;
  if (error)   return <div className="mx-auto max-w-5xl px-5 py-10"><CajaError error={error} onReintentar={recargar} /></div>;

  const z = data.zona;
  const serie = (z.serie_kelp ?? []).map((p) => ({
    semana: fechaCorta(p.semana), cobertura: Number(p.cobertura), reportes: p.reportes,
  }));

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 lg:px-10">
      <Link to="/ecosistema" className="inline-flex items-center gap-1.5 text-sm text-tinta hover:text-kelp">
        <ArrowLeft size={14} /> Todas las zonas
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-600">{z.name}</h1>
          <p className="mt-1 text-sm text-tinta/80">
            {z.province} · {numero(z.area_km2)} km²{z.is_protected && ' · área protegida'}
          </p>
        </div>
        <div className="text-right">
          <p className="cifra font-display text-4xl font-600" style={{ color: colorSalud(z.health_index) }}>
            {numero(z.health_index, 1)}
          </p>
          <p className="text-sm text-tinta/70">índice de salud</p>
        </div>
      </div>

      <div className="mt-6">
        <MapaZona zona={z} avistamientos={avist?.avistamientos ?? []} alto={380} />
        <LeyendaMapa className="mt-3" />
      </div>

      <div className="mt-8 grid grid-cols-2 gap-6 border-y border-trazo py-6 lg:grid-cols-4">
        <Sonda valor={`${numero(z.kelp_cobertura_pct, 1)}%`} rotulo="cobertura de cachiyuyo" color="var(--color-kelp)" />
        <Sonda valor={z.avistamientos_tiburon} rotulo="tiburones en 90 días" />
        <Sonda valor={z.amenazas_abiertas} rotulo="amenazas abiertas"
               color={z.amenazas_abiertas ? 'var(--color-alerta)' : undefined} />
        <Sonda valor={(avist?.avistamientos ?? []).length} rotulo="reportes en el mapa" />
      </div>

      {serie.length > 1 && (
        <section className="mt-10">
          <h2 className="font-display text-xl font-600">Cobertura de cachiyuyo</h2>
          <p className="mt-1 text-sm text-tinta/80">Promedio semanal de los reportes verificados, últimos 180 días.</p>
          <Panel className="mt-4 p-4">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={serie} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid stroke="var(--color-trazo)" strokeDasharray="3 6" vertical={false} />
                <XAxis dataKey="semana" tick={{ fontSize: 11, fill: 'var(--color-tinta)' }}
                       stroke="var(--color-trazo)" />
                <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: 'var(--color-tinta)' }}
                       stroke="var(--color-trazo)" />
                <Tooltip
                  contentStyle={{
                    background: 'var(--color-abismo)', border: 'none', borderRadius: 3,
                    color: 'var(--color-carta)', fontSize: 12,
                  }}
                  formatter={(v, n) => n === 'cobertura' ? [`${v}%`, 'Cobertura'] : [v, 'Reportes']} />
                <Line type="monotone" dataKey="cobertura" stroke="var(--color-kelp)"
                      strokeWidth={2} dot={{ r: 2.5 }} />
              </LineChart>
            </ResponsiveContainer>
          </Panel>
        </section>
      )}

      <div className="mt-10 grid gap-8 md:grid-cols-2">
        <section>
          <h2 className="font-display text-xl font-600">Especies registradas</h2>
          {z.especies?.length ? (
            <div className="mt-4 divide-y divide-trazo border-y border-trazo">
              {z.especies.map((e) => (
                <div key={e.scientific_name} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-500">{e.common_name}</p>
                    <p className="text-xs italic text-tinta/70">{e.scientific_name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {e.iucn_status && <Etiqueta color={TIPOS[e.kind]?.color}>{e.iucn_status}</Etiqueta>}
                    <span className="cifra text-sm">{e.avistamientos}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : <Panel className="mt-4"><Vacio titulo="Todavía no hay especies verificadas acá"
                 detalle="Los primeros reportes verificados van a aparecer en esta lista." /></Panel>}
        </section>

        <section>
          <h2 className="font-display text-xl font-600">Proyectos de restauración</h2>
          {z.proyectos?.length ? (
            <div className="mt-4 space-y-3">
              {z.proyectos.map((p) => (
                <Panel key={p.project_id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-500">{p.name}</p>
                      <p className="text-xs text-tinta/70">{p.org_name}</p>
                    </div>
                    <Etiqueta>{ESTADO_PROYECTO[p.status]}</Etiqueta>
                  </div>
                  {p.target_hectares > 0 && (
                    <div className="mt-3">
                      <Barra valor={p.avance_pct ?? 0} />
                      <p className="mt-1.5 text-xs text-tinta/70">
                        {numero(p.hectares, 1)} de {numero(p.target_hectares, 1)} ha
                        {p.tco2_certificado > 0 && ` · ${numero(p.tco2_certificado)} tCO₂e certificadas`}
                      </p>
                    </div>
                  )}
                </Panel>
              ))}
            </div>
          ) : <Panel className="mt-4"><Vacio titulo="Sin proyectos en esta zona"
                 detalle="Ninguna organización abrió todavía un proyecto de restauración acá." /></Panel>}
        </section>
      </div>
    </div>
  );
}

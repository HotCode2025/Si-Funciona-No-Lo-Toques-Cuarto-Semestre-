import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useFetch } from '../../hooks/useFetch.js';
import { useOrg } from '../../hooks/useOrg.js';
import { Panel, Barra, Cargando, CajaError, Etiqueta, Sonda, Vacio } from '../../components/ui/index.jsx';
import { numero, colorSalud, fecha, hace, TIPO_ORG } from '../../utils/format.js';

export default function Resumen() {
  const org = useOrg();
  const { data, error, loading, recargar } = useFetch(
    org ? `/organizaciones/${org.id}/panel` : null, [org?.id],
  );

  if (loading) return <div className="mx-auto max-w-4xl px-5 py-6"><Cargando /></div>;
  if (error)   return <div className="mx-auto max-w-4xl px-5 py-6"><CajaError error={error} onReintentar={recargar} /></div>;

  const { resumen, carbono, zonas, alertas, hitosProximos } = data;
  const vencido = (iso) => iso && new Date(iso) < new Date();

  return (
    <div className="mx-auto max-w-4xl px-5 py-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-600">{org.name}</h1>
          <p className="mt-1 text-sm text-tinta/80">{TIPO_ORG[org.kind]}</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-6 border-y border-trazo py-6 lg:grid-cols-4">
        <Sonda valor={resumen.proyectos} rotulo={`proyectos · ${resumen.en_curso} en curso`} />
        <Sonda valor={numero(resumen.hectareas, 1)} unidad="ha" rotulo="en restauración" color="var(--color-kelp)" />
        <Sonda valor={numero(carbono.certificado)} unidad="tCO₂e" rotulo="carbono certificado" color="var(--color-alga)" />
        <Sonda valor={numero(carbono.en_validacion)} unidad="tCO₂e" rotulo="en validación" />
      </div>

      {resumen.hectareas_objetivo > 0 && (
        <div className="mt-6">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-500">Avance sobre el objetivo</span>
            <span className="cifra text-tinta/80">
              {numero(resumen.hectareas, 1)} de {numero(resumen.hectareas_objetivo, 1)} ha
            </span>
          </div>
          <div className="mt-2">
            <Barra valor={resumen.hectareas} max={resumen.hectareas_objetivo} />
          </div>
        </div>
      )}

      {/* Salud de las zonas donde la organización trabaja */}
      <section className="mt-10">
        <h2 className="font-display text-lg font-600">Tus zonas</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {zonas.map((z) => (
            <Link key={z.zone_id} to={`/ecosistema/${z.slug}`}>
              <Panel className="p-4 transition-colors hover:border-kelp">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-500">{z.name}</p>
                  <span className="cifra font-display text-2xl font-600"
                        style={{ color: colorSalud(z.health_index) }}>
                    {numero(z.health_index, 1)}
                  </span>
                </div>
                <div className="mt-2"><Barra valor={z.health_index} color={colorSalud(z.health_index)} alto={4} /></div>
                <p className="mt-2 text-xs text-tinta/70">
                  cachiyuyo {numero(z.kelp_cobertura_pct, 1)}% · {z.avistamientos_tiburon} tiburones
                  {z.amenazas_abiertas > 0 && ` · ${z.amenazas_abiertas} amenazas`}
                </p>
              </Panel>
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-10 grid gap-8 md:grid-cols-2">
        {/* Alertas: amenazas reportadas por la comunidad en tus zonas.
            Este es el valor concreto que la Capa 1 le entrega a la Capa 2. */}
        <section>
          <h2 className="font-display text-lg font-600">Amenazas reportadas</h2>
          <p className="mt-1 text-sm text-tinta/80">
            Lo que la comunidad vio en tus zonas en los últimos 90 días.
          </p>
          {alertas.length ? (
            <div className="mt-3 space-y-2">
              {alertas.map((a) => (
                <div key={a.id} className="flex gap-3 rounded-carta border border-alerta/30 bg-alerta/5 p-3">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0 text-alerta" />
                  <div className="min-w-0">
                    <p className="text-sm font-500">{a.common_name ?? 'Amenaza sin clasificar'}</p>
                    {a.notes && <p className="mt-0.5 text-sm text-tinta">{a.notes}</p>}
                    <p className="mt-1 text-xs text-tinta/70">
                      {a.zone_name} · {hace(a.observed_at)}
                      {' · '}<span className="cifra">{Number(a.lat).toFixed(4)}, {Number(a.lng).toFixed(4)}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Panel className="mt-3"><Vacio titulo="Sin amenazas activas"
              detalle="No hay reportes de redes, vertidos ni alga invasora en tus zonas." /></Panel>
          )}
        </section>

        <section>
          <h2 className="font-display text-lg font-600">Hitos pendientes</h2>
          <p className="mt-1 text-sm text-tinta/80">Lo próximo en tus proyectos.</p>
          {hitosProximos.length ? (
            <div className="mt-3 divide-y divide-trazo border-y border-trazo">
              {hitosProximos.map((h) => (
                <div key={h.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-500">{h.title}</p>
                    <p className="truncate text-xs text-tinta/70">{h.project_name}</p>
                  </div>
                  <span className={`shrink-0 text-xs ${vencido(h.due_on) ? 'text-alerta font-500' : 'text-tinta/70'}`}>
                    {h.due_on ? fecha(h.due_on) : 'sin fecha'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <Panel className="mt-3"><Vacio titulo="No quedan hitos pendientes"
              detalle="Cargá hitos en tus proyectos para seguirlos desde acá." /></Panel>
          )}
        </section>
      </div>
    </div>
  );
}

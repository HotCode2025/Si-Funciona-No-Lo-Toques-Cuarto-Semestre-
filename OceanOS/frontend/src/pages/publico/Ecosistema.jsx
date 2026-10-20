import { Link } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch.js';
import { Panel, Barra, Cargando, CajaError, Etiqueta, Sonda } from '../../components/ui/index.jsx';
import { numero, colorSalud, fecha, TIPOS } from '../../utils/format.js';

/**
 * Dashboard público de salud del ecosistema. Este es el entregable que el
 * MVP usa para mostrarle el producto a pesqueras y ONGs antes de venderles
 * el SaaS, así que es abierto y no pide cuenta.
 */
export default function Ecosistema() {
  const { data, error, loading, recargar } = useFetch('/ecosistema/zonas');
  const { data: ind } = useFetch('/ecosistema/indicadores');
  const { data: esp } = useFetch('/ecosistema/especies');
  const { data: rank } = useFetch('/ecosistema/ranking');

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 lg:px-10">
      <h1 className="font-display text-3xl font-600">Estado del océano</h1>
      <p className="mt-2 max-w-xl text-[15px] text-tinta">
        Datos abiertos de las cuatro zonas bajo monitoreo. Se recalculan con cada reporte
        verificado de la comunidad y cada lectura de sensor.
      </p>

      {ind?.indicadores && (
        <div className="mt-8 grid grid-cols-2 gap-6 border-y border-trazo py-6 lg:grid-cols-4">
          <Sonda valor={numero(ind.indicadores.salud_promedio, 1)} rotulo="salud promedio"
                 color={colorSalud(ind.indicadores.salud_promedio)} />
          <Sonda valor={numero(ind.indicadores.reportes_verificados)} rotulo="reportes verificados" />
          <Sonda valor={numero(ind.indicadores.ciudadanos)} rotulo="personas reportando" />
          <Sonda valor={numero(ind.indicadores.hectareas_en_restauracion, 1)} unidad="ha"
                 rotulo="en restauración" />
        </div>
      )}

      {loading && <Cargando />}
      {error && <div className="mt-6"><CajaError error={error} onReintentar={recargar} /></div>}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {(data?.zonas ?? []).map((z) => (
          <Link key={z.slug} to={`/ecosistema/${z.slug}`}>
            <Panel className="h-full p-5 transition-colors hover:border-kelp">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-600">{z.name}</h2>
                  <p className="text-sm text-tinta/70">
                    {numero(z.area_km2)} km²{z.is_protected && ' · protegida'}
                  </p>
                </div>
                <p className="cifra font-display text-3xl font-600"
                   style={{ color: colorSalud(z.health_index) }}>
                  {numero(z.health_index, 1)}
                </p>
              </div>

              <Barra valor={z.health_index} color={colorSalud(z.health_index)} />

              <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <dd className="cifra font-500">{numero(z.kelp_cobertura_pct, 1)}%</dd>
                  <dt className="text-xs text-tinta/70">cachiyuyo</dt>
                </div>
                <div>
                  <dd className="cifra font-500">{z.avistamientos_tiburon}</dd>
                  <dt className="text-xs text-tinta/70">tiburones</dt>
                </div>
                <div>
                  <dd className="cifra font-500" style={{ color: z.amenazas_abiertas ? 'var(--color-alerta)' : undefined }}>
                    {z.amenazas_abiertas}
                  </dd>
                  <dt className="text-xs text-tinta/70">amenazas</dt>
                </div>
              </dl>
            </Panel>
          </Link>
        ))}
      </div>

      {/* Especies bajo seguimiento */}
      <section className="mt-14">
        <h2 className="font-display text-xl font-600">Especies bajo seguimiento</h2>
        <p className="mt-1.5 text-sm text-tinta">
          Taxonomía validada con CENPAT. El estado es la categoría de la Lista Roja de la UICN.
        </p>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[540px] text-sm">
            <thead>
              <tr className="border-b border-trazo text-left text-tinta/70">
                <th className="pb-2 font-500">Especie</th>
                <th className="pb-2 font-500">Tipo</th>
                <th className="pb-2 font-500">UICN</th>
                <th className="pb-2 text-right font-500">Avistamientos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-trazo">
              {(esp?.especies ?? []).map((e) => (
                <tr key={e.id}>
                  <td className="py-2.5">
                    <span className="font-500">{e.common_name}</span>
                    <span className="block text-xs italic text-tinta/70">{e.scientific_name}</span>
                  </td>
                  <td className="py-2.5">
                    <Etiqueta color={TIPOS[e.kind]?.color}>{TIPOS[e.kind]?.etiqueta}</Etiqueta>
                  </td>
                  <td className="py-2.5">
                    <span className={e.iucn_status === 'CR' || e.iucn_status === 'EN' ? 'text-alerta font-500' : 'text-tinta/80'}>
                      {e.iucn_status ?? '—'}
                    </span>
                  </td>
                  <td className="cifra py-2.5 text-right">{e.avistamientos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Comunidad */}
      {rank?.ranking?.length > 0 && (
        <section className="mt-14">
          <h2 className="font-display text-xl font-600">Quiénes están reportando</h2>
          <div className="mt-5 divide-y divide-trazo border-y border-trazo">
            {rank.ranking.map((p, i) => (
              <div key={p.full_name} className="flex items-center gap-4 py-3">
                <span className="cifra w-6 text-sm text-tinta/60">{i + 1}</span>
                <div className="flex-1">
                  <p className="font-500">{p.full_name}</p>
                  <p className="text-xs text-tinta/70">
                    {p.reportes_verificados} de {p.reportes} verificados
                    {p.streak_days > 0 && ` · racha de ${p.streak_days} días`}
                  </p>
                </div>
                <span className="cifra text-sm font-500 text-kelp">{numero(p.balance_okn)} OKN</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

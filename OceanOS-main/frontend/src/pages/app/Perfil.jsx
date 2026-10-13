import { Link } from 'react-router-dom';
import { useDemo } from '../../contexts/DemoContext.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { useReglas } from '../../hooks/useReglas.js';
import { Panel, Sonda, Etiqueta, Barra } from '../../components/ui/index.jsx';
import { numero, fecha, PLANES } from '../../utils/format.js';

export default function Perfil() {
  const { user } = useDemo();
  const reglas = useReglas();
  const { data: rank } = useFetch('/ecosistema/ranking');

  const posicion = (rank?.ranking ?? []).findIndex((p) => p.full_name === user?.full_name);

  return (
    <div className="mx-auto max-w-2xl px-5 py-6 lg:px-8">
      <h1 className="font-display text-2xl font-600">{user?.full_name}</h1>
      <p className="mt-1 text-sm text-tinta/80">{user?.email}</p>

      <div className="mt-6 grid grid-cols-2 gap-6 border-y border-trazo py-6 lg:grid-cols-4">
        <Sonda valor={numero(user?.balance_okn)} unidad="OKN" rotulo="saldo" color="var(--color-kelp)" />
        <Sonda valor={user?.reportes ?? 0} rotulo="reportes" />
        <Sonda valor={user?.reportes_verificados ?? 0} rotulo="verificados" />
        <Sonda valor={user?.streak_days ?? 0} rotulo="días de racha" />
      </div>

      <Panel className="mt-6 p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-base font-600">Reputación</h2>
          <span className="cifra text-sm">{user?.reputation} / {reglas?.reputacion.maxima ?? 1000}</span>
        </div>
        <div className="mt-3"><Barra valor={user?.reputation ?? 0} max={reglas?.reputacion.maxima ?? 1000} /></div>
        <p className="mt-3 text-sm text-tinta">
          Tu reputación es el peso que tiene tu voto cuando validás reportes de otros.
          {reglas && ` Sube ${reglas.reputacion.subeSiVerificado} puntos cada vez que un reporte tuyo queda verificado por la comunidad, y baja ${reglas.reputacion.bajaSiRechazado} si lo rechaza.`}
        </p>
        <Link to="/app/tokens" className="mt-2 inline-block text-sm text-sonda underline underline-offset-4 hover:text-kelp">
          Cómo funcionan los tokens, las rachas y la reputación
        </Link>
      </Panel>

      <dl className="mt-6 space-y-3 text-sm">
        {[
          ['Zona de referencia', user?.home_zone_name ?? 'Sin definir'],
          ['En OceanOS desde', fecha(user?.created_at)],
          posicion >= 0 && ['Posición en la comunidad', `#${posicion + 1}`],
        ].filter(Boolean).map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 border-b border-trazo pb-3">
            <dt className="text-tinta/70">{k}</dt>
            <dd className="font-500">{v}</dd>
          </div>
        ))}
      </dl>

      {user?.organizaciones?.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-lg font-600">Tus organizaciones</h2>
          <div className="mt-3 space-y-2">
            {user.organizaciones.map((o) => (
              <Link key={o.id} to="/panel">
                <Panel className="flex items-center justify-between gap-3 p-4 transition-colors hover:border-kelp">
                  <div>
                    <p className="font-500">{o.name}</p>
                    <p className="text-xs text-tinta/70">
                      {o.isOwner ? 'Titular' : 'Miembro'} · plan {PLANES[o.plan]}
                    </p>
                  </div>
                  <Etiqueta color="var(--color-kelp)">Abrir panel</Etiqueta>
                </Panel>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

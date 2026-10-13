import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch.js';
import { Panel, Barra, Cargando, CajaError, Etiqueta, Sonda, Vacio } from '../../components/ui/index.jsx';
import { numero, dolares, TIPO_ACTIVO } from '../../utils/format.js';

const FILTROS = [
  { valor: '',                  etiqueta: 'Todo' },
  { valor: 'credito_carbono',   etiqueta: 'Carbono azul' },
  { valor: 'hectarea_viva',     etiqueta: 'Hectáreas vivas' },
  { valor: 'bono_restauracion', etiqueta: 'Bonos' },
];

export default function Mercado() {
  const [tipo, setTipo] = useState('');
  const { data, error, loading, recargar } = useFetch(`/mercado${tipo ? `?tipo=${tipo}` : ''}`, [tipo]);
  const { data: ind } = useFetch('/mercado/indicadores');

  const i = ind?.indicadores;

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 lg:px-10">
      <h1 className="font-display text-3xl font-600">Activos de océano</h1>
      <p className="mt-2 max-w-xl text-[15px] text-tinta">
        Cada activo está atado a un proyecto de restauración con métricas públicas.
        Comprás sobre un polígono concreto de mar, no sobre una promesa.
      </p>

      {i && (
        <div className="mt-8 grid grid-cols-2 gap-6 border-y border-trazo py-6 lg:grid-cols-4">
          <Sonda valor={i.activos_publicados} rotulo="activos publicados" />
          <Sonda valor={numero(i.tco2_vendido)} unidad="tCO₂e" rotulo="carbono transferido" />
          <Sonda valor={dolares(i.volumen_usd)} rotulo="volumen operado" color="var(--color-kelp)" />
          <Sonda valor={dolares(i.comision_usd)} rotulo="reinvertido en restauración" />
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button key={f.valor} onClick={() => setTipo(f.valor)}
            className={`rounded-carta border px-3 py-1.5 text-sm transition-colors ${
              tipo === f.valor ? 'border-columna bg-columna text-carta' : 'border-trazo hover:bg-papel'}`}>
            {f.etiqueta}
          </button>
        ))}
      </div>

      {loading && <Cargando />}
      {error && <div className="mt-6"><CajaError error={error} onReintentar={recargar} /></div>}

      {data?.activos?.length === 0 && (
        <Panel className="mt-6">
          <Vacio titulo="No hay activos de ese tipo todavía"
                 detalle="Probá con otro filtro o mirá todos los activos publicados." />
        </Panel>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {(data?.activos ?? []).map((a) => {
          const vendidoPct = (Number(a.units_sold) / Number(a.units_total)) * 100;
          return (
            <Link key={a.id} to={`/mercado/${a.id}`}>
              <Panel className="flex h-full flex-col p-5 transition-colors hover:border-kelp">
                <div className="flex items-start justify-between gap-3">
                  <Etiqueta color="var(--color-kelp)">{TIPO_ACTIVO[a.asset_kind]}</Etiqueta>
                  {a.registry && a.registry !== 'interno' && (
                    <Etiqueta>{a.registry === 'verra' ? 'Verra' : 'Gold Standard'}</Etiqueta>
                  )}
                </div>

                <h2 className="mt-3 font-display text-lg leading-snug font-600">{a.title}</h2>
                <p className="mt-1.5 flex-1 text-sm leading-relaxed text-tinta">{a.summary}</p>

                <p className="mt-4 text-xs text-tinta/70">
                  {a.project_name} · {a.zone_name} · {a.org_name}
                </p>

                <div className="mt-4 border-t border-trazo pt-4">
                  <div className="flex items-baseline justify-between">
                    <span className="cifra font-display text-xl font-600">
                      {dolares(a.unit_price_usd)}
                    </span>
                    <span className="text-sm text-tinta/70">por {a.unit_label}</span>
                  </div>
                  <div className="mt-3">
                    <Barra valor={vendidoPct} alto={4} />
                    <p className="mt-1.5 text-xs text-tinta/70">
                      {numero(a.units_available, a.asset_kind === 'hectarea_viva' ? 0 : 1)} {a.unit_label} disponibles
                      de {numero(a.units_total, a.asset_kind === 'hectarea_viva' ? 0 : 1)}
                    </p>
                  </div>
                </div>
              </Panel>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

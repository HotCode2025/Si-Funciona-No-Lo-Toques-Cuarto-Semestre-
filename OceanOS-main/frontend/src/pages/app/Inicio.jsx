import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch.js';
import { useDemo } from '../../contexts/DemoContext.jsx';
import MapaZona, { LeyendaMapa } from '../../components/mapa/MapaZona.jsx';
import { Panel, Boton, Cargando, CajaError, Etiqueta, Selector } from '../../components/ui/index.jsx';
import { numero, hace, TIPOS, ESTADOS } from '../../utils/format.js';

export default function Inicio() {
  const { user } = useDemo();
  const [zonaSlug, setZonaSlug] = useState(user?.home_zone_slug ?? 'golfo-nuevo');
  const [tipo, setTipo] = useState('');

  const { data: zonas } = useFetch('/ecosistema/zonas');
  const { data: zonaData } = useFetch(`/ecosistema/zonas/${zonaSlug}`, [zonaSlug]);
  const consulta = `/avistamientos?zone=${zonaSlug}&limite=250${tipo ? `&kind=${tipo}` : ''}`;
  const { data, error, loading, recargar } = useFetch(consulta, [zonaSlug, tipo]);

  const avistamientos = data?.avistamientos ?? [];
  const hora = new Date().getHours();
  const saludo = hora < 13 ? 'Buen día' : hora < 20 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <div className="mx-auto max-w-4xl px-5 py-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-600">
            {saludo}, {user?.full_name?.split(' ')[0]}
          </h1>
          <p className="mt-1 text-sm text-tinta/80">
            {user?.balance_okn != null && `${numero(user.balance_okn)} OKN`}
            {user?.streak_days > 0 && ` · racha de ${user.streak_days} días`}
          </p>
        </div>
        <Link to="/app/reportar"><Boton variante="kelp">Reportar algo</Boton></Link>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Selector value={zonaSlug} onChange={(e) => setZonaSlug(e.target.value)} className="max-w-56">
          {(zonas?.zonas ?? []).map((z) => (
            <option key={z.slug} value={z.slug}>{z.name}</option>
          ))}
        </Selector>
        <Selector value={tipo} onChange={(e) => setTipo(e.target.value)} className="max-w-44">
          <option value="">Todos los tipos</option>
          {Object.entries(TIPOS).map(([k, v]) => (
            <option key={k} value={k}>{v.etiqueta}</option>
          ))}
        </Selector>
      </div>

      <div className="mt-4">
        <MapaZona zona={zonaData?.zona} avistamientos={avistamientos} alto={400} />
        <LeyendaMapa className="mt-3" />
      </div>

      {loading && <Cargando />}
      {error && <div className="mt-4"><CajaError error={error} onReintentar={recargar} /></div>}

      <h2 className="mt-10 font-display text-lg font-600">Últimos reportes</h2>
      <div className="mt-3 divide-y divide-trazo border-y border-trazo">
        {avistamientos.slice(0, 15).map((a) => (
          <div key={a.id} className="flex items-center gap-3 py-3">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: TIPOS[a.kind]?.color }} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-500">
                {a.common_name ?? TIPOS[a.kind]?.etiqueta}
                {a.individuals > 1 && ` (${a.individuals})`}
                {a.kelp_cover_pct != null && ` · ${numero(a.kelp_cover_pct, 0)}% de cobertura`}
              </p>
              <p className="truncate text-xs text-tinta/70">
                {a.reporter_name} · {hace(a.observed_at)}
                {a.depth_m != null && ` · −${a.depth_m} m`}
              </p>
            </div>
            {a.status !== 'verificado' && (
              <Etiqueta tenue>{ESTADOS[a.status]}</Etiqueta>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Gift, CircleHelp } from 'lucide-react';
import { useFetch } from '../../hooks/useFetch.js';
import { useReglas } from '../../hooks/useReglas.js';
import { useDemo } from '../../contexts/DemoContext.jsx';
import { api } from '../../services/api.js';
import { Panel, Boton, Cargando, CajaError, Etiqueta, Sonda, Vacio, TituloPanel } from '../../components/ui/index.jsx';
import { numero, fecha, hace } from '../../utils/format.js';

const MOTIVOS = {
  reporte_basico:  'Reporte enviado',
  foto_verificada: 'Reporte verificado',
  racha_semanal:   'Bono por racha',
  voto_comunidad:  'Voto en la comunidad',
  zona_nueva:      'Primera en zona nueva',
  canje:           'Canje',
  ajuste:          'Ajuste',
};

export default function Billetera() {
  const { refrescar } = useDemo();
  const reglas = useReglas();
  const { data, error, loading, recargar } = useFetch('/tokens/billetera');
  const { data: prem, recargar: recargarPremios } = useFetch('/tokens/recompensas');
  const { data: canjes, recargar: recargarCanjes } = useFetch('/tokens/canjes');
  const [canjeando, setCanjeando] = useState(null);
  const [falla, setFalla] = useState(null);

  const canjear = async (rewardId) => {
    setCanjeando(rewardId);
    setFalla(null);
    try {
      await api.post('/tokens/canjes', { rewardId });
      recargar(); recargarPremios(); recargarCanjes(); refrescar();
    } catch (e) {
      setFalla(e);
    } finally {
      setCanjeando(null);
    }
  };

  if (loading) return <div className="mx-auto max-w-3xl px-5 py-6"><Cargando /></div>;
  if (error)   return <div className="mx-auto max-w-3xl px-5 py-6"><CajaError error={error} onReintentar={recargar} /></div>;

  return (
    <div className="mx-auto max-w-3xl px-5 py-6 lg:px-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-2xl font-600">Billetera</h1>
        <Link to="/app/tokens" className="inline-flex items-center gap-1.5 text-sm text-sonda underline underline-offset-4 hover:text-kelp">
          <CircleHelp size={14} /> Cómo se ganan los tokens
        </Link>
      </div>

      <Panel oscuro className="mt-5 p-6">
        <p className="text-sm text-sonda">Tu saldo</p>
        <p className="cifra mt-1 font-display text-5xl font-600 text-kelp">
          {numero(data.balance_okn)} <span className="text-xl text-sonda">OKN</span>
        </p>
        <div className="mt-5 grid grid-cols-3 gap-4 border-t border-columna pt-4 text-sm">
          <div>
            <p className="cifra font-500">{numero(data.ganados_okn)}</p>
            <p className="text-xs text-sonda">ganados en total</p>
          </div>
          <div>
            <p className="cifra font-500">{data.reportes_verificados} / {data.reportes}</p>
            <p className="text-xs text-sonda">reportes verificados</p>
          </div>
          <div>
            <p className="cifra font-500">{data.streak_days}</p>
            <p className="text-xs text-sonda">días de racha</p>
          </div>
        </div>
      </Panel>

      {falla && <div className="mt-4"><CajaError error={falla} /></div>}

      <section className="mt-8">
        <h2 className="font-display text-lg font-600">Canjear</h2>
        <p className="mt-1 text-sm text-tinta">
          Operadores de Puerto Madryn y Península Valdés. El código se presenta en el lugar.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(prem?.recompensas ?? []).map((r) => {
            const alcanza = data.balance_okn >= r.cost_okn;
            const hay = r.stock > 0;
            return (
              <Panel key={r.id} className="flex flex-col p-4">
                <p className="text-xs text-tinta/70">{r.partner}</p>
                <p className="mt-0.5 font-500">{r.title}</p>
                {r.description && (
                  <p className="mt-1.5 flex-1 text-sm text-tinta">{r.description}</p>
                )}
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="cifra text-sm font-500 text-kelp">{numero(r.cost_okn)} OKN</span>
                  <Boton variante={alcanza && hay ? 'kelp' : 'linea'}
                         className="py-1.5 text-xs"
                         disabled={!alcanza || !hay}
                         cargando={canjeando === r.id}
                         onClick={() => canjear(r.id)}>
                    {!hay ? 'Agotado' : alcanza ? 'Canjear' : `Faltan ${numero(r.cost_okn - data.balance_okn)}`}
                  </Boton>
                </div>
                {hay && r.stock <= 5 && (
                  <p className="mt-2 text-xs text-tinta/70">Quedan {r.stock}</p>
                )}
              </Panel>
            );
          })}
        </div>
      </section>

      {canjes?.canjes?.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-lg font-600">Tus canjes</h2>
          <div className="mt-3 divide-y divide-trazo border-y border-trazo">
            {canjes.canjes.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-500">{c.title}</p>
                  <p className="text-xs text-tinta/70">{c.partner} · {fecha(c.redeemed_at)}</p>
                </div>
                <Etiqueta color="var(--color-alga)">{c.code}</Etiqueta>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-display text-lg font-600">Movimientos</h2>
        {data.movimientos?.length ? (
          <div className="mt-3 divide-y divide-trazo border-y border-trazo">
            {data.movimientos.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm">{MOTIVOS[m.reason] ?? m.reason}</p>
                  <p className="truncate text-xs text-tinta/70">
                    {m.detail ?? m.zone_name ?? ''} {m.detail || m.zone_name ? '· ' : ''}{hace(m.created_at)}
                  </p>
                </div>
                <span className={`cifra shrink-0 text-sm font-500 ${m.amount > 0 ? 'text-alga' : 'text-alerta'}`}>
                  {m.amount > 0 ? '+' : ''}{numero(m.amount)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <Panel className="mt-3">
            <Vacio titulo="Todavía no hay movimientos"
                   detalle={reglas && `Un reporte válido suma ${reglas.premios.reporte_basico} OKN; si queda verificado, agrega ${reglas.premios.foto_verificada} OKN.`} />
          </Panel>
        )}
      </section>
    </div>
  );
}

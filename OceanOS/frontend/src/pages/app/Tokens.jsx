import { Link } from 'react-router-dom';
import { Send, CircleCheck, Vote, MapPinPlus, Flame } from 'lucide-react';
import { useDemo } from '../../contexts/DemoContext.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { Panel, Boton, Barra, Cargando, CajaError, Etiqueta } from '../../components/ui/index.jsx';
import { numero } from '../../utils/format.js';

/**
 * Cómo funcionan los tokens OKN: qué paga, rachas, verificación,
 * reputación, saldo y canjes.
 *
 * Ningún número está escrito a mano. Todos salen de /tokens/reglas, que
 * lee las mismas constantes con las que el servidor paga: si mañana cambia
 * un premio, esta página cambia sola y no puede contradecir a la billetera.
 */
export default function Tokens() {
  const { user } = useDemo();
  const { data, error, loading, recargar } = useFetch('/tokens/reglas');
  const { data: prem } = useFetch('/tokens/recompensas');

  if (loading) return <div className="mx-auto max-w-3xl px-5 py-6"><Cargando /></div>;
  if (error)   return <div className="mx-auto max-w-3xl px-5 py-6"><CajaError error={error} onReintentar={recargar} /></div>;

  const r = data.reglas;
  const p = r.premios;
  const rep = r.reputacion;
  const umbral = `${Math.round(r.umbralIa * 100)}%`;
  const saldo = user?.balance_okn ?? 0;

  const premios = [
    {
      icono: Send, titulo: 'Enviar un reporte', monto: p.reporte_basico,
      detalle: 'Se cobra cuando la ubicación y el tipo quedan confirmados.',
    },
    {
      icono: CircleCheck, titulo: 'Reporte verificado', monto: p.foto_verificada,
      detalle: `Cuando el clasificador reconoce la especie con ${umbral} de confianza o más, o cuando la comunidad lo aprueba en votación.`,
    },
    {
      icono: Vote, titulo: 'Votar un reporte dudoso', monto: p.voto_comunidad,
      detalle: 'Por cada voto en la cola de verificación, se termine resolviendo o no.',
    },
    {
      icono: MapPinPlus, titulo: 'Primero en una zona', monto: p.zona_nueva,
      detalle: `Si nadie reportó ahí en los últimos ${r.diasZonaNueva} días. Se cobra al enviar, aunque el reporte todavía no esté verificado.`,
    },
    {
      icono: Flame, titulo: 'Bono por racha', monto: p.racha_semanal,
      detalle: `Cada ${r.diasBonoRacha} días seguidos reportando.`,
    },
  ];

  // Dónde está la persona dentro del tramo que lleva al próximo bono. Con
  // la racha justo en un múltiplo (7, 14…) el tramo está completo: el bono
  // ya se cobró y el siguiente queda a una semana entera.
  const dias = r.diasBonoRacha;
  const racha = user?.streak_days ?? 0;
  const enElTramo = racha === 0 ? 0 : (racha % dias || dias);
  const faltan = dias - enElTramo || dias;
  const estadoRacha = racha === 0
    ? 'Todavía no tenés racha. Reportá hoy para empezarla.'
    : enElTramo === dias
      ? `Llevás ${racha} días seguidos: ya cobraste el bono de este tramo. El próximo, en ${dias} días.`
      : `Llevás ${racha} ${racha === 1 ? 'día seguido' : 'días seguidos'}. Te ${faltan === 1 ? 'falta 1 día' : `faltan ${faltan} días`} para el próximo bono de +${p.racha_semanal} OKN.`;

  return (
    <div className="mx-auto max-w-3xl px-5 py-6 lg:px-8">
      <p className="text-sm text-sonda">Tokens OKN</p>
      <h1 className="mt-1 font-display text-2xl font-600">Cómo funcionan los tokens</h1>
      <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-tinta">
        Los OKN son la forma en que OceanOS le paga a quien sale al agua y aporta datos. No se
        compran: se ganan con reportes en los que la comunidad puede confiar, y se canjean por
        salidas con operadores de Puerto Madryn y Península Valdés.
      </p>

      {/* ---------------- Tu situación ---------------- */}
      <Panel oscuro className="mt-6 p-5">
        <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
          <div>
            <p className="text-sm text-sonda">Tu saldo</p>
            <p className="cifra font-display text-4xl font-600 text-kelp">
              {numero(saldo)} <span className="text-lg text-sonda">OKN</span>
            </p>
          </div>
          <div className="sm:border-l sm:border-columna sm:pl-5">
            <p className="text-sm text-carta">{estadoRacha}</p>
            <div className="mt-3 flex gap-1.5" role="img"
                 aria-label={`${enElTramo} de ${dias} días hacia el próximo bono`}>
              {Array.from({ length: dias }, (_, i) => (
                <span key={i} className={`h-2 flex-1 rounded-full ${i < enElTramo ? 'bg-kelp' : 'bg-columna'}`} />
              ))}
            </div>
            <p className="mt-1.5 flex justify-between text-xs text-sonda">
              <span>día 1</span>
              <span>día {dias} · +{p.racha_semanal} OKN</span>
            </p>
          </div>
        </div>
      </Panel>

      {/* ---------------- Qué suma ---------------- */}
      <section className="mt-10">
        <h2 className="font-display text-lg font-600">Qué suma y cuánto</h2>
        <div className="mt-3 divide-y divide-trazo border-y border-trazo">
          {premios.map(({ icono: Icono, titulo, monto, detalle }) => (
            <div key={titulo} className="flex gap-4 py-4">
              <Icono size={18} className="mt-0.5 shrink-0 text-sonda" />
              <div className="min-w-0 flex-1">
                <p className="font-500 text-carta">{titulo}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-tinta/80">{detalle}</p>
              </div>
              <span className={`cifra shrink-0 font-display text-lg font-600 ${monto > 0 ? 'text-kelp' : 'text-tinta/50'}`}>
                {monto > 0 ? `+${monto}` : monto}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- Rachas ---------------- */}
      <section className="mt-10">
        <h2 className="font-display text-lg font-600">Rachas</h2>
        <p className="mt-1.5 text-sm text-tinta">
          La racha cuenta los días seguidos en los que enviaste al menos un reporte, verificado o no.
        </p>
        <Reglas items={[
          'Si ya reportaste hoy, otro reporte el mismo día no la cambia.',
          'Si tu último reporte fue ayer, suma un día.',
          'Si pasó más de un día sin reportar, vuelve a empezar en 1.',
          `Al llegar a ${dias}, ${dias * 2}, ${dias * 3}… días seguidos cobrás +${p.racha_semanal} OKN, una sola vez por día.`,
        ]} />
      </section>

      {/* ---------------- Verificación y reputación ---------------- */}
      <section className="mt-10">
        <h2 className="font-display text-lg font-600">Verificación y reputación</h2>
        <Reglas items={[
          `Si el clasificador de la app reconoce la especie con ${umbral} de confianza o más, el reporte queda verificado en el momento y cobrás +${p.foto_verificada} OKN.`,
          `Si no llega a ${umbral}, el reporte va a votación. Lo resuelven ${r.votosParaResolver} votos de la comunidad, y cada voto pesa según la reputación de quien vota.`,
          `Si la votación lo aprueba, quien reportó cobra +${p.foto_verificada} OKN y suma ${rep.subeSiVerificado} puntos de reputación, hasta un máximo de ${rep.maxima}. Si lo rechaza, pierde ${rep.bajaSiRechazado} puntos.`,
          'Un reporte cargado sin foto clasificada queda sin revisar hasta que se valide.',
        ]} />
        <div className="mt-5 rounded-carta border border-trazo bg-papel p-4">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-500 text-carta">Tu reputación</span>
            <span className="cifra text-tinta">{user?.reputation ?? 0} / {rep.maxima}</span>
          </div>
          <div className="mt-2"><Barra valor={user?.reputation ?? 0} max={rep.maxima} /></div>
          <p className="mt-2 text-xs text-tinta/70">Es el peso que tiene tu voto cuando validás reportes de otros.</p>
        </div>
      </section>

      {/* ---------------- Saldo ---------------- */}
      <section className="mt-10">
        <h2 className="font-display text-lg font-600">De dónde sale tu saldo</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-tinta">
          Tu saldo no es un número guardado aparte: es la suma de todos tus movimientos. Cada token
          que entra o sale queda anotado con su motivo, y eso es lo que ves en la billetera. Por eso
          el saldo no se puede desincronizar de lo que hiciste.
        </p>
      </section>

      {/* ---------------- Canjes ---------------- */}
      <section className="mt-10">
        <h2 className="font-display text-lg font-600">Canjes</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-tinta">
          Canjear descuenta el costo de tu saldo, baja el stock de la recompensa y te da un código
          para presentar en el lugar. Si no te alcanza o se agotó, el botón de canje te lo avisa.
        </p>
        {prem?.recompensas?.length > 0 && (
          <div className="mt-3 divide-y divide-trazo border-y border-trazo">
            {prem.recompensas.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-500 text-carta">{c.title}</p>
                  <p className="truncate text-xs text-tinta/70">{c.partner}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {saldo >= c.cost_okn && <Etiqueta color="var(--color-alga)">Te alcanza</Etiqueta>}
                  <span className="cifra text-sm font-500 text-kelp">{numero(c.cost_okn)} OKN</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link to="/app/reportar"><Boton variante="kelp">Reportar algo</Boton></Link>
        <Link to="/app/billetera"><Boton variante="linea">Ir a la billetera</Boton></Link>
      </div>
    </div>
  );
}

function Reglas({ items }) {
  return (
    <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-tinta">
      {items.map((texto) => (
        <li key={texto} className="flex gap-3">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sonda" aria-hidden="true" />
          <span>{texto}</span>
        </li>
      ))}
    </ul>
  );
}

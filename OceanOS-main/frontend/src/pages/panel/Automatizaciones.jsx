import { Webhook, GitBranch, MessageCircle, Database, Mail, CornerDownRight } from 'lucide-react';
import { useFetch } from '../../hooks/useFetch.js';
import { Panel, Cargando, CajaError, Etiqueta, Vacio } from '../../components/ui/index.jsx';
import { numero, hace, TIPOS } from '../../utils/format.js';

/** Los nodos del flujo, con el ícono que les corresponde en n8n. */
const NODOS = {
  webhook:     { icono: Webhook,        etiqueta: 'Webhook',     color: 'var(--color-sonda)' },
  condicion:   { icono: GitBranch,      etiqueta: 'Condición',   color: 'var(--color-alerta)' },
  whatsapp:    { icono: MessageCircle,  etiqueta: 'WhatsApp',    color: 'var(--color-alga)' },
  base_datos:  { icono: Database,       etiqueta: 'Base de datos', color: 'var(--color-kelp)' },
  email:       { icono: Mail,           etiqueta: 'Email',       color: 'var(--color-tinta)' },
};

const ESTADO_CORRIDA = {
  exito:   { texto: 'Éxito',    color: 'var(--color-alga)' },
  omitido: { texto: 'Omitido',  color: 'var(--color-sonda)' },
  fallo:   { texto: 'Falló',    color: 'var(--color-alerta)' },
};

function Nodo({ flujo, rama }) {
  const { icono: Icono, etiqueta, color } = NODOS[flujo.node_kind] ?? NODOS.webhook;
  return (
    <Panel className="p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border"
              style={{ borderColor: color, color }}>
          <Icono size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-500 text-carta">{flujo.process_name}</p>
            <Etiqueta color={color} tenue>{etiqueta}</Etiqueta>
            {rama && <Etiqueta color="var(--color-sonda)" tenue>{rama}</Etiqueta>}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-tinta/80">{flujo.description}</p>
          <p className="mt-2 text-xs text-tinta/70">
            <span className="cifra">{numero(flujo.corridas)}</span> corridas
            {flujo.omitidas > 0 && <> · <span className="cifra">{numero(flujo.omitidas)}</span> en espera</>}
            {flujo.ultima && <> · última {hace(flujo.ultima)}</>}
          </p>
        </div>
      </div>
    </Panel>
  );
}

const Flecha = () => (
  <div className="flex justify-center py-2" aria-hidden="true">
    <span className="h-5 w-px bg-trazo" />
  </div>
);

export default function Automatizaciones() {
  const { data, error, loading, recargar } = useFetch('/automatizaciones');

  if (loading) return <div className="mx-auto max-w-4xl px-5 py-6"><Cargando /></div>;
  if (error)   return <div className="mx-auto max-w-4xl px-5 py-6"><CajaError error={error} onReintentar={recargar} /></div>;

  const por = (slug) => data.flujos.find((f) => f.slug === slug);
  const webhook = por('webhook_avistamiento');
  const triage  = por('triage_confianza');
  const alerta  = por('alerta_ong');
  const credito = por('acreditacion_okn');
  const aviso   = por('aviso_usuario');

  return (
    <div className="mx-auto max-w-4xl px-5 py-6 lg:px-8">
      <h1 className="font-display text-2xl font-600">Automatizaciones</h1>
      <p className="mt-1.5 max-w-2xl text-sm text-tinta">
        Cada avistamiento que entra dispara el flujo de n8n. El nodo de triage decide la rama:
        si la IA reconoció una especie amenazada con confianza suficiente, sale el aviso a la
        organización de la zona; si no, el reporte espera a la comunidad y recién ahí se paga.
        Todo disparo queda registrado contra el reporte que lo originó.
      </p>

      {/* ---------- El flujo ---------- */}
      <section className="mt-8">
        <h2 className="font-display text-lg font-600">El flujo</h2>

        <div className="mt-4">
          <Nodo flujo={webhook} />
          <Flecha />
          <Nodo flujo={triage} />
        </div>

        <p className="mt-3 rounded-carta border border-trazo bg-papel px-4 py-3 text-sm text-tinta">
          <span className="font-500 text-carta">Condición:</span>{' '}
          <span className="cifra">confianza IA &gt; {Math.round(data.condicion.umbral * 100)}%</span>{' '}
          y estado de conservación en{' '}
          <span className="cifra">{data.condicion.estados.join(', ')}</span>
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2 md:items-start">
          <Nodo flujo={alerta} rama="rama verdadera" />
          <div>
            <Nodo flujo={credito} rama="rama falsa" />
            <div className="mt-3 flex gap-2 pl-4">
              <CornerDownRight size={16} className="mt-4 shrink-0 text-sonda" />
              <div className="flex-1"><Nodo flujo={aviso} /></div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- El registro ---------- */}
      <section className="mt-10">
        <h2 className="font-display text-lg font-600">Últimos disparos</h2>
        <p className="mt-1 text-sm text-tinta/80">
          La tabla puente del modelo: qué reporte, de qué usuario, disparó qué flujo.
        </p>

        {data.registro.length === 0 ? (
          <Panel className="mt-4">
            <Vacio titulo="Todavía no corrió ningún flujo"
                   detalle="Cargá un reporte desde la app ciudadana y volvé acá." />
          </Panel>
        ) : (
          <div className="mt-4 divide-y divide-trazo border-y border-trazo">
            {data.registro.map((d) => {
              const estado = ESTADO_CORRIDA[d.run_status] ?? ESTADO_CORRIDA.exito;
              return (
                <div key={d.id} className="flex items-start justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-500">{d.proceso}</p>
                      {d.kind && (
                        <Etiqueta color={TIPOS[d.kind]?.color} tenue>{TIPOS[d.kind]?.etiqueta}</Etiqueta>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-tinta/70">
                      {d.detail}
                      {d.especie && ` · ${d.especie}`}
                      {d.zona && ` · ${d.zona}`}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-tinta/70">
                      {d.reportero}
                      {d.documento && <span className="cifra"> · DNI {d.documento}</span>}
                      {' · '}{hace(d.triggered_at)}
                    </p>
                  </div>
                  <span className="shrink-0"><Etiqueta color={estado.color}>{estado.texto}</Etiqueta></span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

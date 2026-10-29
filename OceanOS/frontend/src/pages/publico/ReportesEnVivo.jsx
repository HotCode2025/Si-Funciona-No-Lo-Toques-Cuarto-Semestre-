import { SonarPing } from '../../components/ui/index.jsx';
import { TIPOS, hace } from '../../utils/format.js';

/** Cinta con los últimos reportes. Se frena al pasar el mouse, y con "reducir movimiento" se recorre a mano. */
export default function ReportesEnVivo({ lista = [] }) {
  const items = [...lista].sort((a, b) => new Date(b.observed_at) - new Date(a.observed_at)).slice(0, 14);
  if (items.length < 4) return null;
  const fila = (oculta) => items.map((a) => (
    <li key={`${oculta ? 'o' : 'p'}${a.id}`} aria-hidden={oculta || undefined} className="flex shrink-0 items-center gap-2.5 text-sm">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: TIPOS[a.kind]?.color }} />
      <span className="text-carta">{a.common_name ?? TIPOS[a.kind]?.etiqueta}</span>
      <span className="text-sonda">{hace(a.observed_at)}</span>
    </li>
  ));
  return (
    <section aria-label="Reportes recientes" className="flex items-center gap-4 border-b border-columna bg-hondo/30 py-3 pl-5 lg:pl-10">
      <p className="flex shrink-0 items-center gap-2 text-xs tracking-wide text-kelp-alto uppercase">
        <SonarPing size={14} color="var(--color-alga)" /> En vivo
      </p>
      <div className="cinta min-w-0 flex-1"><ul className="cinta-pista">{fila(false)}{fila(true)}</ul></div>
    </section>
  );
}

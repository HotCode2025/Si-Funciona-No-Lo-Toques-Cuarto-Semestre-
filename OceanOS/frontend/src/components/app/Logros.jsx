import { Lock } from 'lucide-react';
import { calcularLogros } from '../../utils/logros.js';

export default function Logros({ user }) {
  const lista = calcularLogros(user);
  const hechos = lista.filter((l) => l.logrado).length;
  return (
    <section aria-label="Logros">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-lg font-600">Logros</h2>
        <span className="cifra text-sm text-tinta/70">{hechos} de {lista.length}</span>
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {lista.map((l, i) => {
          const Icono = l.icono;
          return (
            <li key={l.id} style={{ animationDelay: `${i * 50}ms` }}
                className={`animar-flotar rounded-carta border p-3 text-center transition-colors ${l.logrado ? 'border-kelp/50 bg-kelp/8' : 'border-trazo'}`}>
              <span className={`relative mx-auto grid h-12 w-12 place-items-center rounded-full ${l.logrado ? 'logro-brillo bg-kelp/20 text-kelp' : 'bg-trazo/60 text-tinta/40'}`}>
                <Icono size={22} />
                {!l.logrado && <Lock size={11} className="absolute -right-0.5 -bottom-0.5 rounded-full bg-papel p-0.5 text-tinta/60" />}
              </span>
              <p className={`mt-2 text-sm leading-tight font-500 ${l.logrado ? '' : 'text-tinta/70'}`}>{l.titulo}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-tinta/60">{l.texto}</p>
              {!l.logrado && (
                <div className="mt-2" aria-label={`${l.actual} de ${l.meta} ${l.unidad}`}>
                  <div className="h-1 overflow-hidden rounded-full bg-trazo"><div className="barra-progreso h-full rounded-full bg-sonda" style={{ width: `${l.avance * 100}%` }} /></div>
                  <p className="cifra mt-1 text-[10px] text-tinta/60">{Math.round(l.actual)} / {l.meta}</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

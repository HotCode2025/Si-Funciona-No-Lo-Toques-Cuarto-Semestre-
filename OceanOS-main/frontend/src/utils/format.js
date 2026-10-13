const AR = 'es-AR';

export const numero = (n, decimales = 0) =>
  n == null ? '—' : Number(n).toLocaleString(AR, {
    minimumFractionDigits: decimales, maximumFractionDigits: decimales,
  });

export const dolares = (n) =>
  n == null ? '—' : `u$s ${Number(n).toLocaleString(AR, { maximumFractionDigits: 0 })}`;

export const fecha = (iso) =>
  !iso ? '—' : new Date(iso).toLocaleDateString(AR, { day: '2-digit', month: 'short', year: 'numeric' });

export const fechaCorta = (iso) =>
  !iso ? '—' : new Date(iso).toLocaleDateString(AR, { day: '2-digit', month: 'short' });

/** "hace 3 días", "recién". Para el mapa en vivo. */
export function hace(iso) {
  if (!iso) return '—';
  const seg = (Date.now() - new Date(iso).getTime()) / 1000;
  if (seg < 90) return 'recién';
  const min = Math.round(seg / 60);
  if (min < 60) return `hace ${min} min`;
  const hs = Math.round(min / 60);
  if (hs < 24) return `hace ${hs} h`;
  const dias = Math.round(hs / 24);
  if (dias < 30) return `hace ${dias} día${dias === 1 ? '' : 's'}`;
  return fechaCorta(iso);
}

export const esReciente = (iso) =>
  iso ? (Date.now() - new Date(iso).getTime()) < 24 * 3600 * 1000 : false;

export const TIPOS = {
  tiburon: { etiqueta: 'Tiburón', color: 'var(--color-tiburon)' },
  kelp:    { etiqueta: 'Cachiyuyo', color: 'var(--color-kelp)' },
  fauna:   { etiqueta: 'Fauna', color: 'var(--color-alga)' },
  amenaza: { etiqueta: 'Amenaza', color: 'var(--color-alerta)' },
};

export const ESTADOS = {
  pendiente:   'Sin revisar',
  en_votacion: 'En votación',
  verificado:  'Verificado',
  rechazado:   'Rechazado',
};

export const PLANES = { starter: 'Starter', professional: 'Professional', enterprise: 'Enterprise' };

export const TIPO_ORG = {
  pesquera: 'Pesquera', ong: 'ONG', area_protegida: 'Área protegida',
  gobierno: 'Gobierno', investigacion: 'Investigación',
};

export const ESTADO_PROYECTO = {
  planificado: 'Planificado', en_curso: 'En curso', monitoreo: 'En monitoreo',
  finalizado: 'Finalizado', suspendido: 'Suspendido',
};

export const TIPO_ACTIVO = {
  credito_carbono:    'Crédito de carbono azul',
  hectarea_viva:      'Hectárea viva',
  bono_restauracion:  'Bono de restauración',
};

/** Color del índice de salud: rojo bajo 40, ámbar hasta 65, verde arriba. */
export const colorSalud = (indice) =>
  indice >= 65 ? 'var(--color-alga)' : indice >= 40 ? 'var(--color-kelp)' : 'var(--color-alerta)';

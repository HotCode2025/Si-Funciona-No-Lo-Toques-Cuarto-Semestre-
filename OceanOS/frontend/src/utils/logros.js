import { Award, BadgeCheck, Binoculars, Coins, Eye, Flame, ShieldCheck, Waves } from 'lucide-react';

/**
 * Logros: salen SOLO de datos que el sistema ya guarda (reportes, verificados, racha,
 * reputación, saldo). Las metas son una decisión de diseño y se cambian acá.
 */
export const LOGROS = [
  { id: 'primer-avistaje',   titulo: 'Primer avistaje',      texto: 'Enviaste tu primer reporte',            icono: Eye,         meta: 1,   valor: (u) => u.reportes,              unidad: 'reportes' },
  { id: 'ojo-atento',        titulo: 'Ojo atento',           texto: '10 reportes enviados',                  icono: Binoculars,  meta: 10,  valor: (u) => u.reportes,              unidad: 'reportes' },
  { id: 'dato-confiable',    titulo: 'Dato confiable',       texto: 'Un reporte tuyo fue verificado',        icono: BadgeCheck,  meta: 1,   valor: (u) => u.reportes_verificados,  unidad: 'verificados' },
  { id: 'fuente-confiable',  titulo: 'Fuente confiable',     texto: '5 reportes verificados por la comunidad', icono: ShieldCheck, meta: 5, valor: (u) => u.reportes_verificados,  unidad: 'verificados' },
  { id: 'constancia',        titulo: 'Constancia',           texto: '3 días seguidos reportando',            icono: Flame,       meta: 3,   valor: (u) => u.streak_days,           unidad: 'días' },
  { id: 'semana-en-el-mar',  titulo: 'Una semana en el mar', texto: '7 días seguidos reportando',            icono: Waves,       meta: 7,   valor: (u) => u.streak_days,           unidad: 'días' },
  { id: 'voz-comunidad',     titulo: 'Voz de la comunidad',  texto: 'Llegaste a 500 de reputación',          icono: Award,       meta: 500, valor: (u) => u.reputation,            unidad: 'puntos' },
  { id: 'primeros-100',      titulo: 'Primeros 100 OKN',     texto: 'Juntaste 100 tokens',                   icono: Coins,       meta: 100, valor: (u) => u.balance_okn,           unidad: 'OKN' },
];

export function calcularLogros(user) {
  return LOGROS.map((l) => {
    const v = Number(l.valor(user ?? {}) ?? 0) || 0;
    return { ...l, actual: Math.min(v, l.meta), logrado: v >= l.meta, avance: Math.min(1, v / l.meta) };
  });
}

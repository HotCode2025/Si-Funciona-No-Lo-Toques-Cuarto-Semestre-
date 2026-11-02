// Horarios de atención de los locales: un arreglo de 7 días (lunes a domingo), cada uno abierto o cerrado y con hasta dos
// turnos (horario corrido o cortado). A partir de ahí se arma el texto que se muestra en el checkout, los mails y el
// comprobante ("Lunes a viernes de 8:30 a 13 y de 16:30 a 20. Sábados de 9 a 13.").

import { ErrorApi } from './errores.js';

export const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const DIAS_PLURAL = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos'];

const HORA = '^([01][0-9]|2[0-3]):[0-5][0-9]$';
const turno = {
  type: 'object',
  additionalProperties: false,
  required: ['desde', 'hasta'],
  properties: { desde: { type: 'string', pattern: HORA }, hasta: { type: 'string', pattern: HORA } },
};
export const esquemaHorarios = {
  type: 'array',
  minItems: 7,
  maxItems: 7,
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['abierto'],
    properties: { abierto: { type: 'boolean' }, turnos: { type: 'array', maxItems: 2, items: turno } },
  },
};

const minutos = (hora) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3));
const hora = (h, m = 0) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
/** "08:00" → "8", "16:30" → "16:30" */
const horaCorta = (h) => (h.endsWith(':00') ? String(Number(h.slice(0, 2))) : `${Number(h.slice(0, 2))}:${h.slice(3)}`);

/** Valida y normaliza (los días cerrados quedan sin turnos). Tira ErrorApi 400 con un mensaje claro. */
export function normalizarHorarios(horarios) {
  const limpio = horarios.map((d, i) => {
    if (!d.abierto) return { abierto: false, turnos: [] };
    const turnos = [...(d.turnos || [])].sort((a, b) => minutos(a.desde) - minutos(b.desde));
    const dia = DIAS[i];
    if (!turnos.length) throw new ErrorApi(400, `Indicá el horario del ${dia} o marcalo como cerrado.`);
    turnos.forEach((t, j) => {
      if (minutos(t.desde) >= minutos(t.hasta)) {
        throw new ErrorApi(400, `El ${dia} el horario de apertura (${t.desde}) tiene que ser anterior al de cierre (${t.hasta}).`);
      }
      if (j > 0 && minutos(t.desde) < minutos(turnos[j - 1].hasta)) {
        throw new ErrorApi(400, `El ${dia} los dos turnos se superponen: el segundo tiene que empezar después de las ${turnos[j - 1].hasta}.`);
      }
    });
    return { abierto: true, turnos: turnos.map(({ desde, hasta }) => ({ desde, hasta })) };
  });
  if (!limpio.some((d) => d.abierto)) throw new ErrorApi(400, 'El local tiene que abrir al menos un día de la semana.');
  return limpio;
}

/** Lista de días en texto: "lunes a viernes", "sábados", "lunes, miércoles y viernes", "sábados y domingos". */
function textoDias(indices) {
  const tramos = [];
  for (const i of indices) {
    const ultimo = tramos.at(-1);
    if (ultimo && ultimo.at(-1) === i - 1) ultimo.push(i);
    else tramos.push([i]);
  }
  const partes = tramos.flatMap((t) => (t.length >= 3 ? [`${DIAS[t[0]]} a ${DIAS[t.at(-1)]}`] : t.map((i) => DIAS_PLURAL[i])));
  return partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}`;
}

function textoTurnos(turnos) {
  const [t1, t2] = turnos;
  if (!t2) {
    // Abierto al mediodía: horario corrido
    const corrido = minutos(t1.desde) <= 12 * 60 && minutos(t1.hasta) >= 15 * 60;
    return `de ${horaCorta(t1.desde)} a ${horaCorta(t1.hasta)}${corrido ? ' corrido' : ''}`;
  }
  return `de ${horaCorta(t1.desde)} a ${horaCorta(t1.hasta)} y de ${horaCorta(t2.desde)} a ${horaCorta(t2.hasta)}`;
}

/** Texto para mostrar: agrupa los días que tienen el mismo horario. */
export function textoHorarios(horarios) {
  const grupos = new Map();
  horarios.forEach((d, i) => {
    if (!d.abierto) return;
    const clave = JSON.stringify(d.turnos);
    if (!grupos.has(clave)) grupos.set(clave, { turnos: d.turnos, dias: [] });
    grupos.get(clave).dias.push(i);
  });
  return [...grupos.values()]
    .map((g) => {
      const frase = `${textoDias(g.dias)} ${textoTurnos(g.turnos)}.`;
      return frase[0].toUpperCase() + frase.slice(1);
    })
    .join(' ');
}

/**
 * Lee un horario escrito a mano con el formato habitual ("Lunes a viernes de 8:30 a 13 y de 16:30 a 20. Sábados de 9 a
 * 13.") para pasarlo a la estructura. Devuelve null si no lo entiende.
 */
export function leerHorarioTexto(texto) {
  if (!texto) return null;
  const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const nombres = DIAS.map(sinTildes);
  const horarios = DIAS.map(() => ({ abierto: false, turnos: [] }));
  const patronDia = '(lunes|martes|miercoles|jueves|viernes|sabados?|domingos?)';
  let entendido = false;
  for (const frase of sinTildes(texto).split(/[.;\n]+/)) {
    const dias = frase.match(new RegExp(`^\\s*${patronDia}(?:\\s+a\\s+${patronDia})?`));
    if (!dias) continue;
    const indice = (nombre) => nombres.indexOf(nombre.replace(/^(sabado|domingo)s$/, '$1'));
    const desde = indice(dias[1]);
    const hasta = dias[2] ? indice(dias[2]) : desde;
    const turnos = [...frase.matchAll(/(\d{1,2})(?::(\d{2}))?\s*(?:a|-)\s*(\d{1,2})(?::(\d{2}))?/g)]
      .slice(0, 2)
      .map((m) => ({ desde: hora(Number(m[1]), Number(m[2] || 0)), hasta: hora(Number(m[3]), Number(m[4] || 0)) }));
    if (desde < 0 || hasta < desde || !turnos.length || turnos.some((t) => t.desde >= t.hasta || t.hasta > '23:59')) continue;
    for (let i = desde; i <= hasta; i += 1) horarios[i] = { abierto: true, turnos };
    entendido = true;
  }
  if (!entendido) return null;
  try {
    return normalizarHorarios(horarios);
  } catch {
    return null;
  }
}

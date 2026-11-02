// Horario de atención de un local: 7 días (lunes a domingo), cada uno abierto o cerrado y con uno o dos turnos.
// El texto que se muestra en el sitio lo arma el servidor; acá está la misma lógica para la vista previa y el estado
// "Abierto ahora".

export const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DIAS_MIN = DIAS.map((d) => d.toLowerCase());
const DIAS_PLURAL = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos'];

/** Horario típico de una casa de repuestos, para empezar a editar. */
export const HORARIO_INICIAL = [
  ...Array.from({ length: 5 }, () => ({ abierto: true, turnos: [{ desde: '08:30', hasta: '13:00' }, { desde: '16:30', hasta: '20:00' }] })),
  { abierto: true, turnos: [{ desde: '09:00', hasta: '13:00' }] },
  { abierto: false, turnos: [] },
];

const minutos = (h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));
const horaCorta = (h) => (h.endsWith(':00') ? String(Number(h.slice(0, 2))) : `${Number(h.slice(0, 2))}:${h.slice(3)}`);

/** Primer problema del horario (para mostrarlo al lado del día), o null si está bien. */
export function problemaHorarios(horarios) {
  for (const [i, d] of horarios.entries()) {
    if (!d.abierto) continue;
    if (!d.turnos.length) return { dia: i, mensaje: 'Indicá el horario o marcalo como cerrado.' };
    for (const [j, t] of d.turnos.entries()) {
      if (!t.desde || !t.hasta) return { dia: i, mensaje: 'Completá la hora de apertura y de cierre.' };
      if (minutos(t.desde) >= minutos(t.hasta)) return { dia: i, mensaje: 'La apertura tiene que ser antes del cierre.' };
      if (j > 0 && minutos(t.desde) < minutos(d.turnos[j - 1].hasta)) return { dia: i, mensaje: 'El segundo turno tiene que empezar después del primero.' };
    }
  }
  if (!horarios.some((d) => d.abierto)) return { dia: null, mensaje: 'El local tiene que abrir al menos un día.' };
  return null;
}

function textoDias(indices) {
  const tramos = [];
  for (const i of indices) {
    const ultimo = tramos.at(-1);
    if (ultimo && ultimo.at(-1) === i - 1) ultimo.push(i);
    else tramos.push([i]);
  }
  const partes = tramos.flatMap((t) => (t.length >= 3 ? [`${DIAS_MIN[t[0]]} a ${DIAS_MIN[t.at(-1)]}`] : t.map((i) => DIAS_PLURAL[i])));
  return partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}`;
}

export const textoTurnos = (turnos) => turnos.map((t) => `${horaCorta(t.desde)} a ${horaCorta(t.hasta)}`).join(' y ');

/** "Lunes a viernes de 8:30 a 13 y de 16:30 a 20. Sábados de 9 a 13." (igual que el servidor) */
export function textoHorarios(horarios) {
  const grupos = new Map();
  horarios.forEach((d, i) => {
    if (!d.abierto || !d.turnos.length) return;
    const clave = JSON.stringify(d.turnos);
    if (!grupos.has(clave)) grupos.set(clave, { turnos: d.turnos, dias: [] });
    grupos.get(clave).dias.push(i);
  });
  return [...grupos.values()].map(({ turnos, dias }) => {
    const [t1, t2] = turnos;
    const corrido = !t2 && minutos(t1.desde) <= 12 * 60 && minutos(t1.hasta) >= 15 * 60;
    const horas = t2
      ? `de ${horaCorta(t1.desde)} a ${horaCorta(t1.hasta)} y de ${horaCorta(t2.desde)} a ${horaCorta(t2.hasta)}`
      : `de ${horaCorta(t1.desde)} a ${horaCorta(t1.hasta)}${corrido ? ' corrido' : ''}`;
    const frase = `${textoDias(dias)} ${horas}.`;
    return frase[0].toUpperCase() + frase.slice(1);
  }).join(' ');
}

/** Día (0 = lunes) y minutos de ahora en la hora de Argentina. */
function ahoraEnArgentina(fecha = new Date()) {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(fecha).map((p) => [p.type, p.value]));
  const dia = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(partes.weekday);
  return { dia, minutos: Number(partes.hour) * 60 + Number(partes.minute) };
}

/** ¿Está abierto ahora? Con el próximo cambio: "Cierra a las 20" / "Abre mañana a las 8:30". */
export function estadoAhora(horarios, fecha = new Date()) {
  if (!horarios) return null;
  const { dia, minutos: ahora } = ahoraEnArgentina(fecha);
  const hoy = horarios[dia];
  const actual = hoy.abierto && hoy.turnos.find((t) => minutos(t.desde) <= ahora && ahora < minutos(t.hasta));
  if (actual) return { abierto: true, dia, detalle: `Cierra a las ${horaCorta(actual.hasta)}` };
  const despuesHoy = hoy.abierto && hoy.turnos.find((t) => minutos(t.desde) > ahora);
  if (despuesHoy) return { abierto: false, dia, detalle: `Abre hoy a las ${horaCorta(despuesHoy.desde)}` };
  for (let k = 1; k <= 7; k += 1) {
    const d = (dia + k) % 7;
    if (horarios[d].abierto && horarios[d].turnos.length) {
      const cuando = k === 1 ? 'mañana' : `el ${DIAS_MIN[d]}`;
      return { abierto: false, dia, detalle: `Abre ${cuando} a las ${horaCorta(horarios[d].turnos[0].desde)}` };
    }
  }
  return { abierto: false, dia, detalle: '' };
}

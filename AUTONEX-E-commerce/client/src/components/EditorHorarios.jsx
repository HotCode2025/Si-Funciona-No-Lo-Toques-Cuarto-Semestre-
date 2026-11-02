import { Clock, Copy, Plus, X } from 'lucide-react';
import { DIAS, problemaHorarios, textoHorarios } from '../lib/horarios.js';

const minutos = (h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));

/**
 * Horario de atención por día: abierto o cerrado, con horario corrido (un turno) o cortado (dos turnos). Muestra cómo
 * lo van a ver los compradores. `valor`: arreglo de 7 días ({ abierto, turnos: [{ desde, hasta }] }).
 */
export default function EditorHorarios({ valor, alCambiar, id = 'horarios' }) {
  const problema = problemaHorarios(valor);
  const resumen = textoHorarios(valor);

  const cambiarDia = (i, cambio) => alCambiar(valor.map((d, j) => (j === i ? { ...d, ...cambio } : d)));
  const cambiarTurno = (i, j, campo, hora) => cambiarDia(i, { turnos: valor[i].turnos.map((t, k) => (k === j ? { ...t, [campo]: hora } : t)) });

  const abrir = (i, abierto) => {
    // Al abrir un día sin horario se propone el del primer día abierto
    const modelo = valor.find((d) => d.abierto && d.turnos.length)?.turnos ?? [{ desde: '09:00', hasta: '18:00' }];
    cambiarDia(i, { abierto, turnos: abierto && !valor[i].turnos.length ? modelo.map((t) => ({ ...t })) : valor[i].turnos });
  };
  const agregarTurno = (i) => {
    const [t1] = valor[i].turnos;
    const primero = minutos(t1.hasta) > 13 * 60 ? { ...t1, hasta: '13:00' } : t1;
    cambiarDia(i, { turnos: [primero, { desde: '16:30', hasta: '20:00' }] });
  };
  const copiarLunes = () => alCambiar(valor.map((d, i) => (i >= 1 && i <= 4
    ? { abierto: valor[0].abierto, turnos: valor[0].turnos.map((t) => ({ ...t })) }
    : d)));

  return (
    <div className="editor-horarios">
      <div className="editor-horarios__barra">
        <button type="button" className="btn btn--chico" onClick={copiarLunes}><Copy size={15} /> Copiar el lunes de martes a viernes</button>
      </div>
      <div className="editor-horarios__dias" role="group" aria-label="Días y horarios de atención">
        {valor.map((d, i) => (
          <div key={DIAS[i]} className={`editor-horarios__fila ${d.abierto ? '' : 'editor-horarios__fila--cerrado'} ${problema?.dia === i ? 'editor-horarios__fila--error' : ''}`}>
            <label className="editor-horarios__dia check">
              <input type="checkbox" checked={d.abierto} onChange={(e) => abrir(i, e.target.checked)} />
              <span><strong>{DIAS[i]}</strong> <small className="texto-gris">{d.abierto ? 'Abierto' : 'Cerrado'}</small></span>
            </label>
            {d.abierto && (
              <div className="editor-horarios__turnos">
                {d.turnos.map((t, j) => (
                  <div key={j} className="editor-horarios__turno">
                    <span className="texto-gris editor-horarios__y">{j > 0 ? 'y' : ''}</span>
                    <input type="time" className="input" step="900" value={t.desde} required aria-label={`${DIAS[i]}: abre a las`}
                      id={i === 0 && j === 0 ? id : undefined} onChange={(e) => cambiarTurno(i, j, 'desde', e.target.value)} />
                    <span className="texto-gris">a</span>
                    <input type="time" className="input" step="900" value={t.hasta} required aria-label={`${DIAS[i]}: cierra a las`}
                      onChange={(e) => cambiarTurno(i, j, 'hasta', e.target.value)} />
                    {j > 0 && (
                      <button type="button" className="btn-icono" aria-label={`Quitar el segundo turno del ${DIAS[i].toLowerCase()}`}
                        onClick={() => cambiarDia(i, { turnos: d.turnos.slice(0, 1) })}><X size={16} /></button>
                    )}
                  </div>
                ))}
                {d.turnos.length === 1 && (
                  <button type="button" className="enlace texto-chico editor-horarios__cortado" onClick={() => agregarTurno(i)}>
                    <Plus size={14} /> Horario cortado
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      {problema ? (
        <p className="campo__error">{problema.dia !== null ? `${DIAS[problema.dia]}: ` : ''}{problema.mensaje}</p>
      ) : (
        <p className="editor-horarios__resumen"><Clock size={15} /> <span>Así lo ven los compradores: <strong>{resumen}</strong></span></p>
      )}
    </div>
  );
}

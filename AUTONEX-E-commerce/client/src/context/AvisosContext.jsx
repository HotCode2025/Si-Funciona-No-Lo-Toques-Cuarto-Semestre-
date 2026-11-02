import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

const AvisosContext = createContext(null);
let siguienteId = 1;

const ICONOS = { exito: CheckCircle2, error: AlertTriangle, info: Info };

export function AvisosProvider({ children }) {
  const [avisos, setAvisos] = useState([]);

  const cerrar = useCallback((id) => setAvisos((lista) => lista.filter((a) => a.id !== id)), []);

  const avisar = useCallback((mensaje, tipo = 'exito', duracion = 3800) => {
    const id = siguienteId++;
    setAvisos((lista) => [...lista.slice(-3), { id, mensaje, tipo }]);
    setTimeout(() => cerrar(id), duracion);
  }, [cerrar]);

  const valor = useMemo(() => ({ avisar }), [avisar]);

  return (
    <AvisosContext.Provider value={valor}>
      {children}
      <div className="avisos" role="status" aria-live="polite">
        {avisos.map((a) => {
          const Icono = ICONOS[a.tipo] || Info;
          return (
            <div key={a.id} className={`aviso aviso--${a.tipo}`}>
              <Icono size={18} aria-hidden="true" />
              <span>{a.mensaje}</span>
              <button type="button" className="aviso__cerrar" onClick={() => cerrar(a.id)} aria-label="Cerrar aviso">
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </AvisosContext.Provider>
  );
}

export const useAvisos = () => useContext(AvisosContext);

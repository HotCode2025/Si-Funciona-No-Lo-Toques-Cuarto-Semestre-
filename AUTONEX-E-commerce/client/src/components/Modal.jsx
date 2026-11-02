import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function Modal({ abierto, alCerrar, titulo, children, ancho = 760 }) {
  const panel = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;
    const anterior = document.activeElement;
    const alTecla = (e) => {
      if (e.key === 'Escape') alCerrar();
    };
    document.addEventListener('keydown', alTecla);
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    return () => {
      document.removeEventListener('keydown', alTecla);
      document.body.style.overflow = '';
      anterior?.focus?.();
    };
  }, [abierto, alCerrar]);

  if (!abierto) return null;
  return createPortal(
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && alCerrar()}>
      <div className="modal__panel" role="dialog" aria-modal="true" aria-label={titulo} tabIndex={-1} ref={panel}
        style={{ maxWidth: ancho }}>
        <div className="modal__cabecera">
          <h2 className="modal__titulo">{titulo}</h2>
          <button type="button" className="btn-icono" onClick={alCerrar} aria-label="Cerrar"><X size={20} /></button>
        </div>
        <div className="modal__cuerpo">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

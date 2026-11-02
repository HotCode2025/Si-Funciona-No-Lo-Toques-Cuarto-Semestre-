import { TONOS_VERIFICACION } from '../lib/constantes.js';
import { etiquetaDe, useReferencias } from '../lib/hooks.js';

/** Sello con el estado de verificación de un dato (el texto sale de /api/referencias). */
export function SelloVerificacion({ estado }) {
  const referencias = useReferencias();
  if (!estado) return null;
  return (
    <span className={`verificacion verificacion--${TONOS_VERIFICACION[estado] || 'gris'}`}
      title={referencias?.estados_verificacion.find((e) => e.valor === estado)?.descripcion}>
      {etiquetaDe(referencias, 'estados_verificacion', estado)}
    </span>
  );
}

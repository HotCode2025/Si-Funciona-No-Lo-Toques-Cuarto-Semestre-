import { useFetch } from './useFetch.js';

/**
 * Las reglas del sistema de tokens (premios, rachas, reputación), leídas de
 * la API. Cualquier texto que mencione un monto las usa en vez de escribir el
 * número a mano: los premios ya cambiaron varias veces y así ninguna pantalla
 * queda diciendo un valor viejo. Devuelve null mientras cargan.
 */
export function useReglas() {
  const { data } = useFetch('/tokens/reglas');
  return data?.reglas ?? null;
}

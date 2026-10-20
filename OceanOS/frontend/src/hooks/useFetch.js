import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api.js';

/**
 * GET con estados de carga y error, y un `recargar` para después de
 * escribir. Cancela el set de estado si el componente se desmontó.
 */
export function useFetch(ruta, deps = [], { activo = true } = {}) {
  const [data, setData]       = useState(null);
  const [error, setError]     = useState(null);
  const [loading, setLoading] = useState(activo);
  const [señal, setSeñal]     = useState(0);

  const recargar = useCallback(() => setSeñal((n) => n + 1), []);

  useEffect(() => {
    if (!activo || !ruta) { setLoading(false); return; }
    let vivo = true;
    setLoading(true);
    setError(null);

    api.get(ruta)
      .then((d) => { if (vivo) { setData(d); setLoading(false); } })
      .catch((e) => { if (vivo) { setError(e); setLoading(false); } });

    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruta, señal, activo, ...deps]);

  return { data, error, loading, recargar };
}

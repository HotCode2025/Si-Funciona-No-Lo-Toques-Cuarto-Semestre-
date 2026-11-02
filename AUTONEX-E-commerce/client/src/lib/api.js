// Cliente HTTP de la API de AUTONEX. Todas las rutas cuelgan de <base>/api.

const BASE_API = `${import.meta.env.BASE_URL}api`;
const CLAVE_TOKEN = 'autonex.token';

export function leerToken() {
  try {
    return localStorage.getItem(CLAVE_TOKEN);
  } catch {
    return null;
  }
}

export function guardarToken(token) {
  try {
    if (token) localStorage.setItem(CLAVE_TOKEN, token);
    else localStorage.removeItem(CLAVE_TOKEN);
  } catch {
    /* sin localStorage: la sesión dura lo que la pestaña */
  }
}

export class ErrorApi extends Error {
  constructor(status, cuerpo) {
    super(cuerpo?.mensaje || 'No pudimos completar la operación.');
    this.status = status;
    this.codigo = cuerpo?.error;
    this.detalles = cuerpo?.detalles || [];
    this.cuerpo = cuerpo;
  }
}

export async function api(ruta, { method = 'GET', body, query, signal, headers: extra } = {}) {
  let url = `${BASE_API}${ruta}`;
  if (query) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') params.set(k, v);
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }
  const headers = { ...extra };
  const token = leerToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  // FormData (subida de archivos) la arma el navegador con su boundary; el resto viaja como JSON
  const esFormulario = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !esFormulario) headers['Content-Type'] = 'application/json';

  let respuesta;
  try {
    respuesta = await fetch(url, { method, headers, body: body === undefined || esFormulario ? body : JSON.stringify(body), signal });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ErrorApi(0, { mensaje: 'No hay conexión con el servidor de AUTONEX. Revisá tu conexión e intentá de nuevo.' });
  }

  const tipo = respuesta.headers.get('content-type') || '';
  const datos = tipo.includes('application/json') ? await respuesta.json() : null;
  if (!respuesta.ok) {
    if (respuesta.status === 401 && token) window.dispatchEvent(new Event('autonex:sesion-vencida'));
    throw new ErrorApi(respuesta.status, datos);
  }
  return datos;
}

/** Descarga un archivo protegido (CSV de plantillas o de errores): pide con el token y lo guarda con su nombre. */
export async function descargar(ruta, nombreArchivo) {
  const token = leerToken();
  const respuesta = await fetch(`${BASE_API}${ruta}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!respuesta.ok) {
    const tipo = respuesta.headers.get('content-type') || '';
    throw new ErrorApi(respuesta.status, tipo.includes('application/json') ? await respuesta.json() : null);
  }
  const url = URL.createObjectURL(await respuesta.blob());
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

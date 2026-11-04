/**
 * Cliente del servicio de IA (carpeta /ia del repo).
 * La URL sale de VITE_IA_URL. Sin URL, la app funciona igual: solo se apaga el análisis de fotos.
 */
export const IA_BASE = (import.meta.env.VITE_IA_URL ?? '').replace(/\/$/, '');
export const iaConfigurada = () => IA_BASE !== '';

class ErrorIA extends Error {
  constructor(mensaje, tipo) { super(mensaje); this.tipo = tipo; }
}

/** Las fotos de celular pesan 4-10 MB: se achican antes de subirlas (con datos móviles se nota). */
async function prepararArchivo(archivo) {
  if (archivo.size <= 4 * 1024 * 1024 || !('createImageBitmap' in window)) return archivo;
  try {
    const bmp = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(bmp.width * k); lienzo.height = Math.round(bmp.height * k);
    lienzo.getContext('2d').drawImage(bmp, 0, 0, lienzo.width, lienzo.height);
    return await new Promise((ok) => lienzo.toBlob((b) => ok(b ?? archivo), 'image/jpeg', 0.85));
  } catch { return archivo; }
}

async function pedir(ruta, opciones = {}, ms = 45000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(`${IA_BASE}${ruta}`, { ...opciones, signal: ctl.signal });
    if (!r.ok) {
      const detalle = (await r.json().catch(() => ({}))).detail;
      throw new ErrorIA(typeof detalle === 'string' ? detalle : 'El servicio de IA rechazó la foto', 'rechazada');
    }
    return await r.json();
  } catch (e) {
    if (e instanceof ErrorIA) throw e;
    throw new ErrorIA('No pude conectarme con la IA. Podés enviar el reporte igual.', 'sin_conexion');
  } finally { clearTimeout(t); }
}

export async function analizarFoto(archivo, { grupo } = {}) {
  const datos = new FormData();
  datos.append('foto', await prepararArchivo(archivo), 'foto.jpg');
  if (grupo) datos.append('grupo', grupo);
  return pedir('/analizar', { method: 'POST', body: datos });
}

export const etiquetarFoto = (fotoId, etiqueta, fuente, quien, grupo) =>
  pedir(`/fotos/${fotoId}/etiqueta`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ etiqueta, fuente, quien: String(quien ?? 'anonimo'), grupo }),
  }, 15000);

export const estadoModelo = () => pedir('/modelo', {}, 15000);
export const reentrenar = (token) => pedir('/entrenar', { method: 'POST', headers: { 'X-Admin-Token': token } }, 15000);
export const estadoEntrenamiento = () => pedir('/entrenar/estado', {}, 15000);

/** De la photo_url de un reporte (…/fotos/<id>/imagen?clase=<id>) saca qué foto y qué especie se declaró. */
export function etiquetaDesdeFoto(photoUrl) {
  if (!iaConfigurada() || !photoUrl?.startsWith(IA_BASE)) return null;
  try {
    const u = new URL(photoUrl); const m = u.pathname.match(/\/fotos\/([^/]+)\/imagen/);
    const clase = u.searchParams.get('clase');
    return m && clase ? { fotoId: m[1], clase } : null;
  } catch { return null; }
}

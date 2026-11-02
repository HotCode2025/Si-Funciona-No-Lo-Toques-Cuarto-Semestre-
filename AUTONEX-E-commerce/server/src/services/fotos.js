import crypto from 'node:crypto';
import sharp from 'sharp';
import { ErrorApi } from '../errores.js';

// Imágenes que suben los usuarios: se validan (que sea una imagen de verdad), se giran según el EXIF, se reducen y se
// convierten a WebP. Se guardan en la base (tabla archivos) y se sirven en /api/archivos/:id.
//   - fotos de las publicaciones: hasta 1600 px, sin recortar
//   - logo del local: cuadrado de 512 px, sin recortar (el logo entero sobre fondo blanco)
//   - foto de perfil: cuadrado de 400 px, recortado al centro

export const MAX_FOTOS_POR_PUBLICACION = 6;
export const MAX_BYTES_FOTO = 8 * 1024 * 1024;
const FORMATOS = new Set(['jpeg', 'png', 'webp']);

/** URL relativa con la que el frontend muestra un archivo (la resuelve con la base de la app). */
export const urlArchivo = (archivoId) => `api/archivos/${archivoId}`;

async function validar(buffer, nombre, minimo) {
  let meta;
  try {
    meta = await sharp(buffer).metadata();
  } catch {
    throw new ErrorApi(400, `"${nombre}" no es una imagen válida. Subí fotos JPG, PNG o WebP.`);
  }
  if (!FORMATOS.has(meta.format)) {
    throw new ErrorApi(400, `"${nombre}" está en formato ${meta.format || 'desconocido'}. Subí fotos JPG, PNG o WebP.`);
  }
  if ((meta.width || 0) < minimo || (meta.height || 0) < minimo) {
    throw new ErrorApi(400, `"${nombre}" es muy chica (${meta.width}×${meta.height}). Subí una imagen de al menos ${minimo}×${minimo} píxeles.`);
  }
}

async function aWebp(imagen) {
  const { data, info } = await imagen.webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
  return {
    datos: data,
    tipo_mime: 'image/webp',
    ancho: info.width,
    alto: info.height,
    bytes: data.length,
    sha256: crypto.createHash('sha256').update(data).digest('hex'),
  };
}

export async function procesarFoto(buffer, nombre = 'la foto') {
  await validar(buffer, nombre, 200);
  return aWebp(sharp(buffer).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }));
}

/** Logo del local: entra completo en un cuadrado blanco de 512 px. */
export async function procesarLogo(buffer, nombre = 'el logo') {
  await validar(buffer, nombre, 100);
  return aWebp(sharp(buffer).rotate().flatten({ background: '#ffffff' })
    .resize({ width: 512, height: 512, fit: 'contain', background: '#ffffff' }));
}

/** Foto de perfil: cuadrado de 400 px recortado al centro. */
export async function procesarAvatar(buffer, nombre = 'la foto') {
  await validar(buffer, nombre, 100);
  return aWebp(sharp(buffer).rotate().resize({ width: 400, height: 400, fit: 'cover', position: 'centre' }));
}

/** Guarda un archivo procesado y devuelve su id. `clave`: para archivos privados (se sirven solo con ?k=clave). */
export async function guardarArchivo(db, f, { clave = null } = {}) {
  const { rows: [archivo] } = await db.query(
    'INSERT INTO archivos (datos, tipo_mime, ancho, alto, bytes, sha256, clave) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
    [f.datos, f.tipo_mime, f.ancho, f.alto, f.bytes, f.sha256, clave]);
  return archivo.id;
}

/** Lee la única imagen de un pedido multipart/form-data (traduce los errores de tamaño). */
export async function leerImagenSubida(request) {
  if (!request.isMultipart()) throw new ErrorApi(400, 'Enviá la imagen como multipart/form-data.');
  let parte;
  try {
    parte = await request.file();
    if (!parte) throw new ErrorApi(400, 'Elegí una imagen.');
    const datos = await parte.toBuffer();
    if (parte.file.truncated) throw new ErrorApi(413, 'La imagen puede pesar hasta 8 MB.');
    return { datos, nombre: parte.filename };
  } catch (error) {
    if (error.code === 'FST_REQ_FILE_TOO_LARGE') throw new ErrorApi(413, 'La imagen puede pesar hasta 8 MB.');
    throw error;
  }
}

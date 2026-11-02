// Vuelve a descargar desde Wikimedia Commons las imágenes listadas en client/public/img/creditos.json
// que falten en el disco, y las recorta al mismo tamaño que usa la app.
//   npm run imagenes -w autonex-server        (usa sharp, que es dependencia de desarrollo)
//
// Pide miniaturas de tamaño estándar (960 o 500 px): Wikimedia limita la descarga de archivos originales.

import fs from 'node:fs';
import path from 'node:path';
import { config } from '../src/config.js';

const { default: sharp } = await import('sharp').catch(() => {
  console.error('Falta sharp. Instalalo con: npm install -D sharp -w autonex-server');
  process.exit(1);
});

const UA = 'AUTONEX-demo/1.0 (proyecto universitario)';
const IMG = path.join(config.clientePublic, 'img');
const TAMANOS = { categorias: [800, 600], marcas: [960, 600], productos: [800, 600] };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const forzar = process.argv.includes('--todas');

async function pedir(url, comoJson) {
  for (let intento = 1; intento <= 8; intento++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA } }).catch(() => null);
    if (r?.ok) return comoJson ? r.json() : Buffer.from(await r.arrayBuffer());
    await esperar(4000 * intento);
  }
  throw new Error(`No se pudo descargar ${url}`);
}

const creditos = JSON.parse(fs.readFileSync(path.join(IMG, 'creditos.json'), 'utf8'));
let bajadas = 0;
for (const c of creditos) {
  const destino = path.join(config.clientePublic, c.archivo);
  if (!forzar && fs.existsSync(destino)) continue;
  const carpeta = c.archivo.split('/')[1];
  const [ancho, alto] = TAMANOS[carpeta];
  const api = `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({
    action: 'query', format: 'json', titles: `File:${c.titulo}`, prop: 'imageinfo', iiprop: 'url|size', iiurlwidth: '960',
  })}`;
  const info = Object.values((await pedir(api, true)).query.pages)[0].imageinfo[0];
  let url = info.thumburl;
  if (info.width <= 960) {
    const chica = await pedir(api.replace('iiurlwidth=960', 'iiurlwidth=500'), true);
    url = Object.values(chica.query.pages)[0].imageinfo[0].thumburl;
  }
  const original = await pedir(url, false);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  await sharp(original).rotate().resize(ancho, alto, { fit: 'cover' }).jpeg({ quality: 80, mozjpeg: true }).toFile(destino);
  bajadas++;
  console.log(`  ${c.archivo}`);
  await esperar(3000);
}
console.log(bajadas ? `Descargadas ${bajadas} imágenes.` : 'Todas las imágenes ya estaban en el disco.');

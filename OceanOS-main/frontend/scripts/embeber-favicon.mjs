/**
 * Último paso de la build de archivo único: el ícono queda dentro del HTML.
 * vite-plugin-singlefile embebe el JavaScript y los estilos, pero el favicon
 * sigue siendo un archivo aparte, y la idea es entregar uno solo.
 */
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';

const salida = 'dist-unico';
const html = `${salida}/index.html`;
const icono = `${salida}/favicon.svg`;

if (!existsSync(icono)) {
  console.log('No hay favicon que embeber.');
  process.exit(0);
}

const svg = readFileSync(icono, 'utf8');
const datos = `data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27')}`;

const antes = readFileSync(html, 'utf8');
const despues = antes.replace(/(<link rel="icon" href=")[^"]*(")/, `$1${datos}$2`);

if (antes === despues) {
  console.error('No se encontró la etiqueta del ícono en el HTML.');
  process.exit(1);
}

writeFileSync(html, despues);
rmSync(icono);
console.log(`Ícono embebido. Un solo archivo: ${(despues.length / 1024 / 1024).toFixed(2)} MB`);

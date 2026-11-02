// Genera CREDITOS-IMAGENES.md (en la raíz del proyecto) a partir de client/public/img/creditos.json.
//   node scripts/generar-creditos.js

import fs from 'node:fs';
import path from 'node:path';
import { config, RAIZ_PROYECTO } from '../src/config.js';

const creditos = JSON.parse(fs.readFileSync(path.join(config.clientePublic, 'img', 'creditos.json'), 'utf8'));

const SECCIONES = [
  ['img/categorias/', 'Categorías'],
  ['img/marcas/', 'Marcas de vehículos'],
  ['img/productos/', 'Repuestos'],
];

const celda = (texto = '') => String(texto).replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

let md = `# Créditos de imágenes · AUTONEX

Todas las fotos de AUTONEX salen de **Wikimedia Commons** y tienen licencia libre (dominio público, CC0,
CC BY o CC BY-SA). Se descargaron a \`client/public/img\` y se recortaron a un tamaño uniforme
(800×600 o 960×600); ese recorte es la única modificación. La ruta local de cada una se guarda en la base de datos.

Las fotos de los repuestos son **ilustrativas**: muestran el tipo de pieza, no necesariamente la marca exacta
del producto publicado. Cuando un tipo de repuesto no tiene foto propia (bomba de agua y mangueras), el producto
usa la imagen genérica de su categoría.

- Fotos de categorías, marcas y repuestos: **${creditos.length}** (más los logos y las fotos de motos, en sus secciones)
- Para volver a descargarlas: \`npm run imagenes -w autonex-server\` (lee \`client/public/img/creditos.json\`).

`;

for (const [prefijo, titulo] of SECCIONES) {
  const filas = creditos.filter((c) => c.archivo.startsWith(prefijo));
  md += `## ${titulo}\n\n| Archivo | Imagen original | Autor | Licencia |\n|---|---|---|---|\n`;
  for (const c of filas) {
    const licencia = c.licencia_url ? `[${celda(c.licencia)}](${c.licencia_url})` : celda(c.licencia);
    md += `| \`${c.archivo.replace('img/', '')}\` | [${celda(c.titulo)}](${c.fuente}) | ${celda(c.autor)} | ${licencia} |\n`;
  }
  md += '\n';
}

// Logos de marcas de vehículos (los descarga scripts/logos-marcas.js)
const rutaLogos = path.join(config.clientePublic, 'img', 'marcas', 'logos', 'logos.json');
const logos = fs.existsSync(rutaLogos) ? JSON.parse(fs.readFileSync(rutaLogos, 'utf8')) : [];
if (logos.length) {
  md += `## Logos de marcas de vehículos

Los logos son **marcas registradas de sus respectivos dueños**. AUTONEX los muestra solo para identificar cada marca
en el selector de vehículos, en un proyecto universitario sin fines comerciales; no implican relación ni respaldo de
los fabricantes. Salen de **Wikimedia Commons** (archivo y licencia de cada uno abajo) y, cuando no estaban ahí, de
**Beepaway** (<https://beepaway.com/es/logos>), que los ofrece para uso educativo o no comercial. Se recortaron los
bordes y se ajustaron a 320×160 px. Las marcas sin logo en esas fuentes se muestran con sus iniciales.

- Logos: **${logos.length}** (Wikimedia Commons ${logos.filter((l) => l.fuente === 'wikimedia').length} · Beepaway ${logos.filter((l) => l.fuente === 'beepaway').length})
- Para volver a buscarlos: \`npm run logos:marcas -w autonex-server\`

| Marca | Archivo original | Autor | Licencia |
|---|---|---|---|
`;
  for (const l of logos) {
    const licencia = l.licencia_url ? `[${celda(l.licencia)}](${l.licencia_url})` : celda(l.licencia);
    md += `| ${celda(l.marca)} | [${celda(l.titulo)}](${l.origen}) | ${celda(l.autor)} | ${licencia} |\n`;
  }
  md += '\n';
}

// Logos de marcas de repuestos para motos (scripts/logos-marcas.js --repuestos)
const rutaLogosRepuestos = path.join(config.clientePublic, 'img', 'marcas-repuesto', 'logos', 'logos.json');
const logosRepuestos = fs.existsSync(rutaLogosRepuestos) ? JSON.parse(fs.readFileSync(rutaLogosRepuestos, 'utf8')) : [];
if (logosRepuestos.length) {
  md += `## Logos de marcas de repuestos

Marcas registradas de sus dueños, mostradas solo para identificar cada marca en la página de marcas de repuestos para
motos. Salen de **Wikimedia Commons** (archivo y licencia de cada uno abajo); se usa el logo de la marca, nunca el del
grupo dueño. Las marcas sin logo en Commons se muestran con sus iniciales.

- Logos: **${logosRepuestos.length}**
- Para volver a buscarlos: \`npm run logos:marcas -w autonex-server -- --repuestos\`

| Marca | Archivo original | Autor | Licencia |
|---|---|---|---|
`;
  for (const l of logosRepuestos) {
    const licencia = l.licencia_url ? `[${celda(l.licencia)}](${l.licencia_url})` : celda(l.licencia);
    md += `| ${celda(l.marca)} | [${celda(l.titulo)}](${l.origen}) | ${celda(l.autor)} | ${licencia} |\n`;
  }
  md += '\n';
}

// Fotos de modelos de motos (las descarga scripts/motos/wikidata-motos.js). También se escribe
// client/public/img/motos/fotos.json, que lee la página de créditos.
const rutaMotos = path.join(RAIZ_PROYECTO, 'server', 'db', 'datos', 'motos', 'wikidata-motos.json');
const fotosMotos = fs.existsSync(rutaMotos)
  ? JSON.parse(fs.readFileSync(rutaMotos, 'utf8')).modelos.filter((m) => m.imagen?.archivo)
    .map((m) => ({
      archivo: m.imagen.archivo, marca: m.marca, modelo: m.nombre, titulo: m.imagen.titulo, autor: m.imagen.autor,
      licencia: m.imagen.licencia, licencia_url: m.imagen.licencia_url, origen: m.imagen.url_origen,
    }))
    .sort((a, b) => a.marca.localeCompare(b.marca, 'es') || a.modelo.localeCompare(b.modelo, 'es'))
  : [];
if (fotosMotos.length) {
  fs.writeFileSync(path.join(config.clientePublic, 'img', 'motos', 'fotos.json'), JSON.stringify(fotosMotos));
  md += `## Fotos de modelos de motos

Fotos reales de cada modelo, tomadas de la imagen que **Wikidata** asocia al modelo (propiedad P18) y descargadas de
**Wikimedia Commons** con su licencia. Se redujeron a 640×480 px; ese recorte es la única modificación. Los modelos sin
foto en Commons quedan como \`IMAGE_MISSING\`: nunca se usa la foto de otro modelo parecido.

- Fotos: **${fotosMotos.length}**
- Para volver a descargarlas: \`npm run motos:wikidata -w autonex-server\`

| Moto | Archivo original | Autor | Licencia |
|---|---|---|---|
`;
  for (const f of fotosMotos) {
    const licencia = f.licencia_url ? `[${celda(f.licencia)}](${f.licencia_url})` : celda(f.licencia);
    md += `| ${celda(f.marca)} ${celda(f.modelo)} | [${celda(f.titulo)}](${f.origen}) | ${celda(f.autor)} | ${licencia} |\n`;
  }
  md += '\n';
}

md += `## Imágenes propias del proyecto

| Archivo | Descripción | Autor | Licencia |
|---|---|---|---|
| \`logo-autonex.svg\`, \`favicon.svg\` | Logo e ícono de AUTONEX, dibujados en SVG para el proyecto | Equipo AUTONEX | Uso libre dentro del proyecto |
| \`img/vendedores/*.svg\` | Logos de los vendedores ficticios (iniciales sobre un engranaje), generados con \`server/scripts/generar-logos-vendedores.js\` | Equipo AUTONEX | Uso libre dentro del proyecto |
| \`img/sin-imagen.svg\` | Ilustración de reemplazo cuando falta una foto | Equipo AUTONEX | Uso libre dentro del proyecto |
`;

const destino = path.join(RAIZ_PROYECTO, 'CREDITOS-IMAGENES.md');
fs.writeFileSync(destino, md);
console.log(`Escrito ${destino} (${creditos.length} fotos, ${logos.length} logos y ${fotosMotos.length} fotos de motos)`);

// Copia ordenada de todas las imágenes del proyecto en la carpeta "imagenes" de la raíz, para verlas y compartirlas.
// La app las sigue sirviendo desde client/public/img (es lo que publica Vite); esta carpeta es solo una copia.
//
//   npm run imagenes:carpeta -w autonex-server
//
//   imagenes/
//     logos de autos/        logos de las marcas de autos (+ logos.json con fuente, autor y licencia)
//     logos de motos/        logos de las marcas de motos (las que hacen autos y motos están en las dos)
//     logos de repuestos/    logos de las marcas de repuestos para motos (Brembo, NGK, Michelin…)
//     img de los autos/      fotos de las marcas de autos
//     img de las motos/      una foto real por modelo de moto, en una carpeta por marca (+ fotos.json con los créditos)
//     repuestos/             fotos de los repuestos
//     repuestos/categorias/  fotos de las categorías de repuestos
//     CREDITOS-IMAGENES.md   fuente, autor y licencia de cada imagen

import fs from 'node:fs';
import path from 'node:path';
import { config, RAIZ_PROYECTO } from '../src/config.js';
import { slugificar } from '../src/catalogo/normalizacion.js';
import { ALIAS_MARCA_MOTO, MARCAS_MOTO } from '../db/data/motos.js';

const IMG = path.join(config.clientePublic, 'img');
const DESTINO = path.join(RAIZ_PROYECTO, 'imagenes');

const CARPETAS = [
  ['marcas', 'img de los autos', /\.(jpe?g|png|webp)$/i],
  ['productos', 'repuestos', /\.(jpe?g|png|webp)$/i],
  ['categorias', 'repuestos/categorias', /\.(jpe?g|png|webp)$/i],
];

let total = 0;
function copiar(desde, hacia, filtro, { recursivo = false } = {}) {
  if (!fs.existsSync(desde)) return 0;
  fs.mkdirSync(hacia, { recursive: true });
  let n = 0;
  for (const f of fs.readdirSync(desde, { withFileTypes: true })) {
    if (f.isDirectory() && recursivo) n += copiar(path.join(desde, f.name), path.join(hacia, f.name), filtro, { recursivo });
    else if (f.isFile() && filtro.test(f.name)) {
      fs.copyFileSync(path.join(desde, f.name), path.join(hacia, f.name));
      n++;
    }
  }
  return n;
}

for (const [origen, carpeta, filtro] of CARPETAS) {
  const n = copiar(path.join(IMG, origen), path.join(DESTINO, carpeta), filtro);
  total += n;
  console.log(`  ${carpeta}: ${n}`);
}

// Logos: de autos (marcas del registro automotor) y de motos (lista de AUTONEX y fabricantes de Wikidata)
const rutaLogos = path.join(IMG, 'marcas', 'logos', 'logos.json');
if (fs.existsSync(rutaLogos)) {
  const logos = JSON.parse(fs.readFileSync(rutaLogos, 'utf8'));
  const rutaDnrpa = path.join(RAIZ_PROYECTO, 'server', 'db', 'datos', 'dnrpa', 'vehiculos.csv');
  const deAutos = new Set(fs.existsSync(rutaDnrpa)
    ? fs.readFileSync(rutaDnrpa, 'utf8').split('\n').slice(1).map((l) => l.split(',')[1]).filter(Boolean).map(slugificar) : []);
  const rutaMotos = path.join(RAIZ_PROYECTO, 'server', 'db', 'datos', 'motos', 'wikidata-motos.json');
  const deMotos = new Set([
    ...Object.values(MARCAS_MOTO).flat().map((m) => slugificar(ALIAS_MARCA_MOTO[m] || m)),
    ...(fs.existsSync(rutaMotos) ? JSON.parse(fs.readFileSync(rutaMotos, 'utf8')).modelos.map((m) => slugificar(m.marca)) : []),
  ]);
  const grupos = { 'logos de autos': logos.filter((l) => deAutos.has(l.slug) || !deMotos.has(l.slug)), 'logos de motos': logos.filter((l) => deMotos.has(l.slug)) };
  for (const [carpeta, lista] of Object.entries(grupos)) {
    const hacia = path.join(DESTINO, carpeta);
    fs.mkdirSync(hacia, { recursive: true });
    for (const l of lista) fs.copyFileSync(path.join(config.clientePublic, l.archivo), path.join(hacia, path.basename(l.archivo)));
    fs.writeFileSync(path.join(hacia, 'logos.json'), JSON.stringify(lista, null, 2));
    total += lista.length;
    console.log(`  ${carpeta}: ${lista.length}`);
  }
}

// Logos de marcas de repuestos
const nRepuestos = copiar(path.join(IMG, 'marcas-repuesto', 'logos'), path.join(DESTINO, 'logos de repuestos'), /\.(png|json)$/i);
total += nRepuestos;
console.log(`  logos de repuestos: ${nRepuestos}`);

// Fotos de motos: img/motos/<marca>/<modelo>.jpg
const nMotos = copiar(path.join(IMG, 'motos'), path.join(DESTINO, 'img de las motos'), /\.(jpe?g|png|webp|json)$/i, { recursivo: true });
total += nMotos;
console.log(`  img de las motos: ${nMotos}`);

const creditos = path.join(RAIZ_PROYECTO, 'CREDITOS-IMAGENES.md');
if (fs.existsSync(creditos)) fs.copyFileSync(creditos, path.join(DESTINO, 'CREDITOS-IMAGENES.md'));
console.log(`Copiadas ${total} imágenes en ${DESTINO}`);

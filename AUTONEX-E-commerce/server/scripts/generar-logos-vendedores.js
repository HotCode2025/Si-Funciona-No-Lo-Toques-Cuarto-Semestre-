// Genera los logos SVG de los vendedores ficticios en client/public/img/vendedores.
// Son logos inventados para el demo (iniciales + color del local), no marcas reales.
//   node scripts/generar-logos-vendedores.js

import fs from 'node:fs';
import path from 'node:path';
import { config } from '../src/config.js';
import { VENDEDORES } from '../db/data/vendedores.js';
import { VENDEDORES_REGIONALES } from '../db/data/vendedores-regionales.js';

const destino = path.join(config.clientePublic, 'img', 'vendedores');
fs.mkdirSync(destino, { recursive: true });

const PALABRAS_VACIAS = new Set(['de', 'del', 'la', 'el', 'y', 'los', 'las']);

function iniciales(nombre) {
  return nombre
    .split(/\s+/)
    .filter((p) => !PALABRAS_VACIAS.has(p.toLowerCase()))
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

// Engranaje de 8 dientes centrado en (100,100)
function engranaje(radio, dientes = 8) {
  const puntos = [];
  for (let i = 0; i < dientes * 2; i++) {
    const r = i % 2 === 0 ? radio : radio * 0.86;
    for (const d of [-0.18, 0.18]) {
      const a = ((i + 0.5 + d) / (dientes * 2)) * Math.PI * 2;
      puntos.push(`${(100 + r * Math.cos(a)).toFixed(1)},${(100 + r * Math.sin(a)).toFixed(1)}`);
    }
  }
  return puntos.join(' ');
}

for (const v of [...VENDEDORES, ...VENDEDORES_REGIONALES]) {
  const ini = iniciales(v.nombre_comercial);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img" aria-label="${v.nombre_comercial}">
  <rect width="200" height="200" rx="36" fill="${v.color}"/>
  <polygon points="${engranaje(78)}" fill="none" stroke="#ffffff" stroke-opacity=".28" stroke-width="6" stroke-linejoin="round"/>
  <circle cx="100" cy="100" r="54" fill="#ffffff" fill-opacity=".14"/>
  <text x="100" y="100" dy=".36em" text-anchor="middle" font-family="'Barlow Condensed','Arial Narrow',Arial,sans-serif"
        font-weight="800" font-style="italic" font-size="${ini.length > 1 ? 70 : 84}" fill="#ffffff" letter-spacing="1">${ini}</text>
</svg>
`;
  fs.writeFileSync(path.join(destino, `${v.slug}.svg`), svg);
  console.log(`  ${v.slug}.svg  (${ini})`);
}
console.log(`Logos generados en ${destino}`);

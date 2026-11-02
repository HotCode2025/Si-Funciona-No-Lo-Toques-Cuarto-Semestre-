// Importa un archivo (CSV, Excel o JSON) al catálogo desde la terminal, con las mismas reglas que el panel:
// fuente obligatoria, trazabilidad, errores por fila y posibles duplicados para revisión.
//
//   npm run importar -- --entidad repuestos --fuente distribuidor-x --archivo catalogo.xlsx [opciones]
//
// Opciones:
//   --entidad       marcas | modelos | generaciones | motores | vehiculos | categorias | repuestos | oem |
//                   equivalencias | compatibilidades | publicaciones
//   --fuente        slug o id de la fuente (tiene que existir: se crea en el panel, sección Fuentes)
//   --archivo       ruta del archivo
//   --formato       csv | excel | json (si no, se deduce de la extensión)
//   --hoja          nombre de la hoja (Excel)
//   --proveedor     id del proveedor
//   --estado        estado de verificación por defecto (VERIFIED, UNVERIFIED, NEEDS_REVIEW, DISCONTINUED)
//   --confianza     alta | media | baja
//   --duplicados    retener (por defecto) | marcar | crear
//   --validar       solo valida y muestra el resultado, sin guardar nada
//   --plantilla     escribe la cabecera CSV de la entidad en la salida estándar y termina

import fs from 'node:fs';
import path from 'node:path';
import { pool } from '../src/db.js';
import { leerArchivo } from '../src/importacion/lectores.js';
import { importar } from '../src/importacion/importador.js';
import { ENTIDADES } from '../src/importacion/entidades.js';
import { plantilla } from '../src/admin/revision.js';

function argumentos() {
  const args = {};
  const lista = process.argv.slice(2);
  for (let i = 0; i < lista.length; i++) {
    if (!lista[i].startsWith('--')) continue;
    const clave = lista[i].slice(2);
    const valor = lista[i + 1] && !lista[i + 1].startsWith('--') ? lista[++i] : true;
    args[clave] = valor;
  }
  return args;
}

function ayuda(mensaje) {
  if (mensaje) console.error(`\n${mensaje}\n`);
  console.error('Uso: npm run importar -- --entidad <entidad> --fuente <slug> --archivo <ruta> [--validar] [--duplicados marcar]');
  console.error(`Entidades: ${Object.keys(ENTIDADES).join(', ')}`);
  process.exit(1);
}

async function main() {
  const a = argumentos();
  if (a.plantilla) {
    if (!ENTIDADES[a.entidad]) ayuda('Indicá --entidad para generar la plantilla.');
    process.stdout.write(plantilla(a.entidad));
    return;
  }
  if (!ENTIDADES[a.entidad]) ayuda('Falta --entidad o no es válida.');
  if (!a.fuente) ayuda('Falta --fuente: toda importación queda registrada con su origen.');
  if (!a.archivo || !fs.existsSync(a.archivo)) ayuda('Falta --archivo o no existe.');
  if (a.duplicados && !['retener', 'marcar', 'crear'].includes(a.duplicados)) ayuda('--duplicados tiene que ser retener, marcar o crear.');

  const { formato, filas } = await leerArchivo({ contenido: fs.readFileSync(a.archivo), nombre: a.archivo, formato: a.formato, hoja: a.hoja });
  console.log(`${filas.length} filas leídas de ${path.basename(a.archivo)} (${formato}).${a.validar ? ' Solo validación.' : ''}`);
  const inicio = Date.now();
  const r = await importar(pool, {
    entidad: a.entidad, filas, fuente: a.fuente, formato, archivo: path.basename(a.archivo),
    proveedorId: a.proveedor ? Number(a.proveedor) : null,
    soloValidar: Boolean(a.validar),
    opciones: {
      estadoPorDefecto: a.estado || undefined,
      confianzaPorDefecto: a.confianza || undefined,
      crearDuplicados: a.duplicados === 'crear',
      marcarDuplicados: a.duplicados === 'marcar',
    },
    log: console.log,
  });
  console.log(`\nImportación #${r.importacion_id} · ${r.estado} · ${((Date.now() - inicio) / 1000).toFixed(1)} s`);
  console.log(`  creadas ${r.creado} · actualizadas ${r.actualizado} · sin cambios ${r.sin_cambios} · duplicadas ${r.duplicado} · con error ${r.error}`);
  if (Object.keys(r.creados_por_entidad).length) console.log(`  altas: ${JSON.stringify(r.creados_por_entidad)}`);
  if (r.columnas_ignoradas.length) console.log(`  columnas ignoradas: ${r.columnas_ignoradas.join(', ')}`);
  for (const [nota, n] of Object.entries(r.notas)) console.log(`  ${n} × ${nota}`);
  for (const e of r.primeros_errores.slice(0, 15)) console.log(`  fila ${e.fila}${e.campo ? ` (${e.campo})` : ''}: ${e.mensaje}`);
  if (r.error > 15) console.log(`  … ${r.error - 15} errores más: descargalos desde el panel (Importaciones #${r.importacion_id}).`);
}

main()
  .catch((e) => {
    console.error(`Error: ${e.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

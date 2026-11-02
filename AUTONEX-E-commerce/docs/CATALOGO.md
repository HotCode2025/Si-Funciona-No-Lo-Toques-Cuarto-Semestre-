# Catálogo de AUTONEX: vehículos, repuestos y compatibilidades

Este documento explica cómo está armado el catálogo, de dónde salen los datos y **cómo agregar datos nuevos**
(marcas, modelos, versiones, repuestos, números OEM, equivalencias y compatibilidades).

La regla de fondo: **AUTONEX no inventa datos**. Cada dato guarda de qué fuente salió, cuándo se importó y si está
verificado. Lo que no se pudo confirmar queda `NEEDS_REVIEW` o `UNVERIFIED`, y la tienda **nunca muestra como
confirmada una compatibilidad que no está verificada**.

---

## 1. Qué hay cargado hoy

| Dato | Cantidad | Fuente | Estado |
|---|---|---|---|
| Marcas de vehículos | ~234 (argentinas o vendidas en Argentina) | DNRPA (registro automotor, datos abiertos) | `VERIFIED` |
| Modelos | ~3.620 | DNRPA | `VERIFIED` |
| Versiones (marca + modelo + versión + años + motor) | ~14.880 | DNRPA | `VERIFIED` |
| Motores (cilindrada y combustible leídos de la descripción oficial) | ~570 | DNRPA | `VERIFIED` |
| Generaciones | 0 | — | Estructura e importador listos; no hay una fuente abierta confiable |
| Motos: marcas · modelos · generaciones · fotos | 63 con modelos (75 en total) · 2.425 · 11 · 1.459 | Lista de AUTONEX + Wikidata (CC0) + Wikimedia Commons | `UNVERIFIED` (ver sección 10) |
| Categorías de repuestos | 132 de autos en árbol (9 principales) + 204 de motos (raíz "Motos", 15 grupos) | AUTONEX | — |
| Marcas de repuestos para motos y qué fabrica cada una | 79 marcas · 292 líneas de producto (281 con su categoría) · 31 logos | Lista de AUTONEX + logos de Wikimedia Commons | `UNVERIFIED` |
| Repuestos | 289 de demostración | `demo` | `NEEDS_REVIEW` |
| Compatibilidades | las de los repuestos de demostración, unidas a versiones reales | `demo` | `NEEDS_REVIEW` |

Los vehículos son **reales**: salen de los datasets públicos de inscripciones iniciales y transferencias de automotores
de la DNRPA (2024 a 2026, más de 6 millones de trámites) publicados en <https://datos.jus.gob.ar> con licencia
**Creative Commons Atribución 4.0**. Solo se usan las columnas del vehículo (marca, modelo, tipo, año de modelo, origen):
**ningún dato de titulares**.

Los repuestos, vendedores, precios y stock son **de demostración** y así figuran en la base (fuente `demo`, estado
`NEEDS_REVIEW`, confianza baja). Un dato de una fuente de demostración no se puede marcar como `VERIFIED`.

### Lo que no se cargó y por qué

- **Catálogo real de repuestos y aplicaciones.** Los catálogos de fabricantes (Bosch, Wega, Fras-le, etc.) y las bases
  como TecDoc tienen derechos y licencias comerciales: no se pueden copiar ni scrapear. El camino es **importar el
  catálogo que entregue un distribuidor o fabricante con autorización** (sección 4).
- **Generaciones.** Ninguna fuente abierta las publica de forma confiable para el mercado argentino. Se pueden cargar
  a mano o importar desde una fuente con licencia.
- **Marcas sin registros en Argentina** (GWM, SWM, Tank, Volvo Buses, Neobus): no aparecen en los datos del DNRPA
  del período, así que no se crearon. Se agregan cuando haya una fuente que las respalde.
- **Patente y VIN.** No hay base de patentes (son datos protegidos). Las rutas `/api/identificar/patente/:valor` y
  `/api/identificar/vin/:valor` validan el formato y quedan listas para un proveedor autorizado (sección 7).

---

## 2. Modelo de datos

```
marcas_vehiculo ─< modelos_vehiculo ─< generaciones
       │                  │
       └─< motores        └─< vehiculos (versión: años, motor, tipo, carrocería, transmisión, tracción…)
                                   │
categorias (árbol) ─< productos ─< compatibilidades >─┘
                         │  ├─< oem_productos (número original por marca de vehículo)
marcas_repuesto ─────────┘  ├─< equivalencias (números de otras marcas)
                            ├─< productos_proveedor (código interno de cada proveedor)
                            └─< publicaciones (precio y stock de cada vendedor)
```

| Especificación | Tabla |
|---|---|
| brands | `marcas_vehiculo` |
| models | `modelos_vehiculo` |
| generations | `generaciones` |
| engines | `motores` |
| vehicle_versions | `vehiculos` |
| vehicle_types | `tipos_vehiculo` |
| parts | `productos` (SKU AUTONEX, número de pieza, EAN, tipo de pieza, especificaciones) |
| parts_categories | `categorias` |
| part_brands | `marcas_repuesto` |
| part_oem_numbers | `oem_productos` |
| part_equivalences | `equivalencias` |
| vehicle_parts | `compatibilidades` (con posición y notas) |
| suppliers | `proveedores` + `productos_proveedor` |
| data_sources | `fuentes` |
| data_imports | `importaciones` + `importacion_errores` |

El **producto** (qué pieza es), la **publicación** (precio y stock de un vendedor) y el **proveedor** (de dónde sale el
dato) son cosas separadas.

### Trazabilidad (en todas las tablas del catálogo)

| Columna | Qué guarda |
|---|---|
| `fuente_id` / `fuente_url` | De qué fuente salió y la página o catálogo que lo respalda |
| `importacion_id` / `importado_en` | En qué importación entró y cuándo |
| `estado_verificacion` | `VERIFIED` · `UNVERIFIED` · `NEEDS_REVIEW` · `DISCONTINUED` |
| `verificado_en` | Cuándo se verificó |
| `confianza` | `alta` · `media` · `baja` |
| `actualizado_en` | Último cambio |

Cada cambio de estado queda en `verificaciones` (quién, cuándo, de qué estado a cuál, con qué fuente y una nota).

### SKU y códigos

- **SKU AUTONEX**: prefijo de la categoría principal + id (`FRE-000123`). Se asigna solo si no viene informado.
- **Número de pieza**: el del fabricante del repuesto (`marca_repuesto + número` es único).
- Todos los códigos se comparan **normalizados** (`normalizar_codigo`: mayúsculas, solo letras y números), así
  `0 986 494-133` encuentra `0986494133`. La búsqueda por código (`/api/buscar/codigo?q=`) mira número de pieza, SKU,
  OEM y equivalencias.

---

## 3. Fuentes y derechos (antes de cargar nada)

Toda fuente se registra en **Panel de administración → Datos → Fuentes de datos** con su checklist:

1. ¿Revisaste los términos de uso? (`terminos_revisados`)
2. ¿Verificaste la licencia? (`licencia_verificada`)
3. ¿Tiene API? (`api_disponible`)
4. ¿Permite uso comercial? (`permite_uso_comercial`)
5. ¿Permite redistribuir los datos? (`permite_redistribucion`)

Además: tipo de fuente (oficial, fabricante, proveedor, catálogo aftermarket, datos abiertos, manual o demo), nivel de
confianza y el texto de atribución que exige la licencia (se muestra en la página de créditos).

**No se hace scraping masivo.** Si una fuente no tiene licencia o permiso de uso comercial, no se importa.

---

## 4. Cómo agregar datos

Hay tres caminos, todos con las mismas reglas (fuente obligatoria, trazabilidad, errores por fila, detección de
duplicados).

### a) Importar un archivo desde el panel (recomendado)

1. Entrá con la cuenta de administrador → menú de la cuenta → **Administrar catálogo** → **Importar**.
2. Elegí qué vas a importar, la **fuente** y el archivo (CSV, Excel `.xlsx` o JSON).
3. **Validar sin guardar**: procesa todo y muestra cuántas filas se crearían, actualizarían, cuáles tienen error y
   cuáles se parecen a datos existentes. No guarda nada.
4. **Importar**. El resultado queda en **Importaciones**, con los errores fila por fila y un CSV para corregirlos.

Opciones:

- **Estado de las filas sin estado**: por defecto `UNVERIFIED`. Marcá `VERIFIED` solo si la fuente es el catálogo
  oficial y lo revisaste. Un dato `VERIFIED` nunca se pisa con uno sin verificar.
- **Si una fila se parece a un registro existente**: no crearla y dejarla para revisar (por defecto) · crearla y
  marcarla para revisar · crearla sin avisar.

### b) Importar desde la terminal

```bash
cd server
npm run importar -- --entidad repuestos --fuente distribuidor-x --archivo catalogo.xlsx --validar
npm run importar -- --entidad repuestos --fuente distribuidor-x --archivo catalogo.xlsx
npm run importar -- --entidad compatibilidades --fuente distribuidor-x --archivo aplicaciones.csv --duplicados marcar
npm run importar -- --plantilla --entidad compatibilidades > plantilla.csv
```

### c) Cargar a mano

**Panel → Datos**: alta, edición y baja de marcas, modelos, generaciones, motores, versiones, categorías, marcas de
repuesto, repuestos, fuentes y proveedores. En la ficha de un repuesto se agregan compatibilidades (por modelo y rango
de años), números OEM y equivalencias. Lo cargado a mano nace `UNVERIFIED` con la fuente "Carga manual" (o la que
elijas). Si editás un dato `VERIFIED`, vuelve a `UNVERIFIED` y queda en el historial.

Los vendedores también pueden dar de alta repuestos desde su panel: quedan `UNVERIFIED` con la fuente
"Carga de vendedores AUTONEX" y el comprador ve que la compatibilidad no está verificada.

### Formatos de archivo

- **CSV** con separador `,` `;` o tabulación (se detecta solo), UTF-8. La primera fila tiene los nombres de columna.
- **Excel** `.xlsx`: la primera hoja (o la que indiques).
- **JSON**: una lista de objetos o `{ "filas": [...] }`.

Las columnas se aceptan en castellano o en inglés (`marca`/`brand`, `numero_pieza`/`part_number`,
`anio_desde`/`year_from`…). Las plantillas (solo cabecera, sin ejemplos inventados) se descargan desde el panel.

| Entidad | Columnas principales (* obligatorias) |
|---|---|
| `marcas` | nombre*, pais_origen, segmento, estado_mercado, sitio_web |
| `modelos` | marca*, nombre*, tipo_vehiculo, segmento, estado_mercado |
| `generaciones` | marca*, modelo*, nombre*, numero, codigo (chasis), anio_desde*, anio_hasta |
| `motores` | marca, nombre*, codigo, cilindrada_cc, cilindros, combustible, potencia_cv, torque_nm, aspiracion |
| `vehiculos` | codigo, marca*, modelo*, generacion, version*, anio_desde*, anio_hasta, tipo_vehiculo, carroceria, motor, motor_codigo, cilindrada_cc, combustible, potencia_cv, transmision, velocidades, traccion, pais_fabricacion, mercado, estado_mercado, segmento |
| `categorias` | nombre*, padre, descripcion, destacada, prefijo_sku |
| `repuestos` | marca*, numero_pieza*, nombre*, categoria* (nombre, slug o ruta "Frenos > Pastillas"), tipo_pieza, ean, codigo_aftermarket, codigo_proveedor, oem ("TOYOTA:04465-0K240; …"), universal, especificaciones (JSON) |
| `oem` | sku o (marca + numero_pieza), marca_vehiculo*, numero_oem* |
| `equivalencias` | sku o (marca + numero_pieza), marca_equivalente*, numero_equivalente*, tipo |
| `compatibilidades` | sku o (marca + numero_pieza); vehiculo (código) o marca_vehiculo + modelo + anio_desde/anio_hasta (+ motor o version que contengan un texto); posicion, notas |
| `publicaciones` | vendedor*, sku o (marca + numero_pieza), precio*, stock*, condicion |

Todas aceptan además `fuente_url`, `estado_verificacion`, `confianza` y `verificado_en` por fila.

---

## 5. Verificación

- **Panel → Datos** (cualquier entidad) o **Panel → Compatibilidades**: seleccioná registros y **Cambiar verificación**.
- `VERIFIED` exige indicar con qué fuente se confirmó (no puede ser una de demostración) o una nota con la referencia.
- `DISCONTINUED` saca el dato de la tienda sin borrarlo (las compatibilidades discontinuadas no cuentan).
- En la tienda: compatibilidad `VERIFIED` → "Le sirve a tu auto"; `UNVERIFIED`/`NEEDS_REVIEW` → "Figura como
  compatible, pero no está verificada"; sin dato → "No figura como compatible". El catálogo tiene el filtro
  "Solo verificada con una fuente".

## 6. Duplicados

Al importar o cargar a mano se buscan parecidos (similitud de trigramas + reglas: no confunde "Ranger" con "Ranger
Raptor" ni "208" con "2008"). Nada se fusiona ni se crea solo: queda en **Panel → Duplicados** para decidir:

- **Son el mismo** → se fusionan (todas las relaciones pasan al registro que conservás) o, si era una fila importada,
  se usa el existente.
- **Es otro** → se crea la fila retenida.
- **No son el mismo** → se descarta la sugerencia.

"Buscar duplicados en la base" revisa todo el catálogo cargado.

## 7. Patente y VIN

`server/src/services/identificacion.js` valida patentes (AAA123, AA123BB, A123456) y VIN (17 caracteres sin I, O, Q),
guarda cada consulta en `identificaciones_vehiculo` y deriva el fabricante del VIN si `vin_wmi` tiene datos importados.
Para conectarlo a un servicio autorizado:

```js
import { registrarProveedor } from './services/identificacion.js';
registrarProveedor('mi-proveedor', {
  patente: async (valor) => ({ codigo_vehiculo: 'DNRPA-…' /* o marca, modelo, año, versión */ }),
  vin: async (valor) => ({ codigo_vehiculo: '…' }),
});
```

y en `server/.env`: `IDENTIFICACION_PROVEEDOR=mi-proveedor`. Sin proveedor, las rutas responden 501 con un mensaje
claro. La tienda no muestra la búsqueda por patente o VIN mientras no haya un proveedor conectado: el selector
es solo por marca, modelo y año (para mostrarla de nuevo hay que volver a agregarla en `SelectorVehiculo.jsx`).

## 8. Qué marcas entran y sus logos

**Solo marcas argentinas o que se vendieron en Argentina.** El ETL conserva una marca si cumple al menos una de
estas condiciones (todo sale de los datos del registro, sin opinión):

- tiene versiones de **origen nacional**;
- tuvo **5 o más patentamientos 0 km** en el período (se vende hoy);
- tiene **20 o más vehículos registrados** (hubo venta real, aunque sea vieja).

Lo demás (importaciones sueltas, casas rodantes, maquinaria, nombres inválidos) se descarta y queda listado en
`db/datos/dnrpa/metadatos.json` (`descartes.marcas_descartadas`). Para rescatar una marca que se vendió oficialmente
pero tiene pocos registros, agregala a `marcas_conservar` en `scripts/dnrpa/reglas.json`.
Las variantes del registro se unen a su marca: "Ford F 150" pasa a ser el modelo F-150 de Ford, "IKA Torino 380" el
Torino de IKA y "Kia Motors" queda como Kia; los errores de tipeo ("Reanult", "Peugoet") están en `marcas_alias`.

**Logos** (`npm run logos:marcas -w autonex-server`), en este orden:

1. **Wikidata + Wikimedia Commons**, solo con licencias libres o de dominio público. Una consulta SPARQL trae los
   fabricantes de vehículos con logo y se toma el que coincide exactamente con el nombre de la marca (logo vigente,
   nunca una foto).
2. **Beepaway** (beepaway.com/es/logos), que los ofrece para uso educativo o no comercial: solo para marcas que no
   están en Commons, o cuando su versión es el emblema habitual (BMW, Fiat, SEAT).
3. Las variantes ("Ford F 150") usan el logo de su marca.

Cada logo se revisó a ojo con una hoja de contacto; las asignaciones incorrectas de Wikidata (la empresa dueña en
lugar de la marca) están excluidas en el script. Las marcas sin logo con licencia siguen mostrando sus iniciales: no se
dibuja ni se inventa ningún logo. Fuente, autor y licencia de cada uno: `client/public/img/marcas/logos/logos.json`,
la página **Créditos** y `CREDITOS-IMAGENES.md`. Los logos son marcas registradas de sus dueños y se usan solo para
identificar cada marca en un proyecto educativo.

`npm run imagenes:carpeta -w autonex-server` deja una copia ordenada en `imagenes/` (logos de autos, img de los autos,
repuestos). La app las sirve desde `client/public/img`.

## 9. Actualizar los vehículos del DNRPA

```bash
cd server
npm run dnrpa                     # descarga los datasets (varios GB), agrega y genera db/datos/dnrpa/vehiculos.csv
npm run dnrpa -- --desde-cache    # vuelve a generar el CSV desde la agregación guardada (segundos)
npm run importar -- --entidad vehiculos --fuente dnrpa --archivo db/datos/dnrpa/vehiculos.csv --duplicados marcar
```

En el servidor, `bash deploy/recargar-catalogo.sh` hace todo de una vez sin cortar el servicio mientras carga:
regenera el CSV, lo carga con el seed en una base nueva, la pone en producción (la anterior queda como
`autonex_prev`), recompila el frontend y reinicia AUTONEX.

El ETL (`scripts/dnrpa/etl-dnrpa.js`) separa marca, modelo y versión de la descripción oficial con las reglas de
`scripts/dnrpa/reglas.json` (alias de marcas mal escritas, modelos de varias palabras, prefijos, tipos de vehículo),
lee cilindrada, combustible, turbo, transmisión y tracción **solo cuando figuran en la descripción**, descarta años
aislados (los que suman menos del 1 % de una versión y, por modelo, los años separados del resto por más de 3 años
sin trámites, típicos errores de carga), une la misma versión registrada con dos códigos y marca como
"a la venta" las versiones con patentamientos 0 km en los últimos 12 meses. Para corregir un nombre se edita
`reglas.json` y se regenera con `--desde-cache`.

---

## 10. Motos

Las motos están **dentro del mismo catálogo**: usan las mismas tablas que los autos (`marcas_vehiculo`,
`modelos_vehiculo`, `generaciones`, `vehiculos`, `motores`, `compatibilidades`, `equivalencias`, `oem_productos`,
`productos`), marcadas con el segmento `moto`. Así el selector "Mi vehículo", el buscador, los filtros, el carrito,
el panel de vendedores y el importador funcionan igual para autos y motos, sin código duplicado. La migración
`004_motos.sql` solo agrega lo propio de las motos y no cambia ni borra datos existentes.

### Tablas de la especificación

| Nombre pedido | Dónde está en AUTONEX (hay una vista con el nombre pedido) |
|---|---|
| `motorcycle_brands` | `marcas_vehiculo` con modelos de segmento `moto` |
| `motorcycle_models` | `modelos_vehiculo` con `segmento = 'moto'` |
| `motorcycle_generations` | `generaciones` de esos modelos |
| `motorcycle_versions` | `vehiculos` (versión: años, motor, transmisión, velocidades) |
| `motorcycle_engines` | `motores`, con `tiempos` (2T / 4T / eléctrico) y `alimentacion` (carburador / inyección / eléctrico) |
| `motorcycle_categories` | `categorias_moto` (31 categorías: MOTOCROSS, ENDURO… ATV) y `modelo_categorias_moto` (un modelo puede tener varias) |
| `motorcycle_images` | `imagenes` (entidad `modelo` o `vehiculo`) |
| `part_brands` | `marcas_repuesto`, con `para_autos` y `para_motos` |
| `part_vehicle_compatibility` | `compatibilidades`, con `anio_desde` / `anio_hasta` opcionales: una pieza puede servir solo para algunos años de una versión |
| `part_cross_references` | `equivalencias` (otras marcas) y `oem_productos` (número original) |

Presencia en Argentina (en marcas y modelos): `disponible_argentina`, `oficial_argentina`, `importado`,
`historico_argentina` e `internacional`. Son `NULL` cuando no hay dato: no se asume ni que sí ni que no.

### Qué hay cargado

Hoy: **75 marcas** de motos (63 con modelos), **2.425 modelos**, **11 generaciones** (las que Wikidata distingue por
año, como "MT-03 (2006)" y "MT-03 (2016)"), **1.459 fotos reales**, 204 categorías de repuestos de motos y 79 marcas
de repuestos para motos, 61 de ellas con sus líneas de producto (292 líneas).

| Dato | Fuente | Estado |
|---|---|---|
| Marcas de motos (japonesas, europeas, chinas y asiáticas, indias, argentinas, scooters y eléctricas) | Lista de AUTONEX (`db/data/motos.js`) | `UNVERIFIED` |
| Más marcas: fabricantes con al menos 10 modelos en Wikidata y fabricantes argentinos que figuran ahí | Wikidata (CC0) | `UNVERIFIED` |
| Modelos: los de la lista y los modelos de moto y scooter de Wikidata de esas marcas | Lista de AUTONEX + Wikidata | `UNVERIFIED` |
| Categoría de cada modelo, por la familia del nombre (CRF…R = motocross, EXC = enduro, Duke = naked…) | Reglas de AUTONEX (`REGLAS_CATEGORIAS`) | `UNVERIFIED` |
| Una foto real por modelo cuando Wikidata la tiene (imagen P18), con autor, licencia, página de origen, fecha de descarga y hash SHA-256 | Wikimedia Commons | `UNVERIFIED`, permiso `libre` |
| Categorías de repuestos de motos: raíz "Motos" con 15 grupos (Motor, Admisión, Escape, Combustible, Embrague, Transmisión, Transmisión final, Frenos, Suspensión, Ruedas —con los neumáticos por tipo—, Eléctrico, Carrocería, Off-road y competición, Consumibles, Accesorios) | AUTONEX (rubro `motos`) | — |
| Marcas de repuestos para motos (Hiflofiltro, K&N, Brembo, Galfer, DID, RK, Öhlins, KYB, NGK, Michelin, Pirelli…) y sus líneas de producto ("Brembo: pastillas, discos, pinzas…"), cada una relacionada con su categoría | Lista de AUTONEX (`db/data/motos.js`) | `UNVERIFIED` |
| Logos de 31 marcas de repuestos (el de la marca, no el del grupo dueño; revisados uno por uno) | Wikimedia Commons | — |

**Lo que no se cargó, a propósito:** años de fabricación por versión, generaciones, versiones, motores, códigos de
motor, números OEM, números de parte, EAN, compatibilidades, precios y stock de repuestos de moto. No hay una fuente
abierta y verificable para esos datos (el registro automotor publica las motos solo como totales, sin modelo ni
versión), así que quedan vacíos (`UNKNOWN`) hasta que se importe el catálogo de un fabricante o distribuidor con
autorización. **No se inventan**: un modelo sin versiones muestra su ficha (foto, categorías, presencia en Argentina)
y dice que los años y versiones todavía no están verificados.

Las fotos de los repuestos tienen que ser del producto real: si un repuesto no tiene foto propia queda
`IMAGE_MISSING` y la tienda lo dice; no se usa la foto de una pieza parecida ni la de la categoría (en el rubro motos).

### Marcas de repuestos y lo que fabrica cada una

Una **línea de producto** dice qué fabrica una marca ("Brembo: pastillas de freno, discos, pinzas…") y apunta a la
categoría del catálogo (tabla `marca_repuesto_lineas`, vista `part_brand_lines`). **No es un producto**: no tiene número
de parte, precio, stock ni compatibilidades. Sirve para que la sección Motos muestre, en cada categoría, qué marcas la
fabrican mientras los proveedores todavía no publicaron sus catálogos. Las líneas sin una categoría clara
("Filtros hidráulicos", "Rodamientos" a secas) quedan como texto. La relación línea → categoría sale de
`REGLAS_LINEAS` y `LINEAS_POR_MARCA` en `db/data/motos.js` (por ejemplo, los "Kits de reparación" de Showa son de
suspensión y los de Brembo, de frenos).

Para sumar marcas o líneas sin tocar código se importa la entidad `lineas_marca_repuesto` (marca, linea, categoria
con su ruta). Los logos se buscan con `npm run logos:marcas -w autonex-server -- --repuestos` y se revisan a ojo:
los que en Wikidata son de otra empresa con el mismo nombre (Champion, BMC) o del grupo dueño (Niterra para NGK) se
descartan y la marca se muestra con sus iniciales.

### En la tienda

- **Selector "Mi vehículo" → Motos:** marca → modelo (con foto y chips de categoría para filtrar) → año → versión.
  Si el modelo todavía no tiene versiones cargadas, se ve su ficha y el botón **Ver repuestos para esta moto**
  (`/catalogo?modelo=ID`).
- **Buscador:** detecta la moto en el texto igual que con los autos: "Honda CRF250R", "CRF250R filtro",
  "Brembo CRF250R", "DID Yamaha YZ250F", "cadena KTM 300 EXC", "crf 250 r". Con solo la marca ("pastillas Honda")
  muestra lo compatible con cualquier modelo de esa marca. Los modelos de nombre genérico ("Blitz", "Sport", "R1")
  solo se detectan si también se escribe la marca, para que "lámpara H4" no se confunda con una moto.
- **Filtros del catálogo:** rubro (autos / motos), marca del repuesto, categoría, N° de parte / OEM / SKU / EAN / UPC,
  precio, condición, provincia e "incluir sin stock".
- **Sección Motos del catálogo:** cada categoría muestra sus subcategorías (aunque todavía no tengan productos) y las
  marcas que la fabrican, con sus líneas. La página **Marcas de repuestos para motos** (`/marcas-repuestos`) lista las
  marcas con su logo y lo que fabrica cada una, con un buscador ("Brembo", "cadenas", "neumáticos enduro").

### Agregar motos y repuestos de motos

Se usa el mismo importador (sección 4), en **CSV, Excel, JSON, XML o por API**, con el flujo de siempre:
importar → validar → normalizar → detectar duplicados → relacionar → verificar → guardar. Lo dudoso queda como
posible duplicado o `NEEDS_REVIEW` para que lo revise un administrador.

| Entidad | Columnas para motos |
|---|---|
| `marcas` | nombre*, segmento=`moto`, pais_origen, disponible_argentina, oficial_argentina, importado, historico_argentina, internacional, wikidata |
| `modelos` | marca*, nombre*, segmento=`moto`, tipo_vehiculo (`moto`, `scooter`, `cuatriciclo`, `utv`), categorias ("ENDURO;COMPETITION"), anio_desde, anio_hasta, presencia en Argentina, wikidata |
| `categorias_moto` | marca*, modelo*, categorias* (códigos separados por `;`) |
| `motores` | marca, nombre*, codigo, cilindrada_cc, tiempos (`2T`/`4T`/`electrico`), alimentacion (`carburador`/`inyeccion`), potencia_cv |
| `vehiculos` | marca*, modelo*, version*, anio_desde*, anio_hasta, generacion, cilindrada_cc, motor, motor_codigo, tiempos, alimentacion, transmision, velocidades, segmento=`moto` |
| `repuestos` | marca*, numero_pieza*, nombre*, categoria* (ruta "Motos > Frenos > Pastillas"), ean, upc, oem, codigo_proveedor |
| `compatibilidades` | sku o (marca + numero_pieza); vehiculo o marca_vehiculo + modelo + anio_desde/anio_hasta (los años quedan guardados en la compatibilidad) |
| `imagenes` | entidad (`modelo`, `vehiculo`, `producto`, `marca`, `marca_repuesto`), a qué registro (marca_vehiculo + modelo, vehiculo, sku o marca + numero_pieza), tipo (principal, lateral, frontal, trasera, motor, tablero, color, packaging, detalle, aplicacion), archivo o url_imagen, url_origen, autor, licencia, permiso (`libre`, `autorizado`, `pendiente`, `no_permitido`), hash_sha256, descargado_en |
| `marcas_repuesto` | nombre*, pais, para_autos, para_motos |
| `lineas_marca_repuesto` | marca*, linea*, categoria (ruta, ej. "Motos > Frenos > Pastillas"; vacía si no hay una), orden |

Una imagen con permiso `pendiente` o `no_permitido` no se muestra. Una fuente `demo` no puede cargar imágenes.

**XML:** se toma la lista de elementos repetidos más larga como filas (`<catalogo><producto>…</producto>…</catalogo>`),
y cada hijo es una columna.

**API** (para un proveedor que manda su catálogo sin archivos), con token de administrador:

```bash
curl -X POST "$AUTONEX_URL/api/admin/importaciones/api" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"entidad":"compatibilidades","fuente":"catalogo-proveedor","solo_validar":true,
       "filas":[{"marca":"DID","numero_pieza":"520ERT2-120","marca_vehiculo":"KTM","modelo":"300 EXC","anio_desde":2020,"anio_hasta":2023}]}'
```

Con `"solo_validar": true` devuelve la vista previa sin guardar; sin esa opción importa y deja la trazabilidad
(fuente, importación, fecha) igual que un archivo.

Para volver a traer los modelos y las fotos de Wikidata / Commons: `npm run motos:wikidata -w autonex-server`
(tarda porque respeta los límites de Wikimedia) y después `node scripts/generar-creditos.js` para los créditos.

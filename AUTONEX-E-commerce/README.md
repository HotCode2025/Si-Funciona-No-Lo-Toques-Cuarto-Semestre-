<p align="center">
  <img src="client/public/logo-autonex.svg" alt="AUTONEX — tu marketplace de autopartes" width="460">
</p>

# AUTONEX

**AUTONEX** es un marketplace de repuestos para autos, camionetas y motos (proyecto universitario de demostración).
Varias casas de repuestos —ficticias— publican sus productos; el comprador elige su vehículo, ve solo lo que le
sirve, compara las ofertas de cada vendedor, arma un carrito con productos de uno o varios vendedores y paga todo
junto con **Mercado Pago (Checkout Pro)**. Interfaz en español de Argentina y precios en pesos (ARS).

- **Frontend:** React 18 + Vite + React Router (`/client`, paquete `autonex-client`)
- **Backend:** Node.js 20+ con Fastify 5 (`/server`, paquete `autonex-server`)
- **Base de datos:** PostgreSQL (driver `pg`), base `autonex`
- **Autenticación:** JWT + contraseñas con bcrypt
- **Pagos:** SDK oficial `mercadopago` para Node (Checkout Pro) con credenciales de prueba
- **Catálogo de vehículos real:** ~234 marcas, ~3.620 modelos y ~14.880 versiones del registro automotor (DNRPA,
  datos abiertos CC BY 4.0), con trazabilidad y estado de verificación de cada dato
- **Motos:** marcas y modelos de la lista de AUTONEX y de Wikidata (CC0), con categorías (motocross, enduro, naked,
  scooter…) y fotos reales de Wikimedia Commons; integradas en las mismas tablas, buscador y filtros que los autos
  ([docs/CATALOGO.md, sección 10](docs/CATALOGO.md#10-motos))

> Catálogo, fuentes de datos y **cómo agregar datos**: **[docs/CATALOGO.md](docs/CATALOGO.md)** ·
> Créditos de las fotos: **[CREDITOS-IMAGENES.md](CREDITOS-IMAGENES.md)**

---

## Contenido

1. [Qué hace](#qué-hace)
2. [Requisitos](#requisitos)
3. [Instalación y base de datos](#instalación-y-base-de-datos)
4. [Levantar el proyecto](#levantar-el-proyecto)
5. [Mercado Pago (credenciales de prueba)](#mercado-pago-credenciales-de-prueba)
6. [Mails](#mails)
7. [Cuentas de demo](#cuentas-de-demo)
8. [Datos del seed](#datos-del-seed)
9. [Envíos simulados](#envíos-simulados)
10. [API](#api)
11. [Tests](#tests)
12. [Despliegue en un servidor (systemd + nginx)](#despliegue-en-un-servidor-systemd--nginx)
13. [Split de pagos: cómo sería en producción](#split-de-pagos-cómo-sería-en-producción)
14. [Estructura del proyecto](#estructura-del-proyecto)

---

## Qué hace

| Funcionalidad | Dónde |
|---|---|
| Selector **"Mi vehículo"** (marca → modelo → año → generación → versión) con búsqueda, filtro por tipo (autos, comerciales, pesados, **motos**); guardado en el navegador, filtra todo el catálogo. En motos: fotos y categorías de cada modelo y ficha del modelo cuando todavía no tiene versiones verificadas | Header, inicio |
| Catálogo con búsqueda por nombre, **número de pieza, SKU, OEM, EAN/UPC o equivalencia**, detección del vehículo en el texto (**"pastillas hilux"**, **"cadena KTM 300 EXC"**, **"pastillas Honda"**), árbol de categorías, filtros por rubro (autos / motos), marca, tipo de pieza, condición, provincia, precio, stock y "solo compatibilidad verificada" | `/catalogo` |
| Ficha de producto: ficha técnica (marca, número de pieza, SKU, EAN, tipo), números OEM, equivalencias, **fuente y estado de verificación**, vehículos compatibles, aviso de compatibilidad que distingue **verificada / sin verificar / sin datos** y **comparación de ofertas** | `/producto/:id` |
| Página de cada vendedor con su logo, sus datos (dirección, WhatsApp, horario de cada día y si está **abierto ahora**) y sus productos | `/vendedores/:slug` |
| Carrito persistente en `localStorage`, agrupado por vendedor, con subtotales y tope de stock | `/carrito` |
| Registro e inicio de sesión (comprador o vendedor con su local) | `/registro`, `/ingresar` |
| Checkout en pasos, **con o sin cuenta**: datos → entrega por vendedor (retiro o envío) → dirección y transportista → resumen → **Pagar con Mercado Pago** | `/checkout` |
| Pantallas de pago aprobado, pendiente y rechazado (con reintento) | `/pago/exito`, `/pago/pendiente`, `/pago/fallo` |
| Mis compras: estado de cada pedido, línea de tiempo, tipo de envío y transportista | `/mis-compras` |
| Seguí tu compra (compras sin cuenta): se busca con el número de compra y el email; desde ahí se paga, se reintenta el pago o se abre el comprobante. Por privacidad no queda guardada en el navegador: el código de la compra vive solo en la pestaña (`sessionStorage`) hasta cerrarla | `/seguir-compra` |
| Términos y condiciones generales, Términos para vendedores y Política de privacidad (Ley 24.240, Código Civil y Comercial y Ley 25.326); se aceptan al crear la cuenta (los vendedores aceptan también los suyos) y antes de pagar. Los datos del titular salen de `OPERADOR_*` en `server/.env` | `/terminos` · `/terminos-vendedores` · `/privacidad` |
| Mi cuenta: editar los datos personales, **foto de perfil** opcional (privada) y **eliminar la cuenta** (comprador o vendedor; derecho de supresión de la Ley 25.326) | `/mi-cuenta` |
| Mails desde la cuenta de Gmail del proyecto (SMTP; Resend como alternativa con dominio propio): confirmación del email al crear la cuenta, comprobante de cada compra pagada, recuperación de contraseña (links de un solo uso), reintegros y baja de la cuenta | `/verificar-email` · `/recuperar-clave` · `/restablecer-clave` |
| Botón de arrepentimiento (Resolución 424/2020): el comprador pide revocar una compra pagada con número + email y recibe el código de identificación en el momento. El pedido queda **frenado** (el vendedor no lo puede avanzar), el vendedor lo cancela —si el comprador ya lo tiene, cuando se lo devuelve— y se **reintegra el total con Mercado Pago** | `/arrepentimiento` |
| Comprobante de compra para descargar en PDF o compartir (WhatsApp, copiar o compartir del celular): número de compra, pago de Mercado Pago, cada pedido con su entrega y el **número de seguimiento** del envío | `/comprobante/:id` |
| Panel del vendedor: pedidos (pagado → en preparación → enviado / listo para retirar → entregado) y arrepentimientos para resolver; publicaciones **solo del propio local** (precio, stock, pausa, hasta 6 fotos y descripción propias); carga de productos (si la pieza ya existe se suma a su ficha para comparar precios; lo nuevo queda sin verificar); datos del local con **logo** y **horario por día** (corrido o cortado) | `/panel` |
| **Panel de administración del catálogo**: resumen por estado y fuente, alta/edición/baja de marcas, modelos, generaciones, motores, versiones, categorías, repuestos, fuentes y proveedores; compatibilidades, OEM y equivalencias; verificación masiva con historial; **importación de CSV/Excel/JSON/XML y por API** con vista previa y errores por fila; posibles duplicados | `/admin` |

Reglas importantes del backend:

- El backend **recalcula precios, stock y costos de envío**: del frontend solo toma `publicacion_id` y `cantidad`.
- La compra se crea en una **transacción** (compra + un pedido por vendedor + ítems + envíos).
- El **stock se descuenta y los pedidos pasan a "pagado" recién cuando Mercado Pago aprueba el pago**, también en una
  transacción, de forma idempotente (la vuelta del comprador y el webhook pueden llegar los dos).
- Validación con los esquemas JSON de Fastify y **mensajes de error en español** (`server/src/errores.js`).
- **No se inventan datos**: cada marca, modelo, versión, repuesto y compatibilidad guarda su fuente, la importación y
  su estado (`VERIFIED`, `UNVERIFIED`, `NEEDS_REVIEW`, `DISCONTINUED`). Lo que no está verificado nunca se muestra
  como confirmado. Ver [docs/CATALOGO.md](docs/CATALOGO.md).

---

## Requisitos

- **Node.js 20.12 o superior** (probado con Node 20.19) y npm 9+
- **PostgreSQL 14 o superior** (probado con 17). Si no lo tenés instalado podés usar Docker (`docker-compose.yml`).
- Una cuenta de **Mercado Pago** para crear credenciales de prueba (solo para pagar; todo lo demás funciona sin ellas).

---

## Instalación y base de datos

```bash
# 1. Dependencias de todo el proyecto (workspaces: client + server)
npm install

# 2. PostgreSQL. Opción A: tu Postgres local
createdb autonex
#    Opción B: Docker (crea la base autonex con usuario/clave autonex)
docker compose up -d

# 3. Variables del servidor
cp server/.env.example server/.env
#    Editá DATABASE_URL, JWT_SECRET y SEED_PASSWORD (la contraseña de las cuentas de demo). Ejemplos:
#      DATABASE_URL=postgresql://autonex:autonex@localhost:5432/autonex      (Docker)
#      DATABASE_URL=postgresql:///autonex?host=/var/run/postgresql           (socket local de Linux)

# 4. Crear las tablas y cargar los datos (un solo comando, reproducible; tarda unos 12 minutos)
npm run db:seed
#    Versión rápida con solo los modelos de la demo (la usan los tests):
npm run db:seed -- --muestra
```

El seed (`server/db/seed.js`) **borra y vuelve a crear** todas las tablas aplicando las migraciones de
`server/db/migraciones/` (`npm run db:migrar` aplica solo las nuevas, sin borrar datos) y carga todo **a través del
mismo importador que usa el panel**: las versiones reales del DNRPA (`server/db/datos/dnrpa/vehiculos.csv`), las
categorías y los repuestos de demostración. Usa un generador pseudoaleatorio con semilla fija: cada corrida produce
exactamente los mismos precios y stock.

---

## Levantar el proyecto

**Desarrollo** (API con recarga automática + Vite), desde la raíz:

```bash
npm run dev
```

- Tienda: <http://localhost:5173>
- API: <http://localhost:3200/api> (Vite reenvía `/api` al backend, ver `client/.env.example`)

**Producción en un solo proceso** (Fastify sirve la API y el frontend compilado):

```bash
npm run build          # compila client/dist
# en server/.env: SERVE_FRONTEND=true  y  PUBLIC_URL=http://localhost:3200
npm start              # http://localhost:3200
```

Para publicarlo en una subruta (por ejemplo `https://midominio.com.ar/autonex/`) poné `BASE_PATH=/autonex` en
`server/.env` y compilá con `VITE_BASE_PATH=/autonex/`; `deploy/desplegar.sh` lo hace solo
(ver [Despliegue](#despliegue-en-un-servidor-systemd--nginx)).

---

## Mercado Pago (credenciales de prueba)

### 1. Crear la aplicación y las credenciales

1. Entrá a <https://www.mercadopago.com.ar/developers/panel/app> con tu cuenta y creá una aplicación
   (producto **Checkout Pro**, sin plataforma de e-commerce).
2. En **Cuentas de prueba** creá dos usuarios de prueba: uno **Vendedor** y uno **Comprador** (país Argentina).
3. Copiá el **Access Token de prueba** de la aplicación. Según tu panel puede verse como `TEST-...` (credenciales de
   prueba) o como `APP_USR-...` si usás las credenciales de producción **del usuario de prueba vendedor**
   (iniciá sesión con ese usuario de prueba y creá la aplicación desde su cuenta). Cualquiera de las dos sirve.
4. Pegalo en `server/.env` (**solo ahí**; el access token nunca va al frontend):

   ```ini
   MP_ACCESS_TOKEN=TEST-xxxxxxxxxxxxxxxx-xxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-xxxxxxxxx
   ```

5. Reiniciá el backend. `GET /api/salud` debe responder `"mercado_pago_configurado": true`.

Con un token `TEST-` el backend redirige al checkout de sandbox (`sandbox_init_point`); con uno `APP_USR-` al normal.

### 2. Pagar con tarjetas de prueba

En el checkout de Mercado Pago **iniciá sesión con el usuario de prueba Comprador** (en una ventana de incógnito, así
no se mezcla con tu cuenta real) y usá estas tarjetas de prueba de Argentina:

| Tarjeta | Número | CVV | Vencimiento |
|---|---|---|---|
| Mastercard (crédito) | `5031 7557 3453 0604` | 123 | 11/30 |
| Visa (crédito) | `4509 9535 6623 3704` | 123 | 11/30 |
| American Express | `3711 803032 57522` | 1234 | 11/30 |
| Visa Débito | `4002 7686 9439 5619` | 123 | 11/30 |

El **nombre del titular** define el resultado del pago (documento: DNI `12345678`):

| Titular | Resultado |
|---|---|
| `APRO` | Pago aprobado → compra **pagada**, pedidos **pagados**, stock descontado |
| `CONT` | Pago pendiente → pantalla de pago pendiente |
| `OTHE` | Rechazado por error general → pantalla de rechazo con "Intentar pagar de nuevo" |
| `FUND` | Rechazado por monto insuficiente |
| `SECU` | Rechazado por código de seguridad inválido |

> Si Mercado Pago muestra "Una de las partes con la que intentás hacer el pago es de prueba", estás pagando con tu
> cuenta real: cerrá sesión y entrá con el usuario de prueba Comprador.

### 3. Cómo funciona la integración

1. **Pagar con Mercado Pago** → `POST /api/compras` crea la compra en una transacción (precios, stock y envíos
   recalculados) y la **preferencia** de Checkout Pro (`server/src/services/compras.js → armarPreferencia`):
   - `items`: cada producto y un ítem por cada envío a domicilio
   - `external_reference`: id de la compra
   - `statement_descriptor`: `"AUTONEX"`
   - `back_urls` (`/pago/exito`, `/pago/pendiente`, `/pago/fallo`) y `auto_return: "approved"`
   - `notification_url`: `<PUBLIC_URL o WEBHOOK_BASE_URL>/api/pagos/webhook` (solo si la URL es pública con https)
2. El comprador paga en Mercado Pago y vuelve a la tienda. La página de resultado llama a
   `POST /api/pagos/confirmar` con el `payment_id`; **el backend consulta el pago a Mercado Pago** (no confía en los
   parámetros de la URL) y actualiza la compra (`server/src/services/pagos.js → procesarPago`).
3. **Webhook** (`POST /api/pagos/webhook`): hace lo mismo cuando Mercado Pago notifica. Si configurás
   `MP_WEBHOOK_SECRET`, valida la firma `x-signature`.
4. Si el comprador no volvió y no hay webhook, en **Mis compras** está el botón **"Ya pagué: verificar"**, que busca los
   pagos por `external_reference`.

> **Sobre `localhost`:** Mercado Pago rechaza `auto_return` cuando la `back_url` no es pública. En ese caso AUTONEX crea
> la preferencia igual sin `auto_return` y, al terminar, el comprador vuelve con el botón **"Volver al sitio"**.
> Con una URL pública (dominio propio o ngrok) la redirección es automática y funciona el webhook.

### 4. Webhook con ngrok (opcional, en desarrollo)

```bash
ngrok http 3200
```

```ini
# server/.env
WEBHOOK_BASE_URL=https://xxxx-xx-xx.ngrok-free.app      # + BASE_PATH si usás subruta (…/autonex)
MP_WEBHOOK_SECRET=la-clave-secreta-del-panel            # Tus integraciones > Webhooks (evento "Pagos")
```

En el panel de Mercado Pago configurá la misma URL terminada en `/api/pagos/webhook` para el evento **Pagos**.

---

## Mails

AUTONEX manda estos mails (`server/src/services/mail.js` y `plantillas-mail.js`):

| Mail | Cuándo |
|---|---|
| **Confirmá tu email** | Al crear una cuenta (comprador o vendedor). **La cuenta no se activa hasta tocar el link**: no puede ingresar y el local del vendedor no aparece en el sitio. El link vence en 7 días; desde Ingresar se pide otro. Con `EXIGIR_EMAIL_CONFIRMADO=false` en `server/.env` se desactiva (la cuenta queda activa y el sitio muestra un aviso). |
| **Tu compra #N** (comprobante) | Cuando Mercado Pago aprueba el pago. Una sola vez por compra, aunque lleguen la vuelta y el webhook. |
| **Restablecé tu contraseña** | Desde "¿Olvidaste tu contraseña?". El link vence en 1 hora y se usa una sola vez. |
| **Cancelamos tu pedido y te reintegramos…** | Cuando el vendedor cancela un pedido por el Botón de arrepentimiento. |
| **Eliminamos tu cuenta** | Al eliminar la cuenta. |

Hay dos formas de enviarlos. Si están las dos, se usa SMTP. Sin ninguna, los mails no se envían: quedan en el log del servidor
(y en los tests, en una bandeja en memoria). `GET /api/salud` muestra cuál está activa (`"mails": "smtp" | "resend" | "sin configurar"`).

### Opción 1: Gmail por SMTP (llega a cualquier dirección, sin dominio propio)

1. Creá una cuenta de Gmail para el proyecto (por ejemplo `autonexautopartes@gmail.com`).
2. En [myaccount.google.com/security](https://myaccount.google.com/security) activá la **verificación en 2 pasos**.
3. En [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) creá una **contraseña de aplicación**
   llamada "AUTONEX". Google muestra 16 letras (los espacios no importan).
4. Completá `server/.env` y reiniciá (`systemctl restart autonex`):

   ```ini
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=autonexautopartes@gmail.com
   SMTP_PASS=abcd efgh ijkl mnop
   MAIL_FROM=
   MAIL_REPLY_TO=
   ```

   Con `MAIL_FROM` vacío el remitente es "AUTONEX <SMTP_USER>" (Gmail no deja mandar como otra dirección).
5. Probalo: `cd server && npm run mail:probar -- tu@email.com`.

Gmail permite unos 500 destinatarios por día, de sobra para el proyecto.

### Opción 2: Resend (necesita un dominio propio verificado)

1. **API key:** en [resend.com](https://resend.com) → **API Keys** → **Create API Key** (permiso *Sending access*) y en
   `server/.env`: `RESEND_API_KEY=re_…`.
2. **Sin dominio verificado** el remitente es `AUTONEX <onboarding@resend.dev>` y Resend **solo entrega al email de la cuenta
   de Resend**; a cualquier otro destinatario responde 403 ("You can only send testing emails to your own email address").
3. **Dominio propio:** en **Domains** → **Add Domain**. Resend muestra los registros DNS (DKIM en `resend._domainkey`, y el MX y
   el SPF del subdominio `send`): hay que cargarlos en el DNS del dominio (en gnuino.com.ar, en su cuenta de Cloudflare) y tocar
   **Verify**. Con el dominio verificado: `MAIL_FROM=AUTONEX <no-responder@tudominio.com.ar>` y reiniciar.

## Cuentas de demo

El seed crea cuentas de demo para recorrer el sitio: un administrador (panel del catálogo en `/admin`), un comprador con
una compra histórica entregada y un usuario para cada casa de repuestos (su panel de vendedor). Todas nacen con el email
confirmado y con la contraseña que definas en `SEED_PASSWORD` (`server/.env`), que no se publica en el repositorio.
Los emails de cada cuenta están en `server/db/data/vendedores.js` y `server/db/data/vendedores-regionales.js`.

Los accesos del sitio publicado se entregan aparte.

---

## Datos del seed

| Dato | Cantidad | Origen |
|---|---|---|
| Marcas · modelos · versiones · motores de vehículos | ~234 · ~3.620 · ~14.880 · ~560 | **Reales**: registro automotor (DNRPA), datos abiertos 2024–2026, licencia CC BY 4.0. Estado `VERIFIED` |
| Tipos de vehículo | 18 (auto, pickup, SUV, utilitario, furgón, camión, bus, tractor, eléctrico, híbrido…) | AUTONEX |
| Categorías | 132 en árbol: Motor, Frenos, Suspensión, Dirección, Transmisión, Electricidad, Refrigeración, Carrocería, Interior | AUTONEX |
| Repuestos | 289 con marcas reales del rubro (Bosch, NGK, Wega, Fras-le…) pero **números de pieza inventados** | Demostración (`NEEDS_REVIEW`) |
| Compatibilidades | ~32.460, asignadas a versiones reales equivalentes a la referencia de la demo | Demostración (`NEEDS_REVIEW`) |
| Vendedores · publicaciones | 34 casas de repuestos en las 24 provincias (uno es desarmadero) · ~1.200 con precios y stock distintos | Demostración |
| Motos: marcas · modelos · generaciones · fotos | 63 con modelos (75 en total) · 2.425 · 11 · 1.459 (fotos reales; los modelos sin foto quedan IMAGE_MISSING) | Lista de AUTONEX + **Wikidata** (CC0) + **Wikimedia Commons** (licencias libres). `UNVERIFIED` |
| Categorías de repuestos de motos | 204: raíz "Motos" con 15 grupos (Motor, Admisión, Escape, Combustible, Embrague, Transmisión, Transmisión final, Frenos, Suspensión, Ruedas con los neumáticos por tipo, Eléctrico, Carrocería, Off-road y competición, Consumibles, Accesorios) | AUTONEX |
| Marcas de repuestos para motos | 79, 61 con sus líneas de producto (292: "Brembo: pastillas, discos, pinzas…") relacionadas con su categoría · 31 logos de Commons | Lista de AUTONEX (`UNVERIFIED`) |
| Años, versiones, motores y repuestos de motos | **0**: no hay una fuente abierta verificable; quedan `UNKNOWN` hasta importar el catálogo de un fabricante o distribuidor | — |

Los repuestos de demostración tienen compatibilidades por **familia de motor** (EA111, Fire 1.4, K7M…) y por
**plataforma** (PQ24, Fiat 178, PF1…), unidas a las versiones reales del DNRPA de la misma marca, modelo, años,
cilindrada y combustible. Como no salen de un catálogo real, la tienda las muestra como **"sin verificar"**.
Para cargar repuestos reales hace falta el catálogo de un distribuidor o fabricante con autorización: ver
[docs/CATALOGO.md](docs/CATALOGO.md#4-cómo-agregar-datos).

Las imágenes están en `client/public/img` (descargadas de Wikimedia Commons) y la base guarda la ruta local.
Los tipos de repuesto sin foto propia usan la imagen de su categoría. Detalle en [CREDITOS-IMAGENES.md](CREDITOS-IMAGENES.md).

---

## Envíos simulados

Por cada vendedor del carrito el comprador elige **retiro en el local** (gratis; se muestra dirección y horario) o
**envío a domicilio**. El costo sale de esta tabla (`server/src/services/envios.js`) según el transportista y si el
destino está en la misma provincia que el vendedor; cada unidad adicional del pedido suma un recargo.

| Transportista | Misma provincia | Otra provincia | Unidad extra | Demora |
|---|---|---|---|---|
| Andreani | $ 6.900 | $ 11.500 | $ 900 | 2–3 / 4–6 días hábiles |
| OCA | $ 6.200 | $ 10.400 | $ 800 | 3–4 / 5–7 días hábiles |
| Correo Argentino | $ 5.400 | $ 8.900 | $ 700 | 3–5 / 6–9 días hábiles |
| Moto mensajería | $ 3.800 | — | $ 500 | En el día · **solo si el comprador está en la misma ciudad que el vendedor** |

---

## API

Todas las rutas cuelgan de `/api` (o `<BASE_PATH>/api`). Errores: `{ "error": "codigo", "mensaje": "texto en español", "detalles": [...] }`.

| Método y ruta | Descripción |
|---|---|
| `GET /salud` | Estado del servicio y si Mercado Pago está configurado |
| `GET /referencias` | Listas para la interfaz: provincias, transportistas, estados de verificación, combustibles, tipos de vehículo y de pieza, totales y atribuciones de las fuentes |
| `GET /vehiculos/marcas?segmento=&q=` · `/vehiculos/marcas/:id/modelos` · `/vehiculos/modelos/:id/anios` · `/vehiculos/modelos/:id/generaciones?anio=` · `/vehiculos/modelos/:id/versiones?anio=&generacion=` · `/vehiculos/:id` | Selector "Mi vehículo" y ficha del vehículo |
| `GET /vehiculos/buscar?q=hilux 2018` | Búsqueda de vehículos por texto |
| `GET /identificar/patente/:valor` · `GET /identificar/vin/:valor` | Preparado para un proveedor autorizado (hoy responde 501; la tienda no muestra esta búsqueda) |
| `GET /categorias?vehiculo=&destacadas=` | Árbol de categorías con cantidad de repuestos por rama |
| `GET /productos?q=&categoria=&marca=&tipo_pieza=&condicion=&provincia=&precio_min=&precio_max=&vehiculo=&modelo=&anio=&solo_verificados=&orden=&pagina=` | Catálogo con facetas y detección del vehículo en el texto |
| `GET /productos/:id?vehiculo=` | Ficha: compatibilidad (verificada o no), vehículos compatibles, OEM, equivalencias, ofertas y relacionados |
| `GET /buscar/codigo?q=` | Búsqueda por número de pieza, SKU, OEM o equivalencia |
| `GET /vendedores` · `GET /vendedores/:slug` | Vendedores |
| `POST /auth/registro` · `POST /auth/login` · `GET/PUT /auth/yo` | Cuentas (JWT en `Authorization: Bearer`) |
| `POST /carrito/validar` | Precio, stock y estado reales de los ítems del carrito |
| `GET /envios/tarifas` · `POST /envios/cotizar` | Tarifas y cotización por vendedor |
| `POST /compras` · `GET /compras` · `GET /compras/:id` | Crear compra (+ preferencia de pago) y Mis compras. Sin sesión la compra queda **sin cuenta** y la respuesta trae `codigo_acceso`: se manda en el header `X-Codigo-Compra` para verla, pagarla o confirmar el pago |
| `POST /compras/buscar` | Compra sin cuenta por número + email (devuelve su `codigo_acceso`) |
| `POST /auth/verificar-email` · `POST /auth/reenviar-verificacion` | Confirmar el email con el token del link (7 días, un solo uso) · pedir otro link (con sesión) |
| `PUT /auth/yo` · `POST /auth/eliminar-cuenta` | Editar mis datos · eliminar la cuenta (comprador o vendedor) con la contraseña y `confirmacion: "ELIMINAR"`: borra los datos personales, cancela las compras sin pagar, pausa las publicaciones del local y la sesión deja de valer. No se puede con pedidos en curso |
| `POST /auth/recuperar` · `POST /auth/restablecer` | Mandar el link para restablecer la contraseña (responde igual exista o no la cuenta) · guardar la nueva con el token (1 hora, un solo uso) e iniciar sesión |
| `POST /arrepentimientos` | Botón de arrepentimiento: `{ compra_id, email, motivo? }` → código `ARR-…` (si ya hay uno abierto, devuelve el mismo) |
| `POST /compras/:id/pagar` · `POST /compras/:id/verificar-pago` | Reintentar el pago · buscar pagos en Mercado Pago |
| `POST /pagos/confirmar` · `POST /pagos/webhook` | Confirmación del pago (vuelta del comprador y webhook) |
| `GET /vendedor/resumen` · `GET /vendedor/pedidos?estado=` · `PATCH /vendedor/pedidos/:id/estado` | Panel: pedidos. Al pasar a `enviado` se puede mandar `numero_seguimiento` (el del transportista) |
| `PUT /vendedor/pedidos/:id/seguimiento` | Cargar o corregir el número de seguimiento de un envío ya despachado |
| `POST /vendedor/pedidos/:id/arrepentimiento` · `POST /vendedor/pedidos/:id/reintegro` | Botón de arrepentimiento: con una solicitud abierta el pedido no se puede avanzar (409). El vendedor lo cancela (`producto_devuelto: true` si el comprador ya lo tenía; `reponer_stock`) y se reintegra el total del pedido con Mercado Pago (`POST /v1/payments/:id/refunds`). Si era el último pedido, la compra queda cancelada · reintentar un reintegro fallido |
| `GET /vendedor/publicaciones` · `PATCH /vendedor/publicaciones/:id` · `PUT /vendedor/publicaciones/:id/descripcion` | Panel: las publicaciones del local (solo las propias) · editar precio, stock y estado · reemplazar la descripción (sin texto, se borra) |
| `POST /vendedor/productos` | Panel: cargar un repuesto con su publicación (`descripcion` opcional). Si la pieza ya existe (misma marca y número de pieza) la publicación se suma a esa ficha (`unida_a_existente: true`) para que el comprador compare precios; el vendedor nunca ve el catálogo de otros |
| `POST /vendedor/publicaciones/:id/fotos` (multipart, campo `fotos`) · `DELETE /vendedor/publicaciones/:id/fotos/:fotoId` | Panel: fotos propias de la publicación (hasta 6, JPG/PNG/WebP de hasta 8 MB; se guardan en WebP de 1600 px como máximo) |
| `GET /archivos/:id` | Imagen guardada en la base (fotos de publicaciones, logos, fotos de perfil), con caché de un año. Las fotos de perfil son privadas: solo con `?k=<clave>` |
| `PUT/DELETE /vendedor/logo` (multipart, campo `logo`) | Logo del local: cuadrado de 512 px en WebP, sin recortar. Al quitarlo vuelve el logo de base o las iniciales |
| `PUT/DELETE /auth/yo/avatar` (multipart, campo `avatar`) | Foto de perfil opcional: cuadrado de 400 px recortado al centro; se borra al quitarla o al eliminar la cuenta |
| `GET/PUT /vendedor/perfil` | Panel: datos del local. `horarios`: 7 días (lunes a domingo) `{ abierto, turnos: [{ desde, hasta }] }` con hasta 2 turnos; el servidor valida y arma el texto `horario` |
| `GET /admin/resumen` · `GET /admin/esquema` | Admin: resumen del catálogo y esquema de formularios |
| `GET/POST /admin/datos/:entidad` · `GET/PATCH/DELETE /admin/datos/:entidad/:id` · `GET /admin/opciones/:entidad` | Admin: CRUD de marcas, modelos, generaciones, motores, versiones, categorías, marcas de repuesto, repuestos, fuentes y proveedores |
| `POST /admin/verificacion` | Admin: cambio de estado de verificación (con historial) |
| `GET /admin/compatibilidades` · `POST /admin/productos/:id/compatibilidades` · `…/oem` · `…/equivalencias` · `…/proveedores` | Admin: relaciones de cada repuesto |
| `POST /admin/importaciones` (multipart) · `GET /admin/importaciones[/:id]` · `GET /admin/importaciones/:id/errores.csv` · `GET /admin/plantillas/:entidad` | Admin: importación de archivos |
| `GET /admin/duplicados` · `POST /admin/duplicados/escanear` · `POST /admin/duplicados/:id/resolver` | Admin: posibles duplicados |

---

## Tests

```bash
npm test
```

Tests de punta a punta sobre la API (`server/test/api.test.js`, con `node:test`). Crean y usan una base aparte,
**`autonex_test`** (nunca tocan `autonex`), corren el seed en modo `--muestra` y reemplazan Mercado Pago por un
cliente simulado. Cubren el selector con datos del DNRPA, búsqueda de vehículos, "pastillas hilux", búsqueda por número,
SKU y OEM, que una compatibilidad sin verificar nunca se muestre como confirmada, patente/VIN, validaciones en español,
recálculo de precios y envíos, la preferencia de Checkout Pro, pago rechazado/aprobado, descuento de stock una sola vez
(vuelta + webhook), firma del webhook, el panel del vendedor y el panel de administración: permisos, fuentes,
importación con vista previa y errores por fila, compatibilidades por modelo y años, verificación (VERIFIED exige una
fuente real), duplicados retenidos y resueltos, bajas protegidas y plantillas; y las motos: segmento y categorías en el
selector, ficha sin datos inventados (`IMAGE_MISSING`), importación por API y en XML, compatibilidades limitadas a
algunos años, las búsquedas "cadena KTM 300 EXC", "DID Yamaha YZ250F", "Brembo CRF250R", "pastillas Honda", filtros
por rubro, código y stock, y que haya casas de repuestos en todas las provincias. También el número de seguimiento, la compra
sin cuenta, el botón de arrepentimiento, la confirmación obligatoria del email, la recuperación de contraseña y el comprobante
por mail (una sola vez aunque lleguen la vuelta y el webhook) y la eliminación de cuentas. Son 65 tests.

---

## Despliegue en un servidor (systemd + nginx)

`deploy/desplegar.sh` instala, (opcionalmente) carga el seed, compila el frontend con la subruta de `BASE_PATH` y
(re)inicia el servicio de **systemd** (`deploy/autonex.service`).

```bash
bash deploy/desplegar.sh --seed     # primera vez (recrea la base: ~12 minutos)
bash deploy/desplegar.sh            # actualizaciones
journalctl -u autonex -f            # logs
```

**Servicio de systemd** (arranca solo al reiniciar el servidor y se reinicia si se cae). Lo instala root una sola vez:

```bash
cp /home/lautarom/autonex/deploy/autonex.service /etc/systemd/system/autonex.service
cp /home/lautarom/autonex/deploy/50-autonex.rules /etc/polkit-1/rules.d/50-autonex.rules
systemctl daemon-reload
systemctl enable --now autonex
```

La regla de polkit deja que el usuario `lautarom` haga `systemctl start|stop|restart autonex` sin ser root (lo usan los
scripts de despliegue).

`server/.env` de ejemplo para publicar en `https://midominio.com.ar/autonex/`:

```ini
NODE_ENV=production
PORT=3200
BASE_PATH=/autonex
SERVE_FRONTEND=true
PUBLIC_URL=https://midominio.com.ar/autonex
```

y en nginx el bloque de `deploy/nginx-autonex.conf` (`proxy_pass http://127.0.0.1:3200;` **sin barra final**).

---

## Split de pagos: cómo sería en producción

En el demo **cobra una sola cuenta, la de AUTONEX**, y después le liquidaría a cada vendedor. En producción cada casa de
repuestos cobraría directamente su parte y AUTONEX se quedaría con una comisión, usando el modelo **marketplace** de
Mercado Pago:

1. **Vinculación por OAuth.** En el panel del vendedor habría un botón "Conectar Mercado Pago" que lo lleva a
   `https://auth.mercadopago.com/authorization?client_id=<APP_ID>&response_type=code&platform_id=mp&state=<id_vendedor>&redirect_uri=https://autonex.com.ar/api/mp/oauth`.
   El vendedor autoriza a la aplicación de AUTONEX y Mercado Pago vuelve a `redirect_uri` con un `code`.
2. **Tokens del vendedor.** El backend canjea ese `code` en `POST https://api.mercadopago.com/oauth/token`
   (`grant_type=authorization_code`, `client_secret` de AUTONEX) y guarda por vendedor `mp_user_id`, `access_token`
   (cifrado), `refresh_token` y vencimiento. Los tokens se renuevan con `grant_type=refresh_token` antes de vencer.
3. **Un cobro por vendedor.** Como cada pago de Checkout Pro tiene un solo receptor, la compra se cobra con **una
   preferencia por pedido** (uno por vendedor), creada con el `access_token` **del vendedor**, e incluye
   `marketplace_fee` con la comisión de AUTONEX (por ejemplo 8 % del subtotal del pedido):

   ```js
   new Preference(new MercadoPagoConfig({ accessToken: vendedor.mp_access_token })).create({ body: {
     items: [...productosDelPedido, envioDelPedido],
     marketplace_fee: Math.round(pedido.subtotal * 0.08),
     external_reference: `pedido-${pedido.id}`,
     notification_url: 'https://autonex.com.ar/api/pagos/webhook',
     back_urls, auto_return: 'approved',
   }});
   ```

   Mercado Pago acredita el dinero al vendedor y la comisión (`marketplace_fee`) a la cuenta de AUTONEX.
   El checkout mostraría los pagos de cada vendedor en secuencia (o un pago por pedido desde "Mis compras").
4. **Estados.** Cada pedido se confirma con su propio pago (`external_reference = pedido-<id>`), así un vendedor no
   depende del pago del otro; la compra queda "pagada" cuando todos sus pedidos lo están. Las devoluciones se hacen con
   el token del vendedor y Mercado Pago devuelve también la comisión proporcional.

---

## Estructura del proyecto

```
AUTONEX/
├─ package.json              # workspaces + "npm run dev" (server y client a la vez)
├─ docker-compose.yml        # PostgreSQL opcional
├─ README.md · CREDITOS-IMAGENES.md
├─ docs/                     # CATALOGO.md, Brief, Manual de uso y Ficha técnica (HTML + PDF)
├─ deploy/                   # servicio de systemd, nginx y scripts de despliegue
├─ server/                   # autonex-server (Fastify)
│  ├─ .env.example
│  ├─ db/migraciones/        # esquema SQL versionado (001 inicial … 007 seguimiento, 008 arrepentimientos, 009 mails y recuperación, 010 eliminar la cuenta, 011 fotos de las publicaciones, 012 horarios por día y reintegros, 013 logos y fotos de perfil)
│  ├─ db/seed.js · db/data/  # seed y datos de la demo (categorías, repuestos, vendedores, referencias de compatibilidad)
│  ├─ db/datos/dnrpa/        # versiones reales del DNRPA (CSV generado por el ETL) + metadatos
│  ├─ scripts/               # importar.js (CLI), dnrpa/ (ETL y reglas), imágenes, créditos y logos
│  ├─ src/
│  │  ├─ app.js · index.js · config.js · db.js · errores.js · esquemas.js
│  │  ├─ plugins/auth.js     # JWT (comprador, vendedor, admin)
│  │  ├─ catalogo/           # normalización, duplicados y datos derivados
│  │  ├─ importacion/        # lectores CSV/Excel/JSON, tipos de campo, entidades e importador
│  │  ├─ admin/              # panel de administración (entidades, CRUD, verificación, relaciones, revisión)
│  │  ├─ routes/             # vehiculos, catalogo, referencias, identificacion, vendedores, auth, carrito, envios, compras, pagos, panel-vendedor, admin, arrepentimientos
│  │  └─ services/           # catálogo, identificación, carrito, envíos, compras, pagos, mercadopago, cuentas, mail y plantillas de mails
│  └─ test/                  # tests de la API
└─ client/                   # autonex-client (React + Vite)
   ├─ .env.example · index.html · vite.config.js
   ├─ public/                # logo, favicon e imágenes (img/categorias, img/marcas, img/productos, img/vendedores)
   └─ src/
      ├─ context/            # sesión, vehículo, carrito, avisos
      ├─ components/         # header, footer, selector de vehículo, tarjetas, modal…
      ├─ pages/              # inicio, catálogo, producto, vendedores, carrito, checkout, pago, mis compras, panel, admin
      └─ estilos/            # identidad visual de AUTONEX
```

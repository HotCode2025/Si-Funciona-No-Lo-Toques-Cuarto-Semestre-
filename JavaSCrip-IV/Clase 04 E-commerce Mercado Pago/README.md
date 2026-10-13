# E-commerce - Clase 04 (Contador del carrito + Mercado Pago)

Cierre del e-commerce desarrollado por el equipo **Los Sin Chamba**. En esta clase le agregamos el contador de productos al botón del carrito y conectamos la tienda con **Mercado Pago**, sumando por primera vez un **backend propio** hecho con Node + Express.

> ⚠️ **Importante:** ya no usamos `npm` para instalar los paquetes. En su lugar trabajamos con **pnpm**, que es más rápido y maneja mejor las dependencias.

---

## Qué hicimos en esta clase

### 4.1 Contador de productos en el botón del carrito

* Agregamos un `<span id="cart-counter">` dentro del botón 🛒 en `index.html`, posicionado con CSS como un globito rojo (`.cart-counter`).
* Creamos la función `updateCartCounter()` en `js/index.js`, que usa `reduce()` para sumar **las cantidades** de cada producto (no la cantidad de items del array):
  ```javascript
  const totalUnits = cart.reduce((acc, product) => acc + product.quanty, 0);
  ```
* La llamamos cada vez que el carrito cambia: al comprar, al sumar (`+`), al restar (`-`) y al eliminar (`❌`).
* Si el total es `0`, escondemos el globito con `display: none`.

### 4.2 Método de pago con Mercado Pago

El flujo completo es siempre el mismo:

1. El navegador le manda el carrito al backend.
2. El backend crea la **preferencia de pago** usando el `ACCESS_TOKEN` (secreto).
3. El backend devuelve el `id` de esa preferencia.
4. Con ese `id` y la `PUBLIC_KEY` dibujamos el **botón oficial de Mercado Pago**.

> 🔐 El **access token nunca viaja al navegador**: solo vive en el servidor. Por eso necesitamos un backend.

#### Parte 1 - Inicializar el proyecto
```bash
pnpm init
```
Crea el `package.json`, el archivo donde quedan anotadas las dependencias y los scripts del proyecto.

#### Parte 2 - Crear el archivo `server.js`
Es nuestro servidor. Hace tres cosas:
* Sirve el frontend estático de la carpeta `public/`.
* Expone el endpoint `POST /create_preference`, que le pide la preferencia a Mercado Pago.
* Expone `GET /api/payment/:id`, para confirmar el estado real de un pago (Parte 7).

> 🔐 **Los precios los pone el servidor.** Del navegador solo llegan el `id` y la `quantity` de cada producto; el nombre y el precio salen de `public/js/products.js`, que el servidor también importa. Así nadie puede pagar $1 cambiando el precio desde la consola del navegador.

#### Parte 3 - Instalar las dependencias
```bash
pnpm i express cors mercadopago
```
* **express** → arma el servidor y las rutas.
* **cors** → permite que el navegador le hable al backend.
* **mercadopago** → SDK oficial (v2) para crear las preferencias.

#### Parte 4 - Integrar Mercado Pago desde el frontend
En `js/checkout.js`, la función `createPreference()` hace un `fetch` al backend con los productos del carrito (solo id y cantidad):
```javascript
fetchJson("/create_preference", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    items: cart.map((product) => ({ id: product.id, quantity: product.quanty })),
  }),
});
```

El carrito se guarda en `localStorage`, así no se pierde al ir y volver de Mercado Pago. Se vacía recién cuando el pago queda aprobado.

#### Parte 5 - Botón de Mercado Pago
Con el `preferenceId` que devuelve el backend renderizamos el **Wallet Brick**, el botón oficial:
```javascript
const mp = new MercadoPago(publicKey, { locale: "es-AR" });
await mp.bricks().create("wallet", "wallet_container", {
  initialization: { preferenceId: preference.id },
});
```
Si no carga el SDK o el botón no se puede inicializar (por ejemplo, con una `public_key` que no corresponde al `access_token`), mostramos un link directo al `init_point` (Checkout Pro) como plan B.

#### Parte 6 - Ingresar el token y la public_key
1. Entrar a [Mercado Pago Developers](https://www.mercadopago.com.ar/developers/panel/app) → tu aplicación → **Credenciales de prueba**.
2. Copiar el archivo de ejemplo:
   ```bash
   cp .env.example .env
   ```
3. Pegar las credenciales dentro del `.env`:
   ```
   MP_ACCESS_TOKEN=TEST-xxxxxxxx
   MP_PUBLIC_KEY=TEST-xxxxxxxx
   ```
* El `.env` está en el `.gitignore`: **nunca se sube a GitHub**.
* La `public_key` se la pide el frontend al backend en `GET /api/public-key` (es pública, no hay problema).

#### Parte 7 - Probar los pagos
```bash
pnpm start
```
Abrir **http://localhost:3000**, agregar productos, abrir el carrito y tocar *Pagar con Mercado Pago*.
Después de pagar, Mercado Pago vuelve a `resultado.html`. Esa página **no le cree a la URL** (se puede editar a mano): le pregunta al servidor en `/api/payment/:id` y el servidor consulta el pago real en Mercado Pago.

> Con `localhost` hay que tocar *"Volver al sitio"* a mano, porque el `auto_return` automático solo funciona con una URL pública (ngrok, Vercel, etc. → variable `PUBLIC_URL`).

#### Parte 8 - Cuentas de prueba
En el panel de Mercado Pago → **Cuentas de prueba** se crean dos usuarios: uno **vendedor** (de donde salen las credenciales `TEST-`) y uno **comprador** (para pagar).

Tarjetas de prueba (Argentina):

| Tarjeta    | Número              | CVV  | Vencimiento |
|------------|---------------------|------|-------------|
| Mastercard | 5031 7557 3453 0604 | 123  | 11/30       |
| Visa       | 4509 9535 6623 3704 | 123  | 11/30       |
| Amex       | 3711 803032 57522   | 1234 | 11/30       |

El **nombre del titular** define el resultado del pago: `APRO` (aprobado), `OTHE` (rechazado), `CONT` (pendiente), `FUND` (fondos insuficientes), `SECU` (código de seguridad inválido), `EXPI` (vencida). DNI: `12345678`.

> Los valores de prueba los actualiza Mercado Pago cada tanto: si alguno falla, mirar la documentación oficial.

> Pagá con el usuario **comprador** de prueba (conviene usar una ventana de incógnito). Si estás logueado con tu cuenta real de Mercado Pago, el pago de prueba falla.

---

## Cómo levantar el proyecto

```bash
pnpm install
cp .env.example .env   # y pegar las credenciales de prueba
pnpm start
```

> Si no tenés pnpm instalado: `npm install -g pnpm` (o usá `npx pnpm install` / `npx pnpm start`).

Después entrar a **http://localhost:3000** (no abrir el `index.html` con doble click: el SDK y el `fetch` necesitan el servidor).

---

## Estructura

```
Clase 04 E-commerce Mercado Pago/
├── public/               → todo lo que ve el navegador
│   ├── index.html
│   ├── resultado.html    → adonde vuelve Mercado Pago después de pagar
│   ├── styles.css
│   ├── js/
│   │   ├── products.js   → array de productos
│   │   ├── index.js      → renderizado + carrito + contador (4.1)
│   │   ├── cart.js       → modal del carrito
│   │   └── checkout.js   → integración con Mercado Pago (4.2)
│   └── media/
├── server.js             → backend Express + SDK de Mercado Pago
├── package.json
├── .env.example          → plantilla de credenciales
└── .gitignore            → ignora node_modules y .env
```

Ojo con la carpeta `public/`: el servidor **solo** publica lo que está adentro. Así el `.env` con el token queda fuera del alcance del navegador.

---

## Conclusión

En esta cuarta clase la tienda dejó de ser solo frontend. El contador del carrito cerró la experiencia visual de compra, y la integración con Mercado Pago nos obligó a levantar un backend real: aprendimos por qué un secreto no puede vivir en el navegador, cómo se comunican frontend y backend con `fetch` y JSON, y cómo se prueba un cobro sin usar plata de verdad. Con esto **Los Sin Chamba** terminamos el e-commerce funcionando de punta a punta: catálogo, carrito, total y pago.

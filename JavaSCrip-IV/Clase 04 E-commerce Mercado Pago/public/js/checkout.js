/*
  4.2 - Método de pago con Mercado Pago (frontend)

  El flujo es siempre el mismo:
    1. El navegador le manda el carrito al backend (server.js).
    2. El backend crea la "preferencia" usando el ACCESS_TOKEN (secreto).
    3. El backend devuelve el id de esa preferencia.
    4. Con ese id y la PUBLIC_KEY dibujamos el botón oficial de Mercado Pago.

  El access token NUNCA viaja al navegador: solo vive en el servidor.
*/

// Si abrimos el index.html con doble click (file://) apuntamos al server local.
// Si entramos por http://localhost:3000 usamos el mismo origen.
const API_URL = window.location.protocol === "file:" ? "http://localhost:3000" : "";

let mpPublicKey = null;
let mp = null;
let walletBrick = null;
let walletCount = 0;

// fetch + JSON, con mensajes de error que se entiendan
const fetchJson = async (url, options) => {
  let response;

  try {
    response = await fetch(`${API_URL}${url}`, options);
  } catch {
    throw new Error("No hay conexión con el servidor. ¿Está corriendo pnpm start?");
  }

  const data = await response.json().catch(() => null);

  // Pasa si abrimos la página con Live Server u otro servidor que no es server.js
  if (!data) {
    throw new Error("El servidor no respondió bien. Abrí la tienda desde http://localhost:3000");
  }

  if (!response.ok) {
    throw new Error(data.error || `Error del servidor (${response.status})`);
  }

  return data;
};

// Le pedimos la public_key al backend para no hardcodearla en el código
const getPublicKey = async () => {
  if (mpPublicKey === null) {
    const data = await fetchJson("/api/public-key");
    mpPublicKey = data.publicKey || "";
  }

  return mpPublicKey;
};

// Parte 4 - El frontend le pide al backend que cree la preferencia.
// Solo mandamos id y cantidad: el nombre y el precio los pone el servidor.
const createPreference = () =>
  fetchJson("/create_preference", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: cart.map((product) => ({
        id: product.id,
        quantity: product.quanty,
      })),
    }),
  }); // { id, init_point }

// Desmonta el botón de Mercado Pago (al cerrar el modal o redibujar el carrito)
const resetCheckout = () => {
  if (!walletBrick) return;

  try {
    walletBrick.unmount();
  } catch (error) {
    console.warn("No se pudo desmontar el botón de Mercado Pago:", error);
  }

  walletBrick = null;
};

// Plan B: link directo al Checkout Pro
const renderCheckoutLink = (preference, container) => {
  container.innerHTML = "";

  const link = document.createElement("a");
  link.className = "checkout-btn";
  link.href = preference.init_point;
  link.innerText = "Ir a Mercado Pago";
  container.append(link);
};

// Parte 5 - Botón de Mercado Pago (Wallet Brick)
const renderMercadoPagoButton = async (preference, container) => {
  resetCheckout();
  container.innerHTML = "";

  const publicKey = await getPublicKey();

  // Si falta la public_key o no cargó el SDK, usamos el plan B
  if (!publicKey || typeof MercadoPago === "undefined") {
    renderCheckoutLink(preference, container);
    return;
  }

  mp ??= new MercadoPago(publicKey, { locale: "es-AR" });

  try {
    walletBrick = await mp.bricks().create("wallet", container.id, {
      initialization: { preferenceId: preference.id },
      callbacks: {
        onError: (error) => console.error("Error en el botón de Mercado Pago:", error),
      },
    });
  } catch (error) {
    console.error("No se pudo dibujar el botón de Mercado Pago:", error);
  }

  // Si el SDK no puede inicializar el botón devuelve null (sin tirar error),
  // así que también en ese caso usamos el plan B
  if (!walletBrick) {
    renderCheckoutLink(preference, container);
  }
};

// Bloque que se agrega al footer del modal cuando hay productos en el carrito
const createCheckoutSection = () => {
  const section = document.createElement("div");
  section.className = "checkout";

  const payButton = document.createElement("button");
  payButton.className = "checkout-btn";
  payButton.innerText = "Pagar con Mercado Pago";

  const status = document.createElement("p");
  status.className = "checkout-status";

  // Id único en cada render: así un botón viejo nunca se dibuja en el carrito nuevo
  const walletContainer = document.createElement("div");
  walletContainer.id = `wallet_container_${++walletCount}`;

  section.append(payButton, status, walletContainer);

  payButton.addEventListener("click", async () => {
    payButton.disabled = true;
    status.innerText = "Generando la orden de pago...";

    try {
      const preference = await createPreference();

      // Si el carrito cambió mientras esperábamos, esta orden ya quedó vieja
      if (!section.isConnected) return;

      await renderMercadoPagoButton(preference, walletContainer);

      payButton.style.display = "none";
      status.innerText = "Elegí cómo querés pagar 👇";
    } catch (error) {
      console.error(error);
      status.innerText = `No se pudo generar el pago: ${error.message}`;
      payButton.disabled = false;
    }
  });

  return section;
};

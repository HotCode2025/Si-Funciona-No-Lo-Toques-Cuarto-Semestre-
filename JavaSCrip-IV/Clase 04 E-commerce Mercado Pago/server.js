/*
  Parte 2 - Servidor del e-commerce (Los Sin Chamba)

  Hace tres cosas:
    1. Sirve el frontend estático de la carpeta /public.
    2. Expone /create_preference, el endpoint que le pide a Mercado Pago
       la "preferencia" de pago con los productos del carrito.
    3. Expone /api/payment/:id, para que resultado.html confirme el pago
       preguntándole directamente a Mercado Pago.

  El ACCESS_TOKEN se lee del archivo .env y nunca sale del servidor.
*/

const path = require("path");
const express = require("express");
const cors = require("cors");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");
const productos = require("./public/js/products.js");

const PORT = process.env.PORT || 3000;
const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || "";
const PUBLIC_KEY = process.env.MP_PUBLIC_KEY || "";
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/+$/, "");

const client = new MercadoPagoConfig({ accessToken: ACCESS_TOKEN });

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const MISSING_TOKEN_ERROR =
  "Falta MP_ACCESS_TOKEN. Copiá .env.example a .env y pegá tus credenciales de prueba (Parte 6).";

// Mercado Pago no acepta volver a localhost automáticamente
const isLocalUrl = (url) => url.includes("localhost") || url.includes("127.0.0.1");

// Nunca confiar en el carrito del cliente: del navegador solo usamos el id y
// la cantidad. El nombre y el precio salen del catálogo del servidor, así nadie
// puede pagar $1 cambiando el precio desde la consola.
const buildItems = (rawItems) => {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new Error("El carrito está vacío");
  }

  return rawItems.map((item) => {
    const product = productos.find((prod) => prod.id === Number(item?.id));
    const quantity = Number(item?.quantity);

    if (!product) {
      throw new Error(`El producto ${item?.id} no existe`);
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error(`Cantidad inválida para ${product.productName}`);
    }

    return {
      id: String(product.id),
      title: product.productName,
      quantity,
      unit_price: product.price,
      currency_id: "ARS",
    };
  });
};

// Parte 6 - El frontend pide la public_key acá (es pública, se puede exponer)
app.get("/api/public-key", (req, res) => {
  res.json({ publicKey: PUBLIC_KEY });
});

// Parte 4 - Creación de la preferencia de pago
app.post("/create_preference", async (req, res) => {
  if (!ACCESS_TOKEN) {
    return res.status(500).json({ error: MISSING_TOKEN_ERROR });
  }

  let items;
  try {
    items = buildItems(req.body?.items);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  const body = {
    items,
    back_urls: {
      success: `${PUBLIC_URL}/resultado.html`,
      failure: `${PUBLIC_URL}/resultado.html`,
      pending: `${PUBLIC_URL}/resultado.html`,
    },
  };

  // auto_return solo funciona con una URL pública (no con localhost)
  if (!isLocalUrl(PUBLIC_URL)) {
    body.auto_return = "approved";
  }

  try {
    const preference = await new Preference(client).create({ body });

    res.json({
      id: preference.id,
      init_point: preference.init_point,
    });
  } catch (error) {
    // El SDK devuelve el error de la API de Mercado Pago (ej: token inválido)
    console.error("❌ Error creando la preferencia:", error);
    res.status(502).json({
      error: `Mercado Pago rechazó la preferencia: ${error.message || "error desconocido"}`,
    });
  }
});

// Parte 7 - resultado.html confirma acá el estado real del pago.
// Los parámetros de la URL de vuelta se pueden inventar; la API de Mercado Pago no.
app.get("/api/payment/:id", async (req, res) => {
  if (!ACCESS_TOKEN) {
    return res.status(500).json({ error: MISSING_TOKEN_ERROR });
  }

  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({ error: "N° de pago inválido" });
  }

  try {
    const payment = await new Payment(client).get({ id: req.params.id });

    // Devolvemos solo lo necesario, no todos los datos del comprador
    res.json({
      id: payment.id,
      status: payment.status,
      status_detail: payment.status_detail,
      total: payment.transaction_amount,
    });
  } catch (error) {
    console.error("❌ Error consultando el pago:", error);
    res.status(404).json({ error: "No encontramos ese pago en Mercado Pago" });
  }
});

app.listen(PORT, () => {
  console.log(`🛒 Tienda funcionando en http://localhost:${PORT}`);

  if (!ACCESS_TOKEN || !PUBLIC_KEY) {
    console.warn("⚠️  Faltan credenciales de Mercado Pago en el archivo .env (MP_ACCESS_TOKEN / MP_PUBLIC_KEY)");
  }
});

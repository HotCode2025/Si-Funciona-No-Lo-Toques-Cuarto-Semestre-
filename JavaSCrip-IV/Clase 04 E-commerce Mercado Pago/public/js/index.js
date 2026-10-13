const shopContent = document.getElementById("shopContent");
const cartCounter = document.getElementById("cart-counter");

const CART_STORAGE_KEY = "cart";

// Muestra los precios como plata argentina: 1500 -> "$ 1.500"
const formatPrice = (value) =>
  value.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

// El carrito se guarda en localStorage para no perderlo al ir y volver de Mercado Pago
const loadCart = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || [];

    // Solo recuperamos productos que siguen existiendo, con su precio actual
    return saved
      .map((item) => {
        const product = productos.find((prod) => prod.id === item.id);
        const quanty = Number(item.quanty);

        if (!product || !Number.isInteger(quanty) || quanty < 1) return null;
        return { ...product, quanty };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
};

const cart = loadCart();

const saveCart = () => {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch {
    // Si el navegador no deja guardar (modo privado, etc.) el carrito sigue funcionando en memoria
  }
};

// 4.1 - Contador de productos en el botón del carrito
const updateCartCounter = () => {
  // Sumamos las cantidades de cada producto, no la cantidad de items del array
  const totalUnits = cart.reduce((acc, product) => acc + product.quanty, 0);

  cartCounter.innerText = totalUnits;
  // Si el carrito está vacío escondemos el globito rojo
  cartCounter.style.display = totalUnits === 0 ? "none" : "grid";
};

// Cada vez que el carrito cambia lo guardamos y actualizamos el contador
const onCartChange = () => {
  saveCart();
  updateCartCounter();
};

productos.forEach((product) => {
  const content = document.createElement("div");
  content.className = "card";
  content.innerHTML = `
    <img src="${product.img}" alt="${product.productName}">
    <h3>${product.productName}</h3>
    <p class="price">${formatPrice(product.price)}</p>
  `;
  shopContent.append(content);

  const buyButton = document.createElement("button");
  buyButton.innerText = "Comprar";

  content.append(buyButton);

  buyButton.addEventListener("click", () => {
    const productInCart = cart.find((prod) => prod.id === product.id);

    if (productInCart) {
      productInCart.quanty++;
    } else {
      cart.push({
        id: product.id,
        productName: product.productName,
        price: product.price,
        quanty: product.quanty,
        img: product.img,
      });
    }

    onCartChange();
  });
});

// Estado inicial del contador (con lo que haya quedado guardado)
updateCartCounter();

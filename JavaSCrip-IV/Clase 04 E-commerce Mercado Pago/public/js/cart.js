const modalContainer = document.getElementById("modal-container");
const modalOverlay = document.getElementById("modal-overlay");
const cartBtn = document.getElementById("cart-btn");

const closeCart = () => {
  resetCheckout();
  modalContainer.style.display = "none";
  modalOverlay.style.display = "none";
};

const displayCart = () => {
  // Si había un botón de Mercado Pago dibujado lo desmontamos antes de redibujar
  resetCheckout();

  modalContainer.style.display = "flex";
  modalOverlay.style.display = "block";

  modalContainer.innerHTML = "";

  // modal Header
  const modalHeader = document.createElement("div");
  modalHeader.className = "modal-header";

  const modalTitle = document.createElement("div");
  modalTitle.innerText = "Carrito";
  modalTitle.className = "modal-title";
  modalHeader.append(modalTitle);

  const modalClose = document.createElement("div");
  modalClose.innerText = "❌";
  modalClose.className = "modal-close";
  modalHeader.append(modalClose);

  modalClose.addEventListener("click", closeCart);

  modalContainer.append(modalHeader);

  // modal Body
  cart.forEach((product) => {
    const modalBody = document.createElement("div");
    modalBody.className = "modal-body";
    modalBody.innerHTML = `
      <div class="product">
        <img class="product-img" src="${product.img}" alt="${product.productName}" />
        <div class="product-info">
          <h4>${product.productName}</h4>
        </div>
        <div class="quantity">
          <span class="quantity-btn-decrease">-</span>
          <span class="quantity-input">${product.quanty}</span>
          <span class="quantity-btn-increase">+</span>
        </div>
        <div class="price">${formatPrice(product.price * product.quanty)}</div>
        <div class="delete-product">❌</div>
      </div>
    `;
    modalContainer.append(modalBody);

    // Botón restar (-)
    const decrease = modalBody.querySelector(".quantity-btn-decrease");
    decrease.addEventListener("click", () => {
      if (product.quanty > 1) {
        product.quanty--;
        onCartChange();
        displayCart();
      }
    });

    // Botón sumar (+)
    const increase = modalBody.querySelector(".quantity-btn-increase");
    increase.addEventListener("click", () => {
      product.quanty++;
      onCartChange();
      displayCart();
    });

    // Botón eliminar (❌)
    const deleteProduct = modalBody.querySelector(".delete-product");
    deleteProduct.addEventListener("click", () => deleteCartProduct(product.id));
  });

  // modal Footer (Cálculo del total)
  const total = cart.reduce((acc, el) => acc + el.price * el.quanty, 0);

  const modalFooter = document.createElement("div");
  modalFooter.className = "modal-footer";
  modalFooter.innerHTML = `
    <div class="total-price">Total: ${formatPrice(total)}</div>
  `;
  modalContainer.append(modalFooter);

  // 4.2 - Botón de pago (solo si hay algo para cobrar)
  if (cart.length > 0) {
    modalFooter.append(createCheckoutSection());
  } else {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "cart-empty";
    emptyMessage.innerText = "El carrito está vacío 🛒";
    modalFooter.append(emptyMessage);
  }
};

const deleteCartProduct = (id) => {
  const foundId = cart.findIndex((element) => element.id === id);
  if (foundId === -1) return;

  cart.splice(foundId, 1);
  onCartChange();
  displayCart();
};

cartBtn.addEventListener("click", displayCart);

// El modal también se cierra tocando el fondo oscuro o con Escape
modalOverlay.addEventListener("click", closeCart);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && modalContainer.style.display === "flex") {
    closeCart();
  }
});

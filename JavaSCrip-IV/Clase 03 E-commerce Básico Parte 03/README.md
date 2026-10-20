<<<<<<< HEAD
# E-commerce - Clase 03

Ampliación de la tienda web desarrollada con HTML, CSS y JavaScript por el equipo **Los Sin Chamba**. En esta clase completamos la funcionalidad interna del modal del carrito: renderizado dinámico de productos, gestión de cantidades, cálculo total y eliminación de items.

---

## Proyecto grupal

Este proyecto continúa el desarrollo colaborativo del equipo **Los Sin Chamba**, profundizando en la manipulación del DOM, eventos dinámicos y métodos avanzados de arrays en JavaScript (`some`, `map`, `reduce`, `splice`).

---

## Qué hicimos en esta clase

### 3.1 Avanzamos en el Body del Modal
* Recorremos el array `cart` mediante un `forEach` para renderizar dinámicamente cada producto agregado.
* En cada iteración creamos un contenedor `modal-body` con la imagen, título, controles de cantidad, precio unitario/subtotal y un botón de eliminación (`❌`).

### 3.2 Ahora vamos al Footer
* Creamos el elemento `modal-footer` y lo añadimos al final del contenedor del modal.
* Este contenedor funciona como el bloque fijo inferior donde se mostrará el resumen de la compra y el monto total acumulado.

### 3.3 Configuramos las cantidades de productos
* Implementamos una validación en `index.js` usando `cart.some()` para verificar si el producto ya existe en el carrito antes de agregarlo.
* Si el producto ya está en el carrito, usamos `cart.map()` para incrementar su propiedad `quanty` en lugar de duplicar el elemento en el array; si no está, se pushea como un producto nuevo.

### 3.4 Botones de suma y resta de productos
* Capturamos los botones `+` (`quantity-btn-increse`) y `-` (`quantity-btn-decrese`) dentro del flujo de creación de cada tarjeta del modal.
* Al hacer click en `+`, incrementamos `product.quanty` y ejecutamos `displayCart()` para re-renderizar la vista con los nuevos valores.
* Al hacer click en `-`, validamos mediante un condicional (`product.quanty !== 1`) para evitar cantidades en cero o negativas, y actualizamos el modal.

### 3.5 Calcular el total de la compra
* Utilizamos el método `cart.reduce()` en el footer para calcular de forma acumulativa la suma total:
  ```javascript
  const total = cart.reduce((acc, el) => acc + el.price * el.quanty, 0);

## Conclusión

En esta tercera clase logramos que el carrito sea 100% interactivo y funcional. Aprendimos a controlar el estado de los datos usando métodos clave de arrays (`some`, `map`, `reduce` y `splice`) para resolver problemas reales: evitar productos duplicados, actualizar cantidades, calcular el total automáticamente y permitir eliminar ítems. Además, la técnica de volver a llamar a `displayCart()` nos permitió mantener la interfaz siempre sincronizada con los datos sin recargar la página. Gracias al trabajo en equipo de **Los Sin Chamba**, dimos un paso fundamental para transformar un catálogo estático en una verdadera experiencia de compra.
=======
# E-commerce - Clase 03

Ampliación de la tienda web desarrollada con HTML, CSS y JavaScript por el equipo **Los Sin Chamba**. En esta clase completamos la funcionalidad interna del modal del carrito: renderizado dinámico de productos, gestión de cantidades, cálculo total y eliminación de items.

---

## Proyecto grupal

Este proyecto continúa el desarrollo colaborativo del equipo **Los Sin Chamba**, profundizando en la manipulación del DOM, eventos dinámicos y métodos avanzados de arrays en JavaScript (`some`, `map`, `reduce`, `splice`).

---

## Qué hicimos en esta clase

### 3.1 Avanzamos en el Body del Modal
* Recorremos el array `cart` mediante un `forEach` para renderizar dinámicamente cada producto agregado.
* En cada iteración creamos un contenedor `modal-body` con la imagen, título, controles de cantidad, precio unitario/subtotal y un botón de eliminación (`❌`).

### 3.2 Ahora vamos al Footer
* Creamos el elemento `modal-footer` y lo añadimos al final del contenedor del modal.
* Este contenedor funciona como el bloque fijo inferior donde se mostrará el resumen de la compra y el monto total acumulado.

### 3.3 Configuramos las cantidades de productos
* Implementamos una validación en `index.js` usando `cart.some()` para verificar si el producto ya existe en el carrito antes de agregarlo.
* Si el producto ya está en el carrito, usamos `cart.map()` para incrementar su propiedad `quanty` en lugar de duplicar el elemento en el array; si no está, se pushea como un producto nuevo.

### 3.4 Botones de suma y resta de productos
* Capturamos los botones `+` (`quantity-btn-increse`) y `-` (`quantity-btn-decrese`) dentro del flujo de creación de cada tarjeta del modal.
* Al hacer click en `+`, incrementamos `product.quanty` y ejecutamos `displayCart()` para re-renderizar la vista con los nuevos valores.
* Al hacer click en `-`, validamos mediante un condicional (`product.quanty !== 1`) para evitar cantidades en cero o negativas, y actualizamos el modal.

### 3.5 Calcular el total de la compra
* Utilizamos el método `cart.reduce()` en el footer para calcular de forma acumulativa la suma total:
  ```javascript
  const total = cart.reduce((acc, el) => acc + el.price * el.quanty, 0);

## Conclusión

En esta tercera clase logramos que el carrito sea 100% interactivo y funcional. Aprendimos a controlar el estado de los datos usando métodos clave de arrays (`some`, `map`, `reduce` y `splice`) para resolver problemas reales: evitar productos duplicados, actualizar cantidades, calcular el total automáticamente y permitir eliminar ítems. Además, la técnica de volver a llamar a `displayCart()` nos permitió mantener la interfaz siempre sincronizada con los datos sin recargar la página. Gracias al trabajo en equipo de **Los Sin Chamba**, dimos un paso fundamental para transformar un catálogo estático en una verdadera experiencia de compra.
>>>>>>> d564aa40c30a9538e701c1134388af46763e9491

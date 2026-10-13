# E-commerce - Clase 02

Tienda simple hecha con HTML, CSS y JavaScript puro, desarrollada de forma grupal por el equipo Los Sin Chamba. Los productos salen de un array y se dibujan en pantalla con JS.

## Proyecto grupal

Este trabajo fue realizado en conjunto por el grupo Los Sin Chamba, aplicando conceptos de HTML, CSS y JavaScript para crear una pequeña tienda online funcional.

## Qué hice en esta clase

### 2.1 Botón de compra

A cada tarjeta de producto le agregué un botón "Comprar".

Lo creo con `createElement` en vez de escribirlo dentro del template string, porque después necesito engancharle un evento de click a ese botón en particular. Si lo metía en el HTML tendría que salir a buscarlo con un `querySelector`.

### 2.2 Carrito

Declaré `const cart = []` **afuera** del `forEach`. Si lo ponía adentro se me reiniciaba en cada vuelta.

Cuando hago click en "Comprar", se pushea al array un objeto con los datos del producto (id, nombre, precio, cantidad e imagen). Lo fui probando con `console.log(cart)` en la consola.

### 2.3 Modal del carrito

Agregué el botón 🛒 fijo arriba a la derecha. Al clickearlo llama a `displayCart()`.

Esa función pasa el `display` del modal y del overlay (el fondo oscuro) de `none` a `block`. El contenido del modal lo armo por JS: un header con el título "Carrito" y una ❌ que vuelve a ponerlos en `none` para cerrarlo.

Esto lo puse en un archivo aparte, `cart.js`, que va después de `index.js` en el HTML porque usa el array `cart` que se declara ahí.

## Archivos

```
index.html
styles.css
js/
  products.js   -> array con los productos
  index.js      -> dibuja los productos + botón + carrito
  cart.js       -> modal del carrito
media/          -> imágenes
```

## Conclusión

Este proyecto nos permitió poner en práctica conceptos fundamentales de JavaScript, organización del código y lógica de interacción en una página web. Gracias al trabajo en equipo del grupo Los Sin Chamba, logramos crear una pequeña tienda funcional con carrito y modal, reforzando habilidades de programación, colaboración y resolución de problemas.

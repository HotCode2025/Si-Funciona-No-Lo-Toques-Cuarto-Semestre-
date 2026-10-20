<<<<<<< HEAD
const productos = [
    {
        id: 1,
        productName: "Banana",
        price: 480,
        quanty: 1,
        img: "./media/banana.jpg",
    },
    {
        id: 2,
        productName: "Leche",
        price: 950,
        quanty: 1,
        img: "./media/leche.jpg",
    },
    {
        id: 3,
        productName: "Pollo",
        price: 750,
        quanty: 1,
        img: "./media/pollo.jpg",
    },
    {
        id: 4,
        productName: "Mayonesa",
        price: 510,
        quanty: 1,
        img: "./media/mayonesa.jpg",
    },
=======
const productos = [
    {
        id: 1,
        productName: "Banana",
        price: 480,
        quanty: 1,
        img: "./media/banana.jpg",
    },
    {
        id: 2,
        productName: "Leche",
        price: 950,
        quanty: 1,
        img: "./media/leche.jpg",
    },
    {
        id: 3,
        productName: "Pollo",
        price: 750,
        quanty: 1,
        img: "./media/pollo.jpg",
    },
    {
        id: 4,
        productName: "Mayonesa",
        price: 510,
        quanty: 1,
        img: "./media/mayonesa.jpg",
    },
>>>>>>> d564aa40c30a9538e701c1134388af46763e9491
];

// El servidor usa este mismo array para poner los precios (ver server.js),
// así nadie puede cambiarlos desde el navegador. En el navegador `module`
// no existe, por eso esta parte no hace nada ahí.
if (typeof module !== "undefined") {
    module.exports = productos;
}

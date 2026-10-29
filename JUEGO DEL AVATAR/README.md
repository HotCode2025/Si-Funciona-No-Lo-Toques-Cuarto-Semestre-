# 🔥 La Leyenda de Aang — Juego del Avatar

Un juego de combate por turnos inspirado en *Avatar: La Leyenda de Aang*: elegís un personaje y peleás contra un enemigo aleatorio con una mecánica de piedra-papel-tijera.

> **Clase 4 — Programación Orientada a Objetos:** el juego está armado con **clases y objetos**. Los personajes, los ataques y hasta las tarjetas del HTML se generan a partir de moldes, así que sumar 1, 100 o 1000 personajes no cambia una sola línea de la lógica. Ver [POO en este proyecto](#-clase-4--poo-en-este-proyecto).

---

## 🎮 ¿Cómo se juega?

1. **Elegí tu personaje:** Aang 🌪️, Katara 💧, Sokka 🪃 o Haru 🪨.
2. **Elegí un movimiento** en cada ronda: Puño 👊, Patada 🦵 o Barrida 🌀.
3. El enemigo elige su movimiento al azar.
4. Cada ronda tiene un resultado: **Ganaste / Perdiste / Empate**.
5. Cada derrota cuesta una vida (empezás con 3).
6. **Gana** quien deje al otro sin vidas primero.
7. Podés **reiniciar** el combate en cualquier momento.
8. Suena música de fondo: arranca con tu primer click y el botón 🔊/🔇 (abajo a la derecha) la apaga o la prende.

### ⚔️ Tabla de ventajas

| Movimiento   | Vence a      | Pierde contra |
|--------------|--------------|---------------|
| 👊 Puño      | 🌀 Barrida   | 🦵 Patada     |
| 🦵 Patada    | 👊 Puño      | 🌀 Barrida    |
| 🌀 Barrida   | 🦵 Patada    | 👊 Puño       |

---

## 📜 Reglamento del juego

1. Elegí tu personaje de la lista.
2. En cada turno elegí un movimiento: Puño, Patada o Barrida.
3. El enemigo ataca con un movimiento al azar.
4. Si tu movimiento vence al del enemigo, él pierde 1 vida.
5. Si el movimiento enemigo vence al tuyo, perdés 1 vida.
6. Si hay empate, nadie pierde vida.
7. El juego termina cuando alguno llega a 0 vidas.
8. Si ambos quedan en 0 vidas al mismo tiempo, es un empate final.
9. Podés reiniciar el combate cuando termine o si querés jugar otra vez.

---

## 👥 Equipo

| Rol | Integrante |
|---|---|
| **Scrum Master + Developer** | Lautaro Martinez |
| Developer | Samira Baz |
| Developer | Gabriel Maculus |
| Developer | Leandro Orozco |

> Trabajamos en tiempo real usando **VS Code Live Share** y nos coordinamos por **Discord** con metodología SCRUM.

---

## 🗂️ Estructura del proyecto

```
JUEGO DEL AVATAR/
├── avatar.html   → Estructura de la interfaz (contenedores vacíos que llena el JS)
├── avatar.css    → Estilos y diseño visual
├── avatar.js     → Clases, objetos y lógica completa del juego
├── img/          → Fotos de los personajes (aang.webp, katara.webp, ...) y fondo.jpg
├── audio/        → Música (aang-overcomes.m4a) y efectos (puno, patada, barrida, victoria, derrota .mp3)
├── README.md     → Este archivo
└── SCRUM.md      → Documentación de sprints y metodología
```

---

## 🧩 Clase 4 — POO en este proyecto

### Clase vs. objeto

Una **clase** es el molde; un **objeto** es cada cosa fabricada con ese molde. Si la clase es el *plano de la casa*, cada casa construida es un objeto. Acá el plano es `Personaje` y Aang, Katara, Sokka y Haru son los objetos.

- **Atributos** → los datos del objeto (`nombre`, `emoji`, `vidas`).
- **Métodos** → las acciones del objeto (`recibirGolpe()`, `clonar()`, `crearTarjeta()`).

### Las tres clases del juego

#### `class Ataque` — el molde de los movimientos

| Atributos | Métodos |
|---|---|
| `id`, `nombre`, `emoji`, `venceA`, `colorClaro`, `colorOscuro` | `leGanaA()`, `empataCon()`, `crearBoton()`, getter `etiqueta` |

Cada ataque sabe a quién le gana y sabe construir su propio botón con su color.

#### `class Personaje` — el molde de los peleadores

| Atributos | Métodos |
|---|---|
| `id`, `nombre`, `emoji`, `titulo`, `descripcion`, `foto`, `tinte`, `vidasMax`, `vidas` | `estaVivo()`, `enPeligro()`, `recibirGolpe()`, `curarse()`, `porcentajeVida()`, `presentarse()`, `elegirAtaque()`, `coincideCon()`, `clonar()`, `crearAvatar()`, `crearTarjeta()`, `crearTarjetaArena()`, `refrescarVida()` |

Dos ideas importantes de esta clase:

- **El objeto se dibuja solo.** `crearTarjeta()` y `crearTarjetaArena()` devuelven su propio HTML, y `refrescarVida()` actualiza su propia barra. El personaje es dueño de su parte de la pantalla.
- **`clonar()` es clave.** Si el jugador y el enemigo eligen el mismo personaje, sin clonar estarían usando *el mismo objeto* y compartirían las vidas. Peleamos siempre con copias frescas del catálogo.

#### `class Juego` — el molde de la partida

| Atributos | Métodos |
|---|---|
| `catalogo`, `ataques`, `jugador`, `enemigo`, `terminado` + referencias al DOM | `iniciar()`, `dibujarCatalogo()`, `dibujarAtaques()`, `dibujarReglas()`, `comenzarCombate()`, `atacar()`, `revisarFinDelJuego()`, `finalizar()`, `mostrarMensaje()`, `reiniciar()`, `agregarPersonajes()` |

### ➕ Agregar un personaje nuevo (1 línea)

En `avatar.js`, dentro del array `PERSONAJES`:

```js
new Personaje({
    id: 'zuko', nombre: 'Zuko', emoji: '🔥', titulo: 'Maestro Fuego',
    descripcion: 'Príncipe desterrado de la Nación del Fuego.',
    tinte: 'rgba(239, 68, 68, 0.14)'
})
```

Con eso ya aparece su tarjeta, puede ser elegido y puede salir como enemigo. **No se toca el HTML ni el CSS.** Si ponés `img/zuko.webp` usa la foto; si no, muestra el emoji.

### ➕ Agregar un movimiento nuevo

En el array `ATAQUES`. Como las reglas del modal también se generan desde los objetos, el reglamento se actualiza solo:

```js
new Ataque({ id: 'codazo', nombre: 'Codazo', emoji: '💥', venceA: 'barrida',
             colorClaro: '#c084fc', colorOscuro: '#7c3aed' })
```

> Ojo: la mecánica es un ciclo cerrado (cada movimiento vence a otro y pierde contra otro). Si sumás uno, revisá que el `venceA` de todos siga cerrando el círculo.

### 🚀 Generar 100, 1000 o los personajes que sean

Esto es lo que la POO nos regala: un `for` y el molde hacen todo el trabajo. Abrí el juego, apretá **F12** (consola del navegador) y probá:

```js
juego.agregarPersonajes(fabricarPersonajes(100));                          // 100 guerreros
juego.agregarPersonajes(fabricarPersonajes(1000, { nombre: 'Clon' }));     // 1000 más
```

Las tarjetas se dibujan solas, aparece el buscador y la grilla pasa a scrollear. Probado con **1104 personajes en pantalla**.

### 🔄 Qué cambió respecto de las clases anteriores

| Antes (clases 1 a 3) | Ahora (clase 4, POO) |
|---|---|
| `const jugador = { nombre, emoji, vidas }` escrito a mano | `new Personaje({...})` fabricado desde un molde |
| Las 4 tarjetas escritas a mano en el HTML | Las dibuja `Personaje.crearTarjeta()` |
| Un `#boton-puno`, `#boton-patada`... en el CSS | Cada `Ataque` inyecta sus colores con variables CSS |
| Una regla CSS por personaje para el tinte | El tinte es un atributo del objeto (`--tinte`) |
| Funciones sueltas manejando variables globales | Todo adentro de la clase `Juego` |
| Sumar un personaje = tocar HTML + CSS + JS | Sumar un personaje = 1 línea de JS |

---

## 🗺️ Clase 5 — Movimiento en el mapa (canvas)

Al confirmar el personaje aparece un **mapa** (`<canvas id="mapa">`). El movimiento es **cinematográfico**: acelera y frena con inercia, se inclina y se estira al correr, deja estela y partículas de su elemento, y Aang levita. Se controla con:

| Control | Qué hace |
|---|---|
| ← ↑ ↓ → o W A S D | Mover (se pueden combinar para ir en diagonal) |
| Botones en pantalla | Mover (`onmousedown` empieza, `onmouseup` frena) |
| Click o toque en el mapa | El personaje se desliza hasta ese punto |
| Shift o Espacio | Impulso (dash): doble velocidad, estela y temblor |
| Enter o botón **Ir al combate** | Pasar a la arena |

| Pieza | Dónde está | Qué hace |
|---|---|---|
| `x`, `y`, `ancho`, `alto`, `velocidadX`, `velocidadY`, `mapaFoto` | `Personaje` | Posición, tamaño, velocidad (px/seg) e imagen del canvas |
| `class MovimientoCinematico` | `avatar.js` | Entradas, física con inercia y efectos del canvas, en una clase aparte |
| `moverArriba()`… `detenerMovimiento()` | `Juego` | Los botones le avisan a `MovimientoCinematico` hacia dónde ir |
| `requestAnimationFrame` | `MovimientoCinematico.iniciar()` | Repinta ~60 veces por segundo (más suave que `setInterval`) |

---

## 🏆 Marcador guardado

En el menú se ve cuántas **victorias, derrotas y empates** llevás, y tu **racha** actual y la mejor, separado para el combate de cartas y para la Pelea 2D contra la CPU. Se guarda con `localStorage` (clase `Marcador`), así que sigue ahí aunque cierres la página. El botón **Borrar marcador** lo deja en cero. La pelea de a dos jugadores no suma.

---

## 🖼️ Imágenes nuevas y mapa

- **Personajes:** `img/aang.webp`, `katara.webp`, `sokka.webp`, `haru.webp`, `zuko.webp` y `toph.webp`: renders 3D **sin fondo** (transparentes). Zuko y Toph ahora tienen foto propia en las tarjetas, la arena y el Modo Pelea.
- **Fichas del mapa:** `img/mapa/<id>.png`: la cara del personaje en un círculo con el color de su elemento. Es la imagen que se mueve por el mapa (`mapaFoto` en la clase `Personaje`). Si un personaje creado no tiene ficha, se recorta la parte de arriba de su foto o se usa su emoji.
- **Mapa:** `img/mapa.jpg` (Las Cuatro Naciones) se pinta como fondo del canvas con `drawImage`. Cada personaje arranca en la nación de su elemento y el **enemigo espera en la suya** (ficha con aro que late). Cuando te acercás aparece "¡Enter para pelear!".
- **Enemigos en el mapa y colisiones:** en el mapa esperan todos los personajes del catálogo menos el tuyo (máximo 8), cada uno en la nación de su elemento. **Al chocar con uno empieza el combate contra ese enemigo** (`revisarColision(enemigo)`: compara los cuatro lados de los dos cuadros). Cada enemigo tiene sus movimientos favoritos (`TENDENCIAS`, como los `ataques.push(...)` de la clase). El botón **🎲 Enemigo al azar** y la tecla **Enter** (el más cercano) son atajos.
- **Teclado (como en la clase):** `sePresionoUnaTecla(event)` con un `switch (event.key)` llama a `moverArriba()`, `moverAbajo()`, `moverIzquierda()` o `moverDerecha()`; `keyup` llama a `detenerMovimiento()`. Además funcionan WASD, Shift/Espacio (impulso) y Enter.

---

## 🔄 Reiniciar y 🚪 Salir

| Dónde | 🔄 Reiniciar | 🚪 Salir |
|---|---|---|
| Mapa | — | Vuelve al menú de personajes |
| Arena de combate | Repite la misma pelea (mismos personajes, vidas al máximo) | Vuelve al menú de personajes |
| Fin del combate | Repite la misma pelea | Vuelve al menú de personajes |
| Modo Pelea 2D | Empieza de nuevo el partido (rondas en 0) | Vuelve al menú |

---

## 🥊 Modo Pelea 2D (segundo juego)

Desde el menú, el botón **🥊 Modo Pelea 2D** abre una pelea en tiempo real, de costado, al mejor de 3 rondas (60 segundos cada una). Se juega **contra la CPU** o **de a dos** en el mismo teclado. Cada peleador usa su foto, su elemento y los efectos del juego (sonidos, temblor de pantalla, partículas, cámara lenta en el K.O.).

| Acción | Jugador 1 | Jugador 2 |
|---|---|---|
| Mover | A / D | ← / → |
| Saltar | W | ↑ |
| Bloquear | S | ↓ |
| Puño (rápido) | F | K |
| Patada (más daño y alcance) | G | L |
| Poder del elemento (proyectil) | H | ; |

Está hecho en una clase aparte, `PeleaArcade`, que tiene el bucle de animación, la física (gravedad, saltos, empuje), la detección de golpes, la inteligencia de la CPU y todo el dibujo del canvas.

---

## 📄 Explicación del código

### `avatar.html`

Quedó como el **esqueleto**: los contenedores están vacíos y el JS los llena a partir de los objetos.

| Sección HTML | Qué hace | Quién la llena |
|---|---|---|
| `#seleccionar-personaje` | Buscador, contador y grilla de personajes | `Personaje.crearTarjeta()` |
| `#seleccionar-ataque` | Arena (vidas, fotos) y botones de movimiento | `Personaje.crearTarjetaArena()` y `Ataque.crearBoton()` |
| `#mensajes` | Historial de rondas | `Juego.mostrarMensaje()` |
| `#reiniciar` | Botón que aparece al terminar | — |
| `#modal-reglas` | Poderes y reglamento | `Juego.dibujarReglas()` |

**Colaboraron:** Lautaro Martinez · Samira Baz · Gabriel Maculus · Leandro Orozco

### `avatar.css`

- Variables CSS (`:root`) con la paleta temática y el fondo oscuro.
- `--tinte`, `--color-claro` y `--color-oscuro`: los objetos inyectan sus colores, el CSS no sabe cuántos personajes hay.
- Tarjetas con efecto de selección usando `:has(input:checked)`.
- Grilla del catálogo con scroll propio para catálogos grandes.
- Animación `slideIn` para los mensajes y diseño responsive.

**Colaboraron:** Lautaro Martinez · Gabriel Maculus (tema) · Samira Baz · Leandro Orozco (tarjetas y botones)

### `avatar.js`

Organizado en 6 bloques:

| # | Bloque | Contenido |
|---|---|---|
| 1 | `class Ataque` | Molde de los movimientos |
| 2 | `class Personaje` | Molde de los peleadores |
| 3 | `ATAQUES` y `PERSONAJES` | Los objetos concretos del juego |
| 4 | `class Juego` | Estado, DOM, combate y eventos |
| 5 | `fabricarPersonajes()` | Fábrica para generar N personajes con un `for` |
| 6 | Arranque | `new Juego(...)` + `juego.iniciar()` |

**Colaboraron:** Todo el equipo

---

## 🚀 ¿Cómo ejecutarlo?

Abrí `avatar.html` en el navegador o usá la extensión **Live Server** de VS Code. No requiere instalación ni dependencias externas.

---

## 📋 Metodología

Este proyecto se desarrolló con **SCRUM**. Ver [SCRUM.md](SCRUM.md) para el detalle de sprints, backlog y retrospectiva.

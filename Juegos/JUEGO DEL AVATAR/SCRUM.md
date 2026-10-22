# 🔥 LA LEYENDA DE AANG — METODOLOGÍA SCRUM

## Equipo de Desarrollo

| Rol                    | Integrante          |
|------------------------|---------------------|
| **Scrum Master + Developer** | Lautaro Martinez   |
| Developer              | Samira Baz         |
| Developer              | Gabriel Maculus    |
| Developer              | Leandro Orozco     |

---

## Herramientas de Trabajo

| Herramienta   | Uso                                                    |
|---------------|--------------------------------------------------------|
| **VS Code Live Share** | Colaboración en tiempo real sobre el mismo código |
| **Discord**   | Canal de voz/texto para comunicación diaria del equipo |

---

## ¿Qué es SCRUM?

SCRUM es un marco ágil que organiza el trabajo en **sprints** (ciclos cortos), con reuniones diarias (*daily standups*) y roles definidos. El objetivo es entregar incrementos funcionales del producto en cada sprint.

---

## Sprint 1 — Fundación del Proyecto

**Objetivo:** Definir estructura base del juego, personajes y mecánica piedra-papel-tijera.

### Backlog del Sprint

| # | Historia de Usuario | Responsable | Estado |
|---|---------------------|-------------|--------|
| 1 | Como jugador quiero elegir un personaje (Aang, Katara, Sokka, Haru) | Todo el equipo | ✅ Completado |
| 2 | Como jugador quiero atacar con puño, patada o barrida | Todo el equipo | ✅ Completado |
| 3 | Como jugador quiero ver el resultado de cada ronda | Todo el equipo | ✅ Completado |
| 4 | Como jugador quiero ver cuántas vidas me quedan | Todo el equipo | ✅ Completado |
| 5 | Como jugador quiero que el enemigo sea aleatorio | Todo el equipo | ✅ Completado |
| 6 | Como jugador quiero poder reiniciar el juego | Todo el equipo | ✅ Completado |

---

## Sprint 2 — Diseño Visual y UX

**Objetivo:** Aplicar diseño épico temático de Avatar con animaciones, tipografías y fondo dinámico.

### Backlog del Sprint

| # | Historia de Usuario | Responsable | Estado |
|---|---------------------|-------------|--------|
| 7 | Como jugador quiero una interfaz visual atractiva temática de Avatar | Todo el equipo | ✅ Completado |
| 8 | Como jugador quiero que los botones de ataque tengan colores del elemento | Todo el equipo | ✅ Completado |
| 9 | Como jugador quiero ver los mensajes de combate animados | Todo el equipo | ✅ Completado |
| 10 | Como jugador quiero tarjetas visuales para seleccionar personaje | Todo el equipo | ✅ Completado |

---

## Sprint 3 — Refactor a Programación Orientada a Objetos (Clase 4)

**Objetivo:** Rehacer el juego con clases y objetos para que el catálogo de personajes y de ataques pueda crecer sin repetir código ni tocar el HTML.

### Backlog del Sprint

| # | Historia de Usuario | Responsable | Estado |
|---|---------------------|-------------|--------|
| 11 | Como desarrollador quiero una clase `Personaje` (molde) para no escribir cada personaje a mano | Todo el equipo | ✅ Completado |
| 12 | Como desarrollador quiero una clase `Ataque` para sumar movimientos sin tocar HTML ni CSS | Todo el equipo | ✅ Completado |
| 13 | Como desarrollador quiero una clase `Juego` que agrupe el estado y la lógica de la partida | Todo el equipo | ✅ Completado |
| 14 | Como desarrollador quiero que cada personaje dibuje su propia tarjeta y su barra de vida | Todo el equipo | ✅ Completado |
| 15 | Como desarrollador quiero poder generar 100 o 1000 personajes con un `for` | Todo el equipo | ✅ Completado |
| 16 | Como jugador quiero un buscador cuando hay muchos personajes para elegir | Todo el equipo | ✅ Completado |
| 17 | Como jugador quiero ver el aviso "elegí un personaje" cuando confirmo sin elegir (bug: el mensaje se creaba en una sección oculta) | Todo el equipo | ✅ Completado |

### Decisiones técnicas del sprint

- **`clonar()`**: el combate usa copias de los personajes del catálogo. Sin esto, si el jugador y el enemigo eligen el mismo personaje, comparten el objeto y las vidas.
- **Colores como atributos**: el tinte de cada tarjeta y el degradado de cada botón viajan en el objeto y se aplican con variables CSS (`--tinte`, `--color-claro`, `--color-oscuro`). Antes hacía falta una regla CSS por personaje: para 1000 personajes eran 1000 reglas.
- **`DocumentFragment`**: el catálogo se arma en memoria y se inserta de una sola vez. Probado con 1104 tarjetas en pantalla sin trabar el navegador.

---

## Sprint 4 — Mapa de exploración y movimiento (Clase 5)

**Objetivo:** Sumar un mapa con canvas donde el personaje elegido se mueve con botones y teclado, y donde espera el enemigo.

### Backlog del Sprint

| # | Historia de Usuario | Responsable | Estado |
|---|---------------------|-------------|--------|
| 18 | Como jugador quiero un mapa (canvas) donde mover a mi personaje con los botones | Todo el equipo | ✅ Completado |
| 19 | Como jugador quiero mantener presionado el botón (o la tecla) y que siga moviéndose (`velocidadX/Y`, `detenerMovimiento()`) | Todo el equipo | ✅ Completado |
| 20 | Como jugador quiero mover al personaje con las flechas del teclado (`sePresionoUnaTecla`) y con WASD | Todo el equipo | ✅ Completado |
| 21 | Como jugador quiero el mapa de las Cuatro Naciones de fondo y ver a mi enemigo en el mapa | Todo el equipo | ✅ Completado |
| 22 | Como jugador quiero un movimiento fluido (inercia, estela, partículas, impulso, click para ir) | Todo el equipo | ✅ Completado |
| 23 | Como diseñador quiero imágenes sin fondo y fichas redondas acordes al mapa | Todo el equipo | ✅ Completado |

### Decisiones técnicas del sprint

- **`MovimientoCinematico`**: clase aparte que maneja entradas, física suave y dibujo del canvas con `requestAnimationFrame`.
- **Canvas 800 × 447**: la clase usa 800 × 600, pero eso deforma el mapa; se mantuvo la proporción de la imagen.
- **`mapaFoto` perezoso**: la imagen se asigna en `prepararMapa()`, no en el constructor, para no pedir 1000 fotos al fabricar 1000 personajes.

---

## Sprint 5 — Efectos, Modo Pelea 2D y marcador

**Objetivo:** Darle al juego sonido y efectos profesionales, sumar un segundo juego de pelea 2D y guardar el marcador.

### Backlog del Sprint

| # | Historia de Usuario | Responsable | Estado |
|---|---------------------|-------------|--------|
| 24 | Como jugador quiero sonidos reales de puño, patada, barrida, victoria y derrota | Todo el equipo | ✅ Completado |
| 25 | Como jugador quiero temblor de pantalla, destellos y cartel de victoria o derrota | Todo el equipo | ✅ Completado |
| 26 | Como jugador quiero subir el volumen de la música y de los efectos por separado | Todo el equipo | ✅ Completado |
| 27 | Como jugador quiero crear personajes con elemento, retrato o imagen propia y ver la vista previa | Todo el equipo | ✅ Completado |
| 28 | Como jugador quiero un Modo Pelea 2D (1 jugador vs CPU o 2 jugadores) con rondas, salto, bloqueo y poderes | Todo el equipo | ✅ Completado |
| 29 | Como jugador quiero botones de Reiniciar y Salir en todas las pantallas | Todo el equipo | ✅ Completado |
| 30 | Como jugador quiero que mis victorias, derrotas y racha queden guardadas (`localStorage`) | Todo el equipo | ✅ Completado |

### Decisiones técnicas del sprint

- **`PeleaArcade`**: clase aparte con bucle de animación, física, golpes, IA de la CPU y dibujo.
- **Sonidos dentro de `avatar.js`** (base64): así no dependen de carpetas ni de archivos que falten.
- **Cancelar efectos pendientes** al reiniciar o salir, para que no se rompan al leer personajes que ya no existen.

---

## División del Trabajo por Secciones

Todos los integrantes colaboraron en partes iguales a lo largo de ambos sprints mediante **VS Code Live Share**. Las secciones del proyecto y sus responsables conjuntos:

### `avatar.html`
- **Estructura HTML / semántica:** Lautaro Martinez, Samira Baz
- **Secciones de personajes y ataques:** Gabriel Maculus, Leandro Orozco
- **Panel de vidas y mensajes:** Todo el equipo

### `avatar.css` (estilos en `<style>`)
- **Variables CSS y tema visual:** Lautaro Martinez, Gabriel Maculus
- **Tarjetas de personaje y botones:** Samira Baz, Leandro Orozco
- **Animaciones y scrollbar:** Todo el equipo

### `avatar.js`
- **Clase `Personaje` (atributos y métodos):** Lautaro Martinez, Leandro Orozco
- **Clase `Ataque` y reglas de combate:** Gabriel Maculus, Samira Baz
- **Clase `Juego` (estado, DOM y eventos):** Todo el equipo
- **Fábrica `fabricarPersonajes()`:** Lautaro Martinez

---

## Daily Standup (modelo usado)

Cada sesión de trabajo comenzaba con una breve reunión en **Discord** respondiendo:

1. ¿Qué hice la última sesión?
2. ¿Qué voy a hacer hoy?
3. ¿Tengo algún bloqueo?

El **Scrum Master (Lautaro)** coordinaba la reunión y resolvía impedimentos técnicos.

---

## Definición de "Terminado" (Definition of Done)

Una historia se considera terminada cuando:
- [ ] El código funciona sin errores en el navegador
- [ ] Fue revisado por al menos otro integrante del equipo en Live Share
- [ ] La funcionalidad es visible y usable en la interfaz

---

## Retrospectiva Final

| ¿Qué salió bien? | ¿Qué mejoraríamos? |
|---|---|
| Comunicación fluida por Discord | Planificar los sprints con más detalle al inicio |
| Live Share permitió trabajar en tiempo real | Definir roles más específicos por tarea |
| Diseño visual coherente y temático | ~~Agregar más personajes y ataques~~ → resuelto en el Sprint 3 con POO |
| Mecánica de juego funcional y completa | ~~Incorporar sistema de puntuación persistente~~ → resuelto en el Sprint 5 (`Marcador`) |
| Pasar a POO nos sacó código repetido de encima | Separar el catálogo de personajes en su propio archivo |

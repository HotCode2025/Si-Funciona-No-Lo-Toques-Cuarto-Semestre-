# Amenaza Fantasma — Juego Pygame (UTN San Rafael)

Proyecto de juego con **Pygame** para la Tecnicatura en Programación — 2025 (reversionado).
Un tributo interactivo a Star Wars hecho con **programación orientada a objetos**.

Prólogo del juego:
[La Amenaza Fantasma PROLOGO.pdf](https://github.com/user-attachments/files/22438351/La.Amenaza.Fantasma.PROLOGO.pdf)

UML del juego:
<img width="1744" height="642" alt="image" src="https://github.com/user-attachments/assets/432bf061-8276-4acf-a4df-de1c7864de70" />

## Cómo jugar

```bash
pip install -r requirements.txt
python main.py
```

| Tecla / mouse | Acción |
|---------------|--------|
| Flechas / WASD | Mover la nave |
| Espacio | Disparar (mantener apretado) |
| **R** o botón **REINICIAR [R]** (arriba a la derecha) | **Reiniciar la partida en cualquier momento** |
| P o ESC | Pausa (el juego también se pausa si cambiás de ventana) |
| Flechas + ENTER, o mouse | Elegir en menú, pausa y game over |
| M | Volver al menú (desde pausa o game over) |

Si al reiniciar llevabas un puntaje mayor al récord, se guarda antes de empezar de cero.

## Qué tiene el juego

- **Menú principal**, **prólogo animado** estilo Star Wars, **pausa**, **reinicio** y **récord** guardado en `record.json`.
- **Niveles**: cada 250 puntos sube el nivel y cambia el fondo (con scroll infinito).
- **Dificultad progresiva con límites** (ver abajo): los enemigos nunca se vuelven imposibles de esquivar.
- **Enemigos que disparan** (rojizos) desde el nivel 2, cada vez más frecuentes.
- **Jefe** en los niveles 3, 6, 9... con barra de vida; suena la Marcha Imperial.
- **Ítems de energía** que a veces suelta un enemigo destruido (cruz verde).

### Dificultad y velocidad

| | Nivel 1 | Nivel 5 | Nivel 10+ |
|---|---|---|---|
| Velocidad enemiga (px/paso) | 5,0 | 7,0 | 9,0 (tope) |
| Un enemigo cada (ms, promedio) | 850 | 630 | 350 (mínimo) |
| Máximo de enemigos en pantalla | 6 | 10 | 14 (tope) |

- La lógica avanza en **pasos fijos de 1/60 s**: el juego va a la misma velocidad aunque tu PC dibuje a 30 o 45 FPS.
- La pausa **congela el reloj** del juego (los disparos, apariciones y avisos esperan).
- En diagonal la nave **no** va más rápida que en línea recta.
- Nunca se saltea un jefe, aunque el puntaje suba de golpe.
- Todos estos valores se editan en `constantes.py`.

## Estructura del proyecto

| Archivo | Contenido |
|---------|-----------|
| `main.py` | Punto de entrada |
| `juego.py` | `Juego`: controlador de estados (menú, jugando, pausa, game over), entrada, pantalla y sonido |
| `partida.py` | `Partida`: **toda la lógica del mundo** (sin ventana ni teclado, por eso se testea fácil). Reiniciar = crear una `Partida` nueva |
| `reglas.py` | Fórmulas de nivel y dificultad (funciones puras) |
| `personaje.py` | `Personaje`, `Enemigo`, `Laser` |
| `elementos.py` | `Jefe`, `LaserEnemigo`, `ItemEnergia` |
| `explosion.py` | `Explosion` (animación) |
| `interfaz.py` | `Boton`, `ListaBotones`, `texto_centrado` |
| `fondo.py` | `Fondo` con scroll infinito |
| `pantallas.py` | Imagen inicial, logo y prólogo |
| `audio.py` | Sonidos y música (si falta un archivo, sigue en silencio) |
| `records.py` | Guardar y leer el récord |
| `constantes.py` | Todos los valores configurables |
| `utilidades.py` | Carga de imágenes con cache |
| `tests/` | 55 tests automáticos con pytest |
| `tools/` | Generadores de imágenes y sonidos |

## Tests

```bash
pip install pytest
pytest
```

Los tests corren sin ventana ni sonido, así que funcionan también en GitHub Actions.

## Assets

Todo está en `assets_1/` (`images/`, `sounds/` y `svg/`). El juego ya trae todas las imágenes necesarias:

- **Naves** (`nave_jugador.png`, `nave_enemiga1.png`, `nave_enemiga2.png`): salen de los SVG de `assets_1/svg/`.
  El jugador es el caza (`fighter-aircraft-icon-by-Vexels.svg`, diseño de Vexels). Los enemigos son la nave de
  combate y el mismo caza girado y teñido. La nave de combate también es el jefe.
- **Láser, explosión, fondos, ícono e intro:** generados por código.
- **Sonidos:** `laserdis.mp3`, `explosion.mp3`, `efectos.mp3`, `Imperial_March_-_Kenobi.mp3`, `golpe.wav`, `nivel.wav`, `item.wav`.

Para cambiar una nave, reemplazá el SVG en `assets_1/svg/` y ejecutá:

```bash
pip install pillow cairosvg
python tools/generar_assets.py
```

Si falta alguna imagen, el juego avisa por consola, muestra en el menú cuántos archivos faltan y dibuja
naves de reemplazo (nunca cuadrados). Para saber exactamente qué falta y en qué carpeta lo busca:

```bash
python tools/verificar_assets.py
```

import os
import random
import sys
from functools import lru_cache

import pygame

from constantes import (
    ASSETS_PATH, IMAGES_PATH, SCREEN_WIDTH, SCREEN_HEIGHT, COLOR_LOGO_FONDO,
)

# Archivos que el juego necesita (relativos a assets_1/)
ASSETS_REQUERIDOS = (
    ['images/nave_jugador.png', 'images/nave_enemiga1.png', 'images/nave_enemiga2.png',
     'images/lase1.png', 'images/fondo2.jfif', 'images/fondo3.jpg', 'images/001.jfif',
     'images/logo.jpg', 'images/inicio/star.png', 'prologo.txt']
    + [f'images/regularExplosion0{i:02d}.png' for i in range(9)]
    + [f'sounds/{s}' for s in (
        'laserdis.mp3', 'explosion.mp3', 'efectos.mp3', 'Imperial_March_-_Kenobi.mp3',
        'golpe.wav', 'nivel.wav', 'item.wav')]
)


def verificar_assets():
    """Devuelve la lista de archivos que faltan en assets_1/ (vacía si está todo)."""
    return [ruta for ruta in ASSETS_REQUERIDOS
            if not os.path.isfile(os.path.join(ASSETS_PATH, *ruta.split('/')))]


def salir():
    pygame.quit()
    sys.exit()


def _caza(ancho=82, alto=120):
    """Dibuja un caza simple (apunta hacia arriba) para usar si falta la imagen."""
    s = pygame.Surface((ancho, alto), pygame.SRCALPHA)
    k = ancho / 82
    puntos = [(41, 0), (50, 40), (82, 95), (82, 105), (52, 92), (48, 118), (41, 112),
              (34, 118), (30, 92), (0, 105), (0, 95), (32, 40)]
    puntos = [(x * k, y * alto / 120) for x, y in puntos]
    pygame.draw.polygon(s, (205, 210, 222), puntos)
    pygame.draw.polygon(s, (80, 92, 115), puntos, 3)
    pygame.draw.ellipse(s, (110, 180, 180), (ancho * 0.44, alto * 0.18, ancho * 0.12, alto * 0.26))
    return s


def _nave_de_combate(ancho=330, alto=156):
    s = pygame.Surface((ancho, alto), pygame.SRCALPHA)
    ax, ay = ancho / 330, alto / 156
    casco = [(110, 22), (220, 22), (255, 95), (165, 150), (75, 95)]
    pygame.draw.polygon(s, (92, 108, 152), [(x * ax, y * ay) for x, y in casco])
    pygame.draw.polygon(s, (50, 60, 95), [(x * ax, y * ay) for x, y in casco], 4)
    for cx in (42, 288):
        pygame.draw.rect(s, (80, 95, 138), (min(cx, 165) * ax, 55 * ay, abs(165 - cx) * ax, 22 * ay))
        pygame.draw.circle(s, (70, 82, 120), (cx * ax, 70 * ay), 38 * min(ax, ay))
        pygame.draw.circle(s, (30, 36, 60), (cx * ax, 70 * ay), 24 * min(ax, ay))
    pygame.draw.ellipse(s, (150, 190, 215), (140 * ax, 40 * ay, 50 * ax, 24 * ay))
    return s


def _reemplazo(nombre, tamano):
    """Imagen dibujada por código que se usa cuando falta el archivo (nunca un cuadrado)."""
    base = os.path.basename(nombre)
    if base == 'nave_jugador.png':
        imagen = _caza()
    elif base == 'nave_enemiga1.png':
        imagen = _nave_de_combate()
    elif base == 'nave_enemiga2.png':
        imagen = pygame.transform.flip(_caza(76, 112), False, True)
        imagen.fill((170, 140, 210, 255), special_flags=pygame.BLEND_RGBA_MULT)
    elif base == 'lase1.png':
        imagen = pygame.Surface((16, 44), pygame.SRCALPHA)
        pygame.draw.rect(imagen, (60, 140, 255), (3, 2, 10, 40), border_radius=5)
        pygame.draw.rect(imagen, (225, 240, 255), (6, 6, 4, 32), border_radius=2)
    elif base.startswith('regularExplosion'):
        t = int(base[len('regularExplosion0'):-4]) / 8
        imagen = pygame.Surface((140, 140), pygame.SRCALPHA)
        alfa = int(255 * (1 - 0.9 * t ** 2))
        radio = 14 + 50 * t ** 0.6
        for k, color in enumerate(((255, 70, 0), (255, 150, 0), (255, 220, 90), (255, 255, 235))):
            pygame.draw.circle(imagen, color + (alfa,), (70, 70), max(2, int(radio * (1 - 0.22 * k))))
    else:
        imagen = pygame.Surface((50, 50), pygame.SRCALPHA)
        pygame.draw.circle(imagen, (255, 0, 255, 255), (25, 25), 25)
    if tamano and imagen.get_size() != tuple(tamano):
        imagen = pygame.transform.smoothscale(imagen, tamano)
    return imagen


@lru_cache(maxsize=None)
def cargar_imagen(nombre, tamano=None):
    """Carga una imagen una sola vez y la reutiliza (cache).

    Si el archivo no existe, avisa por consola y devuelve un cuadrado
    magenta, así el juego (y los tests) no se rompen por un asset faltante.
    Requiere que la pantalla ya esté inicializada (convert_alpha).
    """
    ruta = os.path.join(IMAGES_PATH, nombre)
    try:
        imagen = pygame.image.load(ruta).convert_alpha()
    except (pygame.error, FileNotFoundError):
        print(f"[aviso] No se pudo cargar la imagen: {ruta}")
        return _reemplazo(nombre, tamano)
    if tamano:
        imagen = pygame.transform.smoothscale(imagen, tamano)
    return imagen


@lru_cache(maxsize=None)
def cargar_imagen_tinte(nombre, tamano, color):
    """Devuelve la imagen multiplicada por `color` (sirve para variantes rojizas)."""
    imagen = cargar_imagen(nombre, tamano).copy()
    imagen.fill(color, special_flags=pygame.BLEND_RGBA_MULT)
    return imagen


def cargar_fondo(nombre):
    ruta = os.path.join(IMAGES_PATH, nombre)
    try:
        fondo = pygame.image.load(ruta).convert()
    except (pygame.error, FileNotFoundError):
        print(f"[aviso] No se pudo cargar el fondo: {ruta}")
        fondo = pygame.Surface((SCREEN_WIDTH, SCREEN_HEIGHT))
        fondo.fill(COLOR_LOGO_FONDO)
        azar = random.Random(len(nombre))
        for _ in range(500):   # estrellas, para que no sea un fondo liso
            brillo = azar.randint(110, 255)
            pygame.draw.circle(fondo, (brillo, brillo, brillo),
                               (azar.randint(0, SCREEN_WIDTH), azar.randint(0, SCREEN_HEIGHT)), azar.choice((1, 1, 2)))
        return fondo
    return pygame.transform.scale(fondo, (SCREEN_WIDTH, SCREEN_HEIGHT))

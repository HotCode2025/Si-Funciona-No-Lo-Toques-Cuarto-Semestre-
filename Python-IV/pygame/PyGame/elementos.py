"""Elementos nuevos del juego: láser enemigo, ítem de energía y jefe."""
from functools import lru_cache

import pygame

import reglas
from constantes import (
    SCREEN_WIDTH, SCREEN_HEIGHT, VELOCIDAD_LASER_ENEMIGO, VELOCIDAD_ITEM,
    COLOR_TINTE_JEFE,
    COLOR_ROJO, COLOR_VERDE, COLOR_BLANCO, IMG_JEFE,
)
from utilidades import cargar_imagen_tinte


@lru_cache(maxsize=None)
def _superficie_laser_enemigo():
    s = pygame.Surface((8, 28), pygame.SRCALPHA)
    pygame.draw.rect(s, (255, 60, 60), (0, 0, 8, 28), border_radius=4)
    pygame.draw.rect(s, (255, 210, 210), (3, 3, 2, 22))
    return s


@lru_cache(maxsize=None)
def _superficie_item():
    s = pygame.Surface((36, 36), pygame.SRCALPHA)
    pygame.draw.circle(s, (0, 170, 70), (18, 18), 17)
    pygame.draw.circle(s, COLOR_BLANCO, (18, 18), 17, 2)
    pygame.draw.rect(s, COLOR_BLANCO, (15, 8, 6, 20))
    pygame.draw.rect(s, COLOR_BLANCO, (8, 15, 20, 6))
    return s


class LaserEnemigo:
    def __init__(self, x, y, dx=0):
        self.image = _superficie_laser_enemigo()
        self.rect = self.image.get_rect(midtop=(x, y))
        self.dx = dx

    def mover(self):
        self.rect.y += VELOCIDAD_LASER_ENEMIGO
        self.rect.x += self.dx

    def fuera_de_pantalla(self):
        return (self.rect.top > SCREEN_HEIGHT
                or self.rect.right < 0 or self.rect.left > SCREEN_WIDTH)

    def dibujar(self, screen):
        screen.blit(self.image, self.rect)


class ItemEnergia:
    """Cae desde donde murió un enemigo; al agarrarlo recupera energía."""

    def __init__(self, x, y):
        self.image = _superficie_item()
        self.rect = self.image.get_rect(center=(x, y))

    def mover(self):
        self.rect.y += VELOCIDAD_ITEM

    def fuera_de_pantalla(self):
        return self.rect.top > SCREEN_HEIGHT

    def dibujar(self, screen):
        screen.blit(self.image, self.rect)


class Jefe:
    """Nave grande que entra desde arriba, se mueve de lado a lado y dispara en abanico."""

    def __init__(self, nivel):
        """`nivel` es el nivel en el que aparece este jefe (3, 6, 9...)."""
        self.vida_max = reglas.vida_jefe(nivel)
        self.vida = self.vida_max
        self.image = cargar_imagen_tinte(IMG_JEFE, None, COLOR_TINTE_JEFE)
        self.rect = self.image.get_rect(midbottom=(SCREEN_WIDTH // 2, 0))
        self.direccion = 1
        self.velocidad_x = reglas.velocidad_jefe(nivel)
        self.intervalo = reglas.intervalo_disparo_jefe(nivel)
        self.entrando = True
        self._prox_disparo = 0

    @property
    def derrotado(self):
        return self.vida <= 0

    def recibir_golpe(self, dano=1):
        self.vida = max(0, self.vida - dano)

    def actualizar(self, ahora):
        """Mueve al jefe. Devuelve la lista de láseres que disparó en este frame."""
        if self.entrando:
            self.rect.y += 3
            if self.rect.top >= 40:
                self.entrando = False
                self._prox_disparo = ahora + 800
            return []

        self.rect.x += self.direccion * self.velocidad_x
        if self.rect.right >= SCREEN_WIDTH:
            self.rect.right = SCREEN_WIDTH
            self.direccion = -1
        elif self.rect.left <= 0:
            self.rect.left = 0
            self.direccion = 1

        if ahora < self._prox_disparo:
            return []
        self._prox_disparo = ahora + self.intervalo
        x, y = self.rect.midbottom
        return [LaserEnemigo(x, y, dx) for dx in (-3, 0, 3)]

    def dibujar(self, screen):
        screen.blit(self.image, self.rect)
        ancho, x = 500, SCREEN_WIDTH // 2 - 250   # barra de vida
        pygame.draw.rect(screen, COLOR_ROJO, (x, 12, ancho, 14))
        pygame.draw.rect(screen, COLOR_VERDE, (x, 12, int(ancho * self.vida / self.vida_max), 14))
        pygame.draw.rect(screen, COLOR_BLANCO, (x, 12, ancho, 14), 2)

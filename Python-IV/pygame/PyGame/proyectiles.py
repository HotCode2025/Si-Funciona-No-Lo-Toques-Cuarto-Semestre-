"""Proyectiles del jugador: láser, bala de metralleta y misil teledirigido."""
import math
import random
from functools import lru_cache

import pygame

from constantes import (
    SCREEN_WIDTH, SCREEN_HEIGHT, VELOCIDAD_LASER, VELOCIDAD_BALA, DANO_BALA,
    MISIL_VELOCIDAD_INICIAL, MISIL_VELOCIDAD_MAX, MISIL_ACELERACION, MISIL_GIRO,
    MISIL_RADIO_EXPLOSION, MISIL_DANO, MISIL_VIDA_PASOS,
)
from utilidades import cargar_imagen


@lru_cache(maxsize=None)
def _laser_inclinado(grados):
    base = cargar_imagen('lase1.png')
    return pygame.transform.rotozoom(base, grados, 1) if grados else base


@lru_cache(maxsize=None)
def _bala_inclinada(grados):
    s = pygame.Surface((6, 16), pygame.SRCALPHA)
    pygame.draw.rect(s, (255, 205, 60), (0, 0, 6, 16), border_radius=3)
    pygame.draw.rect(s, (255, 250, 200), (2, 2, 2, 11), border_radius=1)
    return pygame.transform.rotozoom(s, grados, 1) if grados else s


@lru_cache(maxsize=None)
def _misil_rotado(grados):
    """Misil dibujado apuntando hacia arriba, rotado `grados` (antihorario)."""
    s = pygame.Surface((14, 36), pygame.SRCALPHA)
    pygame.draw.polygon(s, (230, 120, 30), [(3, 24), (0, 36), (4, 32)])    # aletas
    pygame.draw.polygon(s, (230, 120, 30), [(11, 24), (14, 36), (10, 32)])
    pygame.draw.rect(s, (205, 210, 222), (3, 8, 8, 24), border_radius=2)   # cuerpo
    pygame.draw.polygon(s, (225, 55, 45), [(7, 0), (3, 10), (11, 10)])     # punta
    pygame.draw.rect(s, (110, 120, 140), (3, 8, 8, 24), width=1, border_radius=2)
    return pygame.transform.rotozoom(s, grados, 1) if grados else s


class Proyectil:
    """Base de todo lo que dispara el jugador."""
    dano = 1
    radio_explosion = 0   # mayor a 0 = explota al impactar y daña en área

    def __init__(self, x, y, imagen):
        self.image = imagen
        self.rect = imagen.get_rect(center=(x, y))

    def mover(self, objetivos=()):
        raise NotImplementedError

    def fuera_de_pantalla(self):
        r = self.rect
        return r.bottom < 0 or r.top > SCREEN_HEIGHT or r.right < 0 or r.left > SCREEN_WIDTH

    def dibujar(self, screen):
        screen.blit(self.image, self.rect)


class Laser(Proyectil):
    velocidad = VELOCIDAD_LASER

    def __init__(self, x, y, dx=0.0):
        """`dx`: desvío horizontal por paso (para los disparos en abanico)."""
        self.dx = dx
        self._resto_x = 0.0
        super().__init__(x, y, self._imagen())

    def _imagen(self):
        return _laser_inclinado(round(math.degrees(math.atan2(-self.dx, self.velocidad))))

    def mover(self, objetivos=()):
        self.rect.y -= self.velocidad
        self._resto_x += self.dx
        paso = int(self._resto_x)
        self._resto_x -= paso
        self.rect.x += paso


class Bala(Laser):
    """Disparo de la metralleta: rápido, finito y con un poco de dispersión."""
    velocidad = VELOCIDAD_BALA
    dano = DANO_BALA

    def _imagen(self):
        return _bala_inclinada(round(math.degrees(math.atan2(-self.dx, self.velocidad))))


class Misil(Proyectil):
    """Sale hacia arriba, acelera y gira para perseguir al enemigo más cercano. Explota en área."""
    dano = MISIL_DANO
    radio_explosion = MISIL_RADIO_EXPLOSION

    def __init__(self, x, y):
        super().__init__(x, y, _misil_rotado(0))
        self._x, self._y = float(x), float(y)
        self.rumbo = -math.pi / 2          # hacia arriba
        self.velocidad = MISIL_VELOCIDAD_INICIAL
        self.pasos = 0

    def _elegir_objetivo(self, objetivos):
        candidatos = [r for r in objetivos if r.bottom > 0]   # solo los que ya se ven
        if not candidatos:
            return None
        return min(candidatos, key=lambda r: math.hypot(r.centerx - self._x, r.centery - self._y))

    def mover(self, objetivos=()):
        self.pasos += 1
        objetivo = self._elegir_objetivo(objetivos)
        if objetivo:
            deseado = math.atan2(objetivo.centery - self._y, objetivo.centerx - self._x)
            diferencia = (deseado - self.rumbo + math.pi) % (2 * math.pi) - math.pi
            self.rumbo += max(-MISIL_GIRO, min(MISIL_GIRO, diferencia))
        self.velocidad = min(MISIL_VELOCIDAD_MAX, self.velocidad + MISIL_ACELERACION)
        self._x += math.cos(self.rumbo) * self.velocidad
        self._y += math.sin(self.rumbo) * self.velocidad
        grados = 5 * round(-(math.degrees(self.rumbo) + 90) / 5)   # en pasos de 5° para reutilizar imágenes
        self.image = _misil_rotado(grados)
        self.rect = self.image.get_rect(center=(round(self._x), round(self._y)))

    def fuera_de_pantalla(self):
        r = self.rect
        return (self.pasos > MISIL_VIDA_PASOS or r.bottom < -80 or r.top > SCREEN_HEIGHT + 80
                or r.right < -80 or r.left > SCREEN_WIDTH + 80)

    def dibujar(self, screen):
        dx, dy = math.cos(self.rumbo), math.sin(self.rumbo)
        cola = (self._x - dx * 17, self._y - dy * 17)
        largo = 12 + random.uniform(0, 6)
        punta = (cola[0] - dx * largo, cola[1] - dy * largo)
        px, py = -dy * 4, dx * 4
        pygame.draw.polygon(screen, (255, 140, 30), [(cola[0] + px, cola[1] + py), (cola[0] - px, cola[1] - py), punta])
        super().dibujar(screen)

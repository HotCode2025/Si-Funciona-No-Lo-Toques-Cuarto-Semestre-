"""Armas del jugador. Cada arma decide cuántos proyectiles salen, de qué tipo y cada cuánto."""
import random
from dataclasses import dataclass
from typing import Callable

from constantes import (
    COOLDOWN_LASER_MS, COOLDOWN_DOBLE_MS, COOLDOWN_TRIPLE_MS, COOLDOWN_METRALLETA_MS, COOLDOWN_MISIL_MS,
)
from proyectiles import Bala, Laser, Misil


@dataclass(frozen=True)
class Arma:
    clave: str
    nombre: str
    cooldown_ms: int
    sonido: str            # evento de sonido que se reproduce al disparar
    color: tuple           # color en el HUD
    crear: Callable        # recibe el rectángulo de la nave y devuelve la lista de proyectiles


def _simple(nave):
    return [Laser(nave.centerx, nave.top)]


def _doble(nave):
    return [Laser(nave.centerx - 18, nave.top + 12), Laser(nave.centerx + 18, nave.top + 12)]


def _triple(nave):
    return [Laser(nave.centerx, nave.top),
            Laser(nave.centerx - 10, nave.top + 8, dx=-3),
            Laser(nave.centerx + 10, nave.top + 8, dx=3)]


def _metralleta(nave):
    lado = random.choice((-16, 16))   # alterna entre los dos cañones
    return [Bala(nave.centerx + lado, nave.top + 16, dx=random.uniform(-1.2, 1.2))]


def _misiles(nave):
    return [Misil(nave.centerx - 24, nave.top + 40), Misil(nave.centerx + 24, nave.top + 40)]


ARMAS = {
    'simple': Arma('simple', 'LÁSER', COOLDOWN_LASER_MS, 'laser', (255, 255, 255), _simple),
    'doble': Arma('doble', 'DOBLE CAÑÓN', COOLDOWN_DOBLE_MS, 'laser', (70, 190, 255), _doble),
    'triple': Arma('triple', 'TRIPLE', COOLDOWN_TRIPLE_MS, 'laser', (130, 160, 255), _triple),
    'metralleta': Arma('metralleta', 'METRALLETA', COOLDOWN_METRALLETA_MS, 'bala', (255, 170, 40), _metralleta),
    'misil': Arma('misil', 'MISILES', COOLDOWN_MISIL_MS, 'misil', (255, 90, 50), _misiles),
}

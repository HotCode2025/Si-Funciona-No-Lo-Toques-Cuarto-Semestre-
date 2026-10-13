import random

import pygame

from constantes import (
    SCREEN_WIDTH, SCREEN_HEIGHT, ENERGIA_MAXIMA,
    COOLDOWN_LASER_MS, DANO_COLISION, VELOCIDAD_LASER, VELOCIDAD_ENEMIGO_BASE,
    INTERVALO_DISPARO_ENEMIGO, COLOR_TINTE_DISPARADOR, COLOR_ROJO, COLOR_VERDE,
    IMG_JUGADOR, TIPOS_ENEMIGO,
)
from elementos import LaserEnemigo
from utilidades import cargar_imagen, cargar_imagen_tinte


class Laser:
    def __init__(self, x, y):
        self.image = cargar_imagen('lase1.png')
        self.rect = self.image.get_rect(center=(x, y))

    def mover(self):
        self.rect.y -= VELOCIDAD_LASER

    def fuera_de_pantalla(self):
        return self.rect.bottom < 0

    def dibujar(self, screen):
        screen.blit(self.image, self.rect)


class Personaje:
    def __init__(self, x, y):
        self.image = cargar_imagen(IMG_JUGADOR)
        self.shape = self.image.get_rect(center=(x, y))
        self.lasers = []
        self.energia = ENERGIA_MAXIMA
        self._ultimo_disparo = -COOLDOWN_LASER_MS   # puede disparar desde el primer instante
        self._resto_x = 0.0   # fracción de píxel que todavía no se aplicó
        self._resto_y = 0.0
        self._limites = pygame.Rect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT)

    def mover(self, dx, dy):
        """Mueve la nave. Acepta decimales (se acumulan) y no deja salir de la pantalla."""
        self._resto_x += dx
        self._resto_y += dy
        paso_x, paso_y = int(self._resto_x), int(self._resto_y)
        self._resto_x -= paso_x
        self._resto_y -= paso_y
        self.shape.move_ip(paso_x, paso_y)
        self.shape.clamp_ip(self._limites)

    def lanzar_laser(self, ahora):
        """Dispara si pasó el cooldown. `ahora` es el tiempo del juego en ms. Devuelve True si disparó."""
        if ahora - self._ultimo_disparo < COOLDOWN_LASER_MS:
            return False
        self._ultimo_disparo = ahora
        self.lasers.append(Laser(self.shape.centerx, self.shape.top))
        return True

    def recibir_dano(self, cantidad=DANO_COLISION):
        """Resta energía. Devuelve False si el personaje se quedó sin energía."""
        self.energia = max(0, self.energia - cantidad)
        return self.energia > 0

    def curar(self, cantidad):
        self.energia = min(ENERGIA_MAXIMA, self.energia + cantidad)

    def actualizar(self):
        """Mueve los láseres y descarta los que salieron de la pantalla."""
        for laser in self.lasers:
            laser.mover()
        self.lasers = [las for las in self.lasers if not las.fuera_de_pantalla()]

    def dibujar(self, screen):
        screen.blit(self.image, self.shape)
        for laser in self.lasers:
            laser.dibujar(screen)
        # Barra de energía
        pygame.draw.rect(screen, COLOR_ROJO, (10, 10, ENERGIA_MAXIMA, 10))
        pygame.draw.rect(screen, COLOR_VERDE, (10, 10, self.energia, 10))


class Enemigo:
    def __init__(self, x, y, velocidad=VELOCIDAD_ENEMIGO_BASE, dispara=False, tipo=None, ahora=0):
        nombre, tamano = tipo or random.choice(TIPOS_ENEMIGO)   # nave enemiga al azar
        if dispara:
            # Los que disparan se ven rojizos para distinguirlos
            self.image = cargar_imagen_tinte(nombre, tamano, COLOR_TINTE_DISPARADOR)
        else:
            self.image = cargar_imagen(nombre, tamano)
        self.rect = self.image.get_rect(topleft=(x, y))
        self.velocidad = velocidad
        self.dispara = dispara
        self._resto = 0.0   # fracción de píxel pendiente (las velocidades pueden tener decimales)
        self._prox_disparo = ahora + random.randint(*INTERVALO_DISPARO_ENEMIGO)

    def mover(self):
        self._resto += self.velocidad
        paso = int(self._resto)
        self._resto -= paso
        self.rect.y += paso

    def disparar(self, ahora):
        """Devuelve un LaserEnemigo si le toca disparar; si no, None."""
        if not self.dispara or ahora < self._prox_disparo:
            return None
        self._prox_disparo = ahora + random.randint(*INTERVALO_DISPARO_ENEMIGO)
        return LaserEnemigo(self.rect.centerx, self.rect.bottom)

    def fuera_de_pantalla(self):
        return self.rect.top > SCREEN_HEIGHT

    def dibujar(self, screen):
        screen.blit(self.image, self.rect)

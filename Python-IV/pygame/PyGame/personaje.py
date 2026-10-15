import math
import random

import pygame

from constantes import (
    SCREEN_WIDTH, SCREEN_HEIGHT, ENERGIA_MAXIMA, VELOCIDAD_PERSONAJE, ACELERACION_PERSONAJE,
    FRENADO_PERSONAJE, GIRO_BRUSCO, INCLINACION_MAX, SUAVIZADO_INCLINACION,
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
        self.vx = 0.0         # velocidad actual (px por paso)
        self.vy = 0.0
        self.angulo = 0.0     # inclinación visual en grados (+ = hacia la izquierda)
        self._inclinadas = {}  # imágenes ya rotadas, por ángulo
        self._limites = pygame.Rect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT)

    # ------------------------------------------------------------ movimiento
    @staticmethod
    def _acelerar(velocidad, direccion):
        """Un paso de aceleración (hay tecla apretada) o de frenado (no hay) en un eje."""
        if direccion:
            paso = ACELERACION_PERSONAJE
            if velocidad * direccion < 0:   # va para el otro lado: frena más fuerte
                paso *= GIRO_BRUSCO
            objetivo = direccion * VELOCIDAD_PERSONAJE
            return velocidad + max(-paso, min(paso, objetivo - velocidad))
        return velocidad - max(-FRENADO_PERSONAJE, min(FRENADO_PERSONAJE, velocidad))

    def dirigir(self, dir_x, dir_y):
        """Un paso de movimiento con inercia. dir_x, dir_y: dirección pedida (-1, 0 o 1).

        La nave acelera de a poco, se desliza al soltar y se inclina al girar.
        En diagonal la velocidad total es la misma que en línea recta.
        """
        longitud = math.hypot(dir_x, dir_y)
        if longitud:
            dir_x, dir_y = dir_x / longitud, dir_y / longitud
        self.vx = self._acelerar(self.vx, dir_x)
        self.vy = self._acelerar(self.vy, dir_y)
        self.mover(self.vx, self.vy)
        objetivo = -self.vx / VELOCIDAD_PERSONAJE * INCLINACION_MAX
        self.angulo += (objetivo - self.angulo) * SUAVIZADO_INCLINACION

    def mover(self, dx, dy):
        """Desplaza la nave. Acepta decimales (se acumulan) y no deja salir de la pantalla.

        Si choca con el borde, pierde la velocidad en ese eje (no queda "pegada" empujando).
        """
        self._resto_x += dx
        self._resto_y += dy
        paso_x, paso_y = int(self._resto_x), int(self._resto_y)
        self._resto_x -= paso_x
        self._resto_y -= paso_y
        self.shape.move_ip(paso_x, paso_y)
        self.shape.clamp_ip(self._limites)
        lim = self._limites
        if (self.shape.left <= lim.left and self.vx < 0) or (self.shape.right >= lim.right and self.vx > 0):
            self.vx = self._resto_x = 0.0
        if (self.shape.top <= lim.top and self.vy < 0) or (self.shape.bottom >= lim.bottom and self.vy > 0):
            self.vy = self._resto_y = 0.0

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

    # ---------------------------------------------------------------- dibujo
    def _imagen_inclinada(self):
        grados = round(self.angulo)
        if grados == 0:
            return self.image
        if grados not in self._inclinadas:
            self._inclinadas[grados] = pygame.transform.rotozoom(self.image, grados, 1)
        return self._inclinadas[grados]

    def _dibujar_llama(self, screen):
        """Llama de los dos motores: titila y se alarga cuando la nave avanza hacia arriba."""
        rad = math.radians(self.angulo)
        seno, coseno = math.sin(rad), math.cos(rad)
        ancho, alto = self.shape.size
        empuje = max(0.0, -self.vy) / VELOCIDAD_PERSONAJE          # 0 a 1
        largo = 14 + 12 * empuje + random.uniform(0, 7) - (5 if self.vy > 0 else 0)
        cx, cy = self.shape.center
        for ox in (-0.07 * ancho, 0.07 * ancho):
            oy = alto * 0.5 - 6
            bx = cx + ox * coseno + oy * seno      # el punto trasero gira junto con la nave
            by = cy - ox * seno + oy * coseno
            for escala_ancho, escala_largo, color in ((5, 1.0, (255, 120, 20)), (2.5, 0.6, (255, 235, 170))):
                izquierda = (bx - coseno * escala_ancho, by + seno * escala_ancho)
                derecha = (bx + coseno * escala_ancho, by - seno * escala_ancho)
                punta = (bx + seno * largo * escala_largo, by + coseno * largo * escala_largo)
                pygame.draw.polygon(screen, color, [izquierda, derecha, punta])

    def dibujar(self, screen):
        self._dibujar_llama(screen)
        imagen = self._imagen_inclinada()
        screen.blit(imagen, imagen.get_rect(center=self.shape.center))
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

"""Lógica de una partida: naves, enemigos, jefe, ítems, puntaje y niveles.

No dibuja la interfaz, no lee el teclado y no reproduce sonidos: recibe las
órdenes del jugador y devuelve eventos de sonido. Por eso se puede probar
sin ventana y se reinicia creando una Partida nueva.

Tiene su propio reloj (`tiempo`, en ms) que avanza solo cuando se la actualiza:
en la pausa se congela y no depende de los FPS de la computadora.
"""
import random

import reglas
from constantes import (
    SCREEN_WIDTH, SCREEN_HEIGHT, PASO_MS, DANO_COLISION,
    DANO_LASER_ENEMIGO, DANO_JEFE_CONTACTO, INVULNERABILIDAD_JEFE_MS,
    PUNTOS_POR_ENEMIGO, PUNTOS_JEFE, PROB_ITEM, ENERGIA_ITEM, NIVEL_JEFE_CADA,
    DURACION_AVISO_MS, PAUSA_TRAS_JEFE_MS, SPAWN_INICIAL_MS, VARIACION_SPAWN,
)
from elementos import ItemEnergia, Jefe
from explosion import Explosion
from personaje import Enemigo, Personaje

# Eventos de sonido que devuelve `actualizar` (coinciden con los nombres de Audio.EFECTOS)
EV_LASER = 'laser'
EV_EXPLOSION = 'explosion'
EV_GOLPE = 'golpe'
EV_NIVEL = 'nivel'
EV_ITEM = 'item'
EV_MUSICA_JEFE = 'musica_jefe'
EV_MUSICA_NORMAL = 'musica_normal'


class Partida:
    def __init__(self):
        self.personaje = Personaje(SCREEN_WIDTH // 2, SCREEN_HEIGHT - 150)
        self.enemigos = []
        self.lasers_enemigos = []
        self.items = []
        self.explosiones = []
        self.jefe = None
        self.jefes_generados = 0
        self.puntos = 0
        self.nivel = 1
        self.tiempo = 0.0
        self.terminada = False
        self.aviso = ''
        self.aviso_hasta = 0.0
        self._prox_spawn = SPAWN_INICIAL_MS
        self._contacto_jefe_hasta = 0.0
        self._sonidos = []

    # ------------------------------------------------------------ un paso
    def actualizar(self, dx=0, dy=0, disparando=False):
        """Avanza la partida un paso (1/60 s).

        dx, dy: dirección pedida (-1, 0 o 1). disparando: si se mantiene el disparo.
        Devuelve la lista de eventos de sonido ocurridos en este paso.
        """
        if self.terminada:
            return []
        self._sonidos = []
        self.tiempo += PASO_MS
        ahora = self.tiempo

        self._actualizar_nivel()
        self.personaje.dirigir(dx, dy)   # también se llama sin teclas, para que frene
        if disparando and self.personaje.lanzar_laser(ahora):
            self._sonidos.append(EV_LASER)
        self.personaje.actualizar()
        self._actualizar_enemigos(ahora)
        self._actualizar_lasers_enemigos()
        self._actualizar_items()
        self._actualizar_jefe(ahora)
        self._generar_enemigos()
        self.explosiones = [e for e in self.explosiones if e.actualizar()]
        return self._sonidos

    # ------------------------------------------------------ jugador y nivel
    def _avisar(self, texto):
        self.aviso = texto
        self.aviso_hasta = self.tiempo + DURACION_AVISO_MS

    def _actualizar_nivel(self):
        nivel = reglas.calcular_nivel(self.puntos)
        if nivel != self.nivel:
            self.nivel = nivel
            self._sonidos.append(EV_NIVEL)
            self._avisar(f"NIVEL {nivel}")
        if self.jefe is None and reglas.jefes_debidos(nivel) > self.jefes_generados:
            self.jefes_generados += 1
            self.jefe = Jefe(self.jefes_generados * NIVEL_JEFE_CADA)
            self._sonidos.append(EV_MUSICA_JEFE)
            self._avisar("¡APARECE UN JEFE!")

    def _explotar(self, centro):
        self.explosiones.append(Explosion(*centro))
        self._sonidos.append(EV_EXPLOSION)

    def _danar_jugador(self, cantidad):
        self._sonidos.append(EV_GOLPE)
        if not self.personaje.recibir_dano(cantidad):
            self.terminada = True

    # ------------------------------------------------------------- enemigos
    def _actualizar_enemigos(self, ahora):
        for enemigo in self.enemigos[:]:
            enemigo.mover()
            if enemigo.fuera_de_pantalla():
                self.enemigos.remove(enemigo)
                continue

            disparo = enemigo.disparar(ahora)
            if disparo:
                self.lasers_enemigos.append(disparo)

            impacto = next(
                (las for las in self.personaje.lasers if enemigo.rect.colliderect(las.rect)), None)
            if impacto:
                self.personaje.lasers.remove(impacto)
                self.enemigos.remove(enemigo)
                self._explotar(enemigo.rect.center)
                self.puntos += PUNTOS_POR_ENEMIGO
                if random.random() < PROB_ITEM:
                    self.items.append(ItemEnergia(*enemigo.rect.center))
                continue

            if enemigo.rect.colliderect(self.personaje.shape):
                # El enemigo se destruye al chocar; si no, dañaría en cada paso
                self.enemigos.remove(enemigo)
                self._explotar(enemigo.rect.center)
                self._danar_jugador(DANO_COLISION)

    def _actualizar_lasers_enemigos(self):
        for laser in self.lasers_enemigos[:]:
            laser.mover()
            if laser.fuera_de_pantalla():
                self.lasers_enemigos.remove(laser)
            elif laser.rect.colliderect(self.personaje.shape):
                self.lasers_enemigos.remove(laser)
                self._danar_jugador(DANO_LASER_ENEMIGO)

    def _actualizar_items(self):
        for item in self.items[:]:
            item.mover()
            if item.fuera_de_pantalla():
                self.items.remove(item)
            elif item.rect.colliderect(self.personaje.shape):
                self.items.remove(item)
                self.personaje.curar(ENERGIA_ITEM)
                self._sonidos.append(EV_ITEM)

    def _generar_enemigos(self):
        """Un enemigo cada cierto tiempo (no por azar en cada frame), con tope en pantalla."""
        if self.jefe is not None or self.tiempo < self._prox_spawn:
            return
        self._prox_spawn = self.tiempo + reglas.intervalo_spawn(self.nivel) * random.uniform(*VARIACION_SPAWN)
        if len(self.enemigos) >= reglas.max_enemigos(self.nivel):
            return
        dispara = random.random() < reglas.prob_disparador(self.nivel)
        enemigo = Enemigo(0, 0, reglas.velocidad_enemigo(self.nivel), dispara, ahora=self.tiempo)
        enemigo.rect.x = random.randint(0, SCREEN_WIDTH - enemigo.rect.width)   # entra completo
        self.enemigos.append(enemigo)

    # ----------------------------------------------------------------- jefe
    def _actualizar_jefe(self, ahora):
        jefe = self.jefe
        if jefe is None:
            return
        self.lasers_enemigos.extend(jefe.actualizar(ahora))

        for laser in self.personaje.lasers[:]:
            if jefe.rect.colliderect(laser.rect):
                self.personaje.lasers.remove(laser)
                jefe.recibir_golpe()

        if jefe.derrotado:
            r = jefe.rect
            for _ in range(6):
                self.explosiones.append(
                    Explosion(random.randint(r.left, r.right), random.randint(r.top, r.bottom)))
            self._sonidos.extend([EV_EXPLOSION, EV_MUSICA_NORMAL])
            self.puntos += PUNTOS_JEFE
            self.items.append(ItemEnergia(*r.center))
            self.lasers_enemigos.clear()
            self.jefe = None
            self._prox_spawn = self.tiempo + PAUSA_TRAS_JEFE_MS
        elif jefe.rect.colliderect(self.personaje.shape) and ahora >= self._contacto_jefe_hasta:
            self._contacto_jefe_hasta = ahora + INVULNERABILIDAD_JEFE_MS
            self._danar_jugador(DANO_JEFE_CONTACTO)

    # -------------------------------------------------------------- dibujo
    def dibujar(self, screen):
        for item in self.items:
            item.dibujar(screen)
        for enemigo in self.enemigos:
            enemigo.dibujar(screen)
        if self.jefe:
            self.jefe.dibujar(screen)
        self.personaje.dibujar(screen)
        for laser in self.lasers_enemigos:
            laser.dibujar(screen)
        for explosion in self.explosiones:
            explosion.dibujar(screen)

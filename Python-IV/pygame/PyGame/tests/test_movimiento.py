"""Pruebas del movimiento con inercia de la nave."""
import pygame
import pytest

from constantes import (
    VELOCIDAD_PERSONAJE, ACELERACION_PERSONAJE, FRENADO_PERSONAJE, INCLINACION_MAX, SCREEN_WIDTH,
)
from personaje import Personaje


def mover(nave, pasos, dx=0, dy=0):
    for _ in range(pasos):
        nave.dirigir(dx, dy)


def test_acelera_de_a_poco_hasta_la_velocidad_maxima():
    nave = Personaje(800, 500)
    nave.dirigir(1, 0)
    assert 0 < nave.vx <= ACELERACION_PERSONAJE + 1e-9      # no arranca de golpe
    mover(nave, 30, dx=1)
    assert nave.vx == pytest.approx(VELOCIDAD_PERSONAJE)
    mover(nave, 30, dx=1)
    assert nave.vx == pytest.approx(VELOCIDAD_PERSONAJE)    # y nunca la supera


def test_al_soltar_se_desliza_y_frena_de_a_poco():
    nave = Personaje(500, 500)
    mover(nave, 30, dx=1)
    x_soltar = nave.shape.x
    nave.dirigir(0, 0)
    assert 0 < nave.vx < VELOCIDAD_PERSONAJE                # sigue avanzando un poco
    pasos = 1
    while nave.vx > 0:
        nave.dirigir(0, 0)
        pasos += 1
        assert pasos < 100
    assert pasos == pytest.approx(VELOCIDAD_PERSONAJE / FRENADO_PERSONAJE, abs=2)
    assert nave.shape.x > x_soltar + 20                     # se deslizó
    quieta = nave.shape.x
    mover(nave, 10)
    assert nave.shape.x == quieta                           # y queda quieta, sin temblar


def test_cambiar_de_sentido_frena_mas_rapido_que_soltar():
    nave = Personaje(800, 500)
    mover(nave, 30, dx=1)
    pasos = 0
    while nave.vx > 0:
        nave.dirigir(-1, 0)
        pasos += 1
        assert pasos < 100
    assert pasos < VELOCIDAD_PERSONAJE / FRENADO_PERSONAJE
    mover(nave, 40, dx=-1)
    assert nave.vx == pytest.approx(-VELOCIDAD_PERSONAJE)


def test_diagonal_mantiene_la_velocidad_total():
    nave = Personaje(800, 500)
    mover(nave, 30, dx=1, dy=-1)
    assert (nave.vx ** 2 + nave.vy ** 2) ** 0.5 == pytest.approx(VELOCIDAD_PERSONAJE, abs=0.01)


def test_al_chocar_con_el_borde_pierde_la_velocidad():
    nave = Personaje(SCREEN_WIDTH - 60, 500)
    mover(nave, 60, dx=1)
    assert nave.shape.right == SCREEN_WIDTH
    assert nave.vx == 0                                     # no queda "empujando" la pared
    for _ in range(3):
        nave.dirigir(-1, 0)
    assert nave.shape.right < SCREEN_WIDTH                  # y puede salir enseguida


def test_se_inclina_hacia_donde_gira_y_vuelve_a_enderezarse():
    nave = Personaje(800, 500)
    mover(nave, 40, dx=1)
    assert -INCLINACION_MAX <= nave.angulo < -INCLINACION_MAX * 0.8      # derecha: horario
    mover(nave, 120, dx=-1)
    assert INCLINACION_MAX * 0.8 < nave.angulo <= INCLINACION_MAX         # izquierda: antihorario
    mover(nave, 120)
    assert abs(nave.angulo) < 0.5


def test_dibujar_inclinada_y_con_llama_no_falla():
    pantalla = pygame.Surface((1700, 1000))
    nave = Personaje(800, 500)
    mover(nave, 40, dx=1, dy=-1)
    nave.dibujar(pantalla)
    mover(nave, 40, dx=-1, dy=1)
    nave.dibujar(pantalla)
    assert len(nave._inclinadas) >= 1                       # reutiliza las imágenes rotadas

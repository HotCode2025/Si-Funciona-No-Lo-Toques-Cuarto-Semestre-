import pytest

import reglas
from constantes import (
    PUNTOS_POR_NIVEL, VELOCIDAD_ENEMIGO_MAX, VELOCIDAD_PERSONAJE, VELOCIDAD_LASER,
    INTERVALO_SPAWN_MIN_MS, MAX_ENEMIGOS_TOPE, PROB_DISPARADOR_MAX, VELOCIDAD_JEFE_MAX,
)

NIVELES = range(1, 61)


def test_nivel_segun_puntos():
    assert reglas.calcular_nivel(0) == 1
    assert reglas.calcular_nivel(PUNTOS_POR_NIVEL - 1) == 1
    assert reglas.calcular_nivel(PUNTOS_POR_NIVEL) == 2
    assert reglas.calcular_nivel(-50) == 1


def test_la_velocidad_enemiga_nunca_baja_y_tiene_tope():
    velocidades = [reglas.velocidad_enemigo(n) for n in NIVELES]
    assert velocidades == sorted(velocidades)
    assert max(velocidades) == VELOCIDAD_ENEMIGO_MAX


def test_los_enemigos_nunca_superan_al_laser_ni_doblan_al_jugador():
    assert VELOCIDAD_ENEMIGO_MAX <= VELOCIDAD_LASER
    assert VELOCIDAD_ENEMIGO_MAX <= VELOCIDAD_PERSONAJE * 2


def test_aparicion_mas_frecuente_con_el_nivel_pero_con_limites():
    intervalos = [reglas.intervalo_spawn(n) for n in NIVELES]
    assert intervalos == sorted(intervalos, reverse=True)
    assert min(intervalos) == INTERVALO_SPAWN_MIN_MS
    cantidades = [reglas.max_enemigos(n) for n in NIVELES]
    assert cantidades == sorted(cantidades)
    assert max(cantidades) == MAX_ENEMIGOS_TOPE


def test_los_disparadores_empiezan_en_el_nivel_2():
    assert reglas.prob_disparador(1) == 0.0
    assert 0 < reglas.prob_disparador(2) < reglas.prob_disparador(5)
    assert max(reglas.prob_disparador(n) for n in NIVELES) == PROB_DISPARADOR_MAX


@pytest.mark.parametrize("nivel, esperados", [(1, 0), (2, 0), (3, 1), (5, 1), (6, 2), (9, 3), (20, 6)])
def test_jefes_debidos(nivel, esperados):
    assert reglas.jefes_debidos(nivel) == esperados


def test_jefe_mas_fuerte_cada_vez_con_topes():
    assert reglas.vida_jefe(6) > reglas.vida_jefe(3)
    assert reglas.intervalo_disparo_jefe(30) >= 600
    assert reglas.velocidad_jefe(300) == VELOCIDAD_JEFE_MAX

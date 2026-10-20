"""Pruebas de la lógica del juego, sin ventana ni teclado."""
import random

import pytest

import reglas
from constantes import (
    PASO_MS, VELOCIDAD_PERSONAJE, ENERGIA_MAXIMA, COOLDOWN_LASER_MS, PUNTOS_POR_NIVEL,
    PUNTOS_POR_ENEMIGO, PUNTOS_JEFE, ENERGIA_ITEM, DANO_COLISION, DANO_LASER_ENEMIGO,
)
from elementos import ItemEnergia, LaserEnemigo
from partida import Partida, EV_LASER, EV_NIVEL, EV_MUSICA_JEFE, EV_MUSICA_NORMAL, EV_GOLPE
from personaje import Enemigo, Laser


def correr(partida, pasos, **orden):
    """Avanza `pasos` y devuelve todos los sonidos. Mantiene viva la nave."""
    sonidos = []
    for _ in range(pasos):
        partida.personaje.energia = ENERGIA_MAXIMA
        sonidos += partida.actualizar(**orden)
    return sonidos


@pytest.fixture(autouse=True)
def azar_fijo():
    random.seed(12345)


def test_el_reloj_avanza_un_paso_fijo_por_actualizacion():
    p = Partida()
    p.actualizar()
    p.actualizar()
    assert p.tiempo == pytest.approx(2 * PASO_MS)


def test_diagonal_no_es_mas_rapida_que_recta():
    recta, diagonal = Partida(), Partida()
    for _ in range(25):                     # calentamiento: llegan a la velocidad de crucero
        recta.actualizar(dx=1)
        diagonal.actualizar(dx=1, dy=-1)
    r0, d0 = recta.personaje.shape.center, diagonal.personaje.shape.center
    for _ in range(30):
        recta.actualizar(dx=1)
        diagonal.actualizar(dx=1, dy=-1)
    r1, d1 = recta.personaje.shape.center, diagonal.personaje.shape.center
    v_recta = ((r1[0] - r0[0]) ** 2 + (r1[1] - r0[1]) ** 2) ** 0.5 / 30
    v_diag = ((d1[0] - d0[0]) ** 2 + (d1[1] - d0[1]) ** 2) ** 0.5 / 30
    assert v_recta == pytest.approx(VELOCIDAD_PERSONAJE, abs=0.3)
    assert v_diag == pytest.approx(v_recta, abs=0.3)


def test_cadencia_de_disparo_independiente_de_los_fps():
    p = Partida()
    disparos = correr(p, 60, disparando=True).count(EV_LASER)   # 1 segundo
    assert disparos == pytest.approx(1000 / COOLDOWN_LASER_MS, abs=1)


def test_aparecen_enemigos_pero_nunca_mas_del_tope():
    p = Partida()
    maximo = 0
    for _ in range(60 * 40):   # 40 segundos sin disparar
        correr(p, 1)
        maximo = max(maximo, len(p.enemigos))
    assert maximo > 0
    assert maximo <= reglas.max_enemigos(p.nivel)


def test_los_enemigos_nuevos_usan_la_velocidad_de_su_nivel():
    p = Partida()
    p.puntos = PUNTOS_POR_NIVEL * 3        # nivel 4
    p.nivel = 4
    p.jefes_generados = 1                  # sin jefe pendiente
    correr(p, 60 * 5)
    assert p.enemigos
    assert all(e.velocidad == reglas.velocidad_enemigo(4) for e in p.enemigos)


def test_subir_de_nivel_avisa_y_suena():
    p = Partida()
    p.puntos = PUNTOS_POR_NIVEL
    sonidos = correr(p, 1)
    assert p.nivel == 2 and EV_NIVEL in sonidos
    assert "NIVEL 2" in p.aviso


def test_el_jefe_aparece_en_el_nivel_3_y_frena_a_los_enemigos_comunes():
    p = Partida()
    p.puntos = PUNTOS_POR_NIVEL * 2
    sonidos = correr(p, 1)
    assert p.jefe is not None and EV_MUSICA_JEFE in sonidos
    correr(p, 60 * 10)
    assert p.enemigos == [] or all(e.rect.y > 0 for e in p.enemigos)
    cantidad = len(p.enemigos)
    correr(p, 60 * 5)
    assert len(p.enemigos) <= cantidad


def test_nunca_se_saltea_un_jefe_aunque_los_puntos_salten_de_nivel():
    p = Partida()
    p.puntos = PUNTOS_POR_NIVEL * 6        # nivel 7: corresponden 2 jefes
    correr(p, 1)
    assert p.jefes_generados == 1
    p.jefe.vida = 0
    sonidos = correr(p, 1)                 # el primero muere
    assert p.jefe is None and EV_MUSICA_NORMAL in sonidos
    assert p.puntos >= PUNTOS_POR_NIVEL * 6 + PUNTOS_JEFE
    correr(p, 1)                           # enseguida llega el segundo
    assert p.jefes_generados == 2 and p.jefe is not None
    p.jefe.vida = 0
    correr(p, 2)
    correr(p, 60 * 5)
    assert p.jefes_generados == 2 and p.jefe is None


def test_choque_con_enemigo_resta_una_sola_vez():
    p = Partida()
    enemigo = Enemigo(0, 0, 0)
    enemigo.rect.center = p.personaje.shape.center
    p.enemigos.append(enemigo)
    sonidos = p.actualizar()
    assert p.personaje.energia == ENERGIA_MAXIMA - DANO_COLISION
    assert enemigo not in p.enemigos and EV_GOLPE in sonidos
    p.actualizar()
    assert p.personaje.energia == ENERGIA_MAXIMA - DANO_COLISION


def test_laser_destruye_enemigo_y_suma_puntos():
    p = Partida()
    enemigo = Enemigo(300, 300, 0)
    laser = Laser(*enemigo.rect.center)
    p.enemigos.append(enemigo)
    p.personaje.lasers.append(laser)
    p.actualizar()
    assert enemigo not in p.enemigos and laser not in p.personaje.lasers
    assert p.puntos == PUNTOS_POR_ENEMIGO


def test_laser_enemigo_daña_al_jugador():
    p = Partida()
    laser = LaserEnemigo(*p.personaje.shape.center)
    p.lasers_enemigos.append(laser)
    p.actualizar()
    assert p.personaje.energia == ENERGIA_MAXIMA - DANO_LASER_ENEMIGO
    assert laser not in p.lasers_enemigos


def test_item_recupera_energia():
    p = Partida()
    p.personaje.energia = 50
    p.items.append(ItemEnergia(*p.personaje.shape.center))
    p.actualizar()
    assert p.personaje.energia == 50 + ENERGIA_ITEM


def test_sin_energia_la_partida_termina_y_se_congela():
    p = Partida()
    p.personaje.energia = DANO_COLISION
    enemigo = Enemigo(0, 0, 0)
    enemigo.rect.center = p.personaje.shape.center
    p.enemigos.append(enemigo)
    p.actualizar()
    assert p.terminada
    tiempo = p.tiempo
    assert p.actualizar() == []
    assert p.tiempo == tiempo

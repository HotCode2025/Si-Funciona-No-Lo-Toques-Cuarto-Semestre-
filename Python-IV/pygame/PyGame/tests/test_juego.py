"""Pruebas del controlador: menú, pausa, game over y reinicio (sin ventana)."""
import pygame
import pytest

import juego as modulo_juego
from constantes import PASO_MS, MAX_PASOS_POR_FRAME, ENERGIA_MAXIMA, DANO_COLISION
from juego import Juego, MENU, JUGANDO, PAUSA, GAME_OVER
from personaje import Enemigo


class TeclasFalsas:
    def __init__(self, pulsadas=()):
        self.pulsadas = set(pulsadas)

    def __getitem__(self, tecla):
        return tecla in self.pulsadas


def tecla(codigo):
    return pygame.event.Event(pygame.KEYDOWN, key=codigo)


def clic(pos):
    return pygame.event.Event(pygame.MOUSEBUTTONDOWN, pos=pos, button=1)


@pytest.fixture
def juego(monkeypatch):
    guardados = []
    monkeypatch.setattr(modulo_juego, 'guardar_record', guardados.append)
    monkeypatch.setattr(modulo_juego, 'cargar_record', lambda: 0)
    monkeypatch.setattr(pygame.key, 'get_pressed',
                        lambda: TeclasFalsas({pygame.K_LEFT, pygame.K_UP}))
    j = Juego()
    j.guardados = guardados
    return j


def jugar(juego, pasos):
    for _ in range(pasos):
        if juego.estado == JUGANDO:
            juego.partida.personaje.energia = ENERGIA_MAXIMA
        juego._actualizar()
        juego._dibujar()


def chocar_hasta_morir(juego):
    juego.partida.personaje.energia = DANO_COLISION
    enemigo = Enemigo(0, 0, 0)
    enemigo.rect.center = juego.partida.personaje.shape.center
    juego.partida.enemigos.append(enemigo)
    juego._actualizar()


def test_pasos_de_logica_no_dependen_de_los_fps(juego):
    assert juego._pasos(0) == 0
    assert juego._pasos(16) == 1                   # 60 FPS: un paso por cuadro
    assert juego._pasos(17) == 1
    assert juego._pasos(33) == 2                   # 30 FPS: dos pasos por cuadro
    assert juego._pasos(10_000) == MAX_PASOS_POR_FRAME   # tras una demora larga no se dispara
    total = sum(juego._pasos(16.667) for _ in range(600))
    assert total == pytest.approx(600, abs=2)      # 10 s a 60 FPS = 600 pasos


def test_menu_con_teclado_y_mouse(juego):
    assert juego.estado == MENU
    juego._procesar_eventos([tecla(pygame.K_DOWN)])
    assert juego.lista_menu.opcion == 1
    juego._procesar_eventos([tecla(pygame.K_UP), tecla(pygame.K_RETURN)])
    assert juego.estado == JUGANDO

    juego._volver_al_menu()
    juego._procesar_eventos([clic(juego.lista_menu.botones[0].rect.center)])
    assert juego.estado == JUGANDO


def test_partida_larga_con_jefe_sin_errores(juego):
    juego._iniciar_partida()
    jugar(juego, 600)
    juego.partida.puntos = 500
    jugar(juego, 2000)
    assert juego.partida.jefe is not None or juego.partida.jefes_generados == 1


def test_tecla_r_reinicia_y_guarda_el_record(juego):
    juego._iniciar_partida()
    anterior = juego.partida
    anterior.puntos = 120
    juego._procesar_eventos([tecla(pygame.K_r)])
    assert juego.estado == JUGANDO and juego.partida is not anterior
    assert juego.partida.puntos == 0 and juego.partida.tiempo == 0
    assert juego.record == 120 and juego.guardados == [120]


def test_boton_reiniciar_del_hud_con_el_mouse(juego):
    juego._iniciar_partida()
    anterior = juego.partida
    anterior.puntos = 40
    juego._procesar_eventos([clic((5, 600))])               # clic fuera del botón: no pasa nada
    assert juego.partida is anterior
    juego._procesar_eventos([clic(juego.btn_reiniciar.rect.center)])
    assert juego.partida is not anterior and juego.estado == JUGANDO


def test_pausa_congela_el_tiempo_y_ofrece_botones(juego):
    juego._iniciar_partida()
    jugar(juego, 30)
    juego._procesar_eventos([tecla(pygame.K_p)])
    assert juego.estado == PAUSA
    tiempo = juego.partida.tiempo
    jugar(juego, 120)                                       # dibuja la pausa; la lógica no avanza
    assert juego.partida.tiempo == tiempo

    juego._procesar_eventos([clic(juego.lista_pausa.botones[0].rect.center)])   # CONTINUAR
    assert juego.estado == JUGANDO and juego.partida.tiempo == tiempo
    juego._procesar_eventos([tecla(pygame.K_ESCAPE)])
    anterior = juego.partida
    juego._procesar_eventos([clic(juego.lista_pausa.botones[1].rect.center)])   # REINICIAR
    assert juego.estado == JUGANDO and juego.partida is not anterior
    juego._pausar()
    juego._procesar_eventos([clic(juego.lista_pausa.botones[2].rect.center)])   # MENÚ
    assert juego.estado == MENU


def test_perder_el_foco_de_la_ventana_pausa(juego):
    juego._iniciar_partida()
    juego._procesar_eventos([pygame.event.Event(pygame.WINDOWFOCUSLOST)])
    assert juego.estado == PAUSA


def test_game_over_record_y_botones(juego):
    juego._iniciar_partida()
    juego.partida.puntos = 200
    chocar_hasta_morir(juego)
    assert juego.estado == GAME_OVER
    assert juego.nuevo_record and juego.record == 200
    jugar(juego, 3)                                         # dibuja la pantalla de game over

    anterior = juego.partida
    juego._procesar_eventos([tecla(pygame.K_RETURN)])        # opción 0: JUGAR DE NUEVO
    assert juego.estado == JUGANDO and juego.partida is not anterior and not juego.nuevo_record

    juego.estado = GAME_OVER
    juego._procesar_eventos([clic(juego.lista_game_over.botones[1].rect.center)])   # MENÚ
    assert juego.estado == MENU


def test_game_over_sin_record(juego):
    juego.record = 999
    juego._iniciar_partida()
    juego.partida.puntos = 10
    chocar_hasta_morir(juego)
    assert juego.estado == GAME_OVER and not juego.nuevo_record
    assert juego.record == 999 and juego.guardados == []
    jugar(juego, 3)


def test_dibujar_todos_los_estados_sin_errores(juego):
    for estado in (MENU, JUGANDO, PAUSA, GAME_OVER):
        juego.estado = estado
        juego.snapshot = None
        juego._dibujar()
    assert PASO_MS > 0

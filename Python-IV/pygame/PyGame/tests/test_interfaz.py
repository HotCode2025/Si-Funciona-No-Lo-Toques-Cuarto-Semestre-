import pygame

from interfaz import Boton, ListaBotones


def clic(pos, boton=1):
    return pygame.event.Event(pygame.MOUSEBUTTONDOWN, pos=pos, button=boton)


def tecla(codigo):
    return pygame.event.Event(pygame.KEYDOWN, key=codigo)


def test_boton_responde_solo_al_clic_izquierdo_dentro():
    b = Boton("OK", (100, 100, 200, 50), pygame.font.Font(None, 30))
    assert b.clic(clic((150, 120)))
    assert not b.clic(clic((10, 10)))
    assert not b.clic(clic((150, 120), boton=3))


def test_lista_navega_con_flechas_y_confirma_con_enter():
    lista = ListaBotones(("A", "B", "C"), pygame.font.Font(None, 30), 500, 300)
    assert lista.procesar([tecla(pygame.K_DOWN)]) is None and lista.opcion == 1
    assert lista.procesar([tecla(pygame.K_UP), tecla(pygame.K_UP)]) is None and lista.opcion == 2   # da la vuelta
    assert lista.procesar([tecla(pygame.K_RETURN)]) == 2


def test_lista_con_mouse():
    lista = ListaBotones(("A", "B", "C"), pygame.font.Font(None, 30), 500, 300)
    destino = lista.botones[1].rect.center
    lista.procesar([pygame.event.Event(pygame.MOUSEMOTION, pos=destino, rel=(0, 0), buttons=(0, 0, 0))])
    assert lista.opcion == 1
    assert lista.procesar([clic(lista.botones[2].rect.center)]) == 2
    assert lista.procesar([clic((0, 0))]) is None

import pygame
import pytest

from ajustes import cargar_ajustes, guardar_ajustes
from audio import Audio, MEZCLA_MUSICA, MEZCLA_EFECTOS
from constantes import VOLUMEN_INICIAL
from interfaz import Slider


@pytest.fixture
def audio():
    return Audio(volumen=0.5)


def test_el_volumen_se_limita_entre_0_y_1(audio):
    audio.set_volumen(7)
    assert audio.volumen == 1.0
    audio.set_volumen(-3)
    assert audio.volumen == 0.0


def test_el_volumen_general_llega_a_la_musica_y_a_los_efectos(audio):
    if not audio.activo:
        pytest.skip("sin dispositivo de audio")
    audio.set_volumen(0.5)
    assert pygame.mixer.music.get_volume() == pytest.approx(0.5 * MEZCLA_MUSICA, abs=0.02)
    efecto = audio._sonidos['golpe']
    if hasattr(efecto, 'get_volume'):
        assert efecto.get_volume() == pytest.approx(0.5 * MEZCLA_EFECTOS['golpe'], abs=0.02)


def test_silenciar_y_volver(audio):
    audio.alternar_silencio()
    assert audio.silenciado and audio.efectivo == 0.0
    audio.alternar_silencio()
    assert not audio.silenciado and audio.efectivo == 0.5


def test_subir_el_volumen_saca_el_silencio(audio):
    audio.alternar_silencio()
    audio.set_volumen(0.6)
    assert not audio.silenciado and audio.efectivo == 0.6


def test_ajustes_se_guardan_y_se_leen(tmp_path):
    ruta = tmp_path / 'ajustes.json'
    guardar_ajustes(0.35, True, ruta)
    assert cargar_ajustes(ruta) == {'volumen': 0.35, 'silenciado': True}


def test_ajustes_rotos_o_inexistentes_usan_valores_por_defecto(tmp_path):
    por_defecto = {'volumen': VOLUMEN_INICIAL, 'silenciado': False}
    assert cargar_ajustes(tmp_path / 'no_existe.json') == por_defecto
    roto = tmp_path / 'roto.json'
    roto.write_text('{{{')
    assert cargar_ajustes(roto) == por_defecto
    raro = tmp_path / 'raro.json'
    raro.write_text('{"volumen": 99}')
    assert cargar_ajustes(raro)['volumen'] == 1.0


def evento(tipo, **datos):
    return pygame.event.Event(tipo, **datos)


def test_slider_se_arrastra_con_el_mouse():
    s = Slider("VOLUMEN", (100, 100, 200, 28), pygame.font.Font(None, 28), 0.5)
    assert s.procesar([evento(pygame.MOUSEBUTTONDOWN, pos=(200, 110), button=1)]) == (True, False)
    assert s.valor == 0.5 and s.arrastrando
    assert s.procesar([evento(pygame.MOUSEMOTION, pos=(260, 300), rel=(0, 0), buttons=(1, 0, 0))]) == (True, False)
    assert s.valor == 0.8                                    # sigue el mouse aunque se salga del carril
    assert s.procesar([evento(pygame.MOUSEBUTTONUP, pos=(260, 300), button=1)]) == (False, True)
    assert not s.arrastrando
    assert s.procesar([evento(pygame.MOUSEMOTION, pos=(110, 110), rel=(0, 0), buttons=(0, 0, 0))]) == (False, False)
    s.procesar([evento(pygame.MOUSEBUTTONDOWN, pos=(0, 0), button=1)])
    assert s.valor == 0.8                                    # clic fuera: no hace nada


def test_slider_limites():
    s = Slider("V", (100, 100, 200, 28), pygame.font.Font(None, 28), 0.5)
    s.procesar([evento(pygame.MOUSEBUTTONDOWN, pos=(100, 110), button=1)])
    s.procesar([evento(pygame.MOUSEMOTION, pos=(-500, 110), rel=(0, 0), buttons=(1, 0, 0))])
    assert s.valor == 0.0
    s.procesar([evento(pygame.MOUSEMOTION, pos=(9000, 110), rel=(0, 0), buttons=(1, 0, 0))])
    assert s.valor == 1.0

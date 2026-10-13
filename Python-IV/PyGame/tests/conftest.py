import os

# Modo sin ventana ni placa de sonido: permite correr los tests en GitHub Actions
os.environ.setdefault('SDL_VIDEODRIVER', 'dummy')
os.environ.setdefault('SDL_AUDIODRIVER', 'dummy')

import pygame  # noqa: E402
import pytest  # noqa: E402


@pytest.fixture(scope='session', autouse=True)
def pygame_sin_ventana():
    pygame.init()
    pygame.display.set_mode((1, 1))
    yield
    pygame.quit()

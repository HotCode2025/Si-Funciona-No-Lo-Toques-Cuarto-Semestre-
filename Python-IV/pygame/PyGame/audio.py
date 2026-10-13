"""Manejo de sonidos y música. Si falta un archivo o no hay placa de sonido, el juego sigue en silencio."""
import os

import pygame

from constantes import SOUNDS_PATH


class _Silencio:
    def play(self, *args, **kwargs):
        pass


class Audio:
    EFECTOS = {
        'laser': 'laserdis.mp3',
        'explosion': 'explosion.mp3',
        'golpe': 'golpe.wav',
        'nivel': 'nivel.wav',
        'item': 'item.wav',
    }

    def __init__(self):
        self.activo = pygame.mixer.get_init() is not None
        self._sonidos = {}
        self._musica_actual = None
        if self.activo:
            for clave, archivo in self.EFECTOS.items():
                self._sonidos[clave] = self._cargar(archivo)

    @staticmethod
    def _cargar(archivo):
        ruta = os.path.join(SOUNDS_PATH, archivo)
        try:
            return pygame.mixer.Sound(ruta)
        except (pygame.error, FileNotFoundError):
            print(f"[aviso] No se pudo cargar el sonido: {ruta}")
            return _Silencio()

    def efecto(self, nombre):
        self._sonidos.get(nombre, _Silencio()).play()

    def musica(self, archivo, repeticiones=-1):
        """Reproduce una música. Si ya es la que suena, no la reinicia."""
        if not self.activo or self._musica_actual == archivo:
            return
        ruta = os.path.join(SOUNDS_PATH, archivo)
        try:
            pygame.mixer.music.load(ruta)
            pygame.mixer.music.play(repeticiones)
            self._musica_actual = archivo
        except (pygame.error, FileNotFoundError):
            print(f"[aviso] No se pudo reproducir la música: {ruta}")
            self._musica_actual = None

    def pausar(self):
        if self.activo:
            pygame.mixer.music.pause()

    def reanudar(self):
        if self.activo:
            pygame.mixer.music.unpause()

"""Sonidos y música con volumen general. Si falta un archivo o no hay placa de sonido, el juego sigue en silencio."""
import os

import pygame

from constantes import SOUNDS_PATH, VOLUMEN_INICIAL

# Mezcla: volumen relativo de cada sonido (el volumen general se multiplica por esto)
MEZCLA_EFECTOS = {'laser': 0.45, 'explosion': 0.8, 'golpe': 0.9, 'nivel': 0.8, 'item': 0.8}
MEZCLA_MUSICA = 0.6


class _Silencio:
    def play(self, *args, **kwargs):
        pass

    def set_volume(self, valor):
        pass


class Audio:
    EFECTOS = {
        'laser': 'laserdis.mp3',
        'explosion': 'explosion.mp3',
        'golpe': 'golpe.wav',
        'nivel': 'nivel.wav',
        'item': 'item.wav',
    }

    def __init__(self, volumen=VOLUMEN_INICIAL, silenciado=False):
        self.volumen = min(1.0, max(0.0, volumen))
        self.silenciado = silenciado
        self.activo = pygame.mixer.get_init() is not None
        self._sonidos = {}
        self._musica_actual = None
        if self.activo:
            for clave, archivo in self.EFECTOS.items():
                self._sonidos[clave] = self._cargar(archivo)
        self._aplicar_volumen()

    @staticmethod
    def _cargar(archivo):
        ruta = os.path.join(SOUNDS_PATH, archivo)
        try:
            return pygame.mixer.Sound(ruta)
        except (pygame.error, FileNotFoundError):
            print(f"[aviso] No se pudo cargar el sonido: {ruta}")
            return _Silencio()

    # --------------------------------------------------------------- volumen
    @property
    def efectivo(self):
        """Volumen que realmente suena (0 si está silenciado)."""
        return 0.0 if self.silenciado else self.volumen

    def set_volumen(self, valor):
        """Cambia el volumen general (0.0 a 1.0). Subirlo saca el silencio."""
        self.volumen = round(min(1.0, max(0.0, valor)), 2)
        if self.volumen > 0:
            self.silenciado = False
        self._aplicar_volumen()

    def alternar_silencio(self):
        self.silenciado = not self.silenciado
        self._aplicar_volumen()

    def _aplicar_volumen(self):
        if not self.activo:
            return
        for clave, sonido in self._sonidos.items():
            sonido.set_volume(self.efectivo * MEZCLA_EFECTOS.get(clave, 1.0))
        pygame.mixer.music.set_volume(self.efectivo * MEZCLA_MUSICA)

    # ------------------------------------------------------------ reproducción
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
            self._aplicar_volumen()
        except (pygame.error, FileNotFoundError):
            print(f"[aviso] No se pudo reproducir la música: {ruta}")
            self._musica_actual = None

    def pausar(self):
        if self.activo:
            pygame.mixer.music.pause()

    def reanudar(self):
        if self.activo:
            pygame.mixer.music.unpause()

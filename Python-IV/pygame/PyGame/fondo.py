import pygame

from constantes import SCREEN_HEIGHT, FONDO_VELOCIDAD


class Fondo:
    """Fondo con scroll vertical infinito.

    Cada imagen se une con su copia espejada verticalmente, así el borde
    inferior coincide con el superior y no se ve el corte al repetirse.
    """

    def __init__(self, imagenes, velocidad=FONDO_VELOCIDAD):
        self._tiles = [self._crear_tile(img) for img in imagenes]
        self._alto = SCREEN_HEIGHT * 2
        self.velocidad = velocidad
        self.indice = 0
        self.y = 0.0

    @staticmethod
    def _crear_tile(imagen):
        ancho, alto = imagen.get_size()
        tile = pygame.Surface((ancho, alto * 2))
        tile.blit(imagen, (0, 0))
        tile.blit(pygame.transform.flip(imagen, False, True), (0, alto))
        return tile

    def cambiar(self, indice):
        self.indice = indice % len(self._tiles)

    def actualizar(self):
        self.y = (self.y + self.velocidad) % self._alto

    def dibujar(self, screen):
        tile = self._tiles[self.indice]
        y = int(self.y)
        screen.blit(tile, (0, y - self._alto))
        screen.blit(tile, (0, y))

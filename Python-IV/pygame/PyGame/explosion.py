from constantes import FRAMES_POR_IMAGEN_EXPLOSION
from utilidades import cargar_imagen

CANTIDAD_IMAGENES = 9


class Explosion:
    def __init__(self, x, y):
        self.images = [
            cargar_imagen(f'regularExplosion0{i:02d}.png')
            for i in range(CANTIDAD_IMAGENES)
        ]
        self.index = 0
        self.image = self.images[0]
        self.rect = self.image.get_rect(center=(x, y))
        self.contador = 0

    def actualizar(self):
        """Avanza la animación. Devuelve False cuando terminó."""
        self.contador += 1
        if self.contador >= FRAMES_POR_IMAGEN_EXPLOSION:
            self.contador = 0
            self.index += 1
            if self.index >= len(self.images):
                return False
            self.image = self.images[self.index]
        return True

    def dibujar(self, screen):
        screen.blit(self.image, self.rect)

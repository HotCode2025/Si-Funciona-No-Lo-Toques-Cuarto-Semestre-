"""Elementos de interfaz reutilizables: texto centrado, botones y listas de botones."""
import pygame

from constantes import (
    SCREEN_WIDTH, COLOR_BLANCO, COLOR_GRIS, COLOR_AMARILLO, COLOR_BOTON,
)


def texto_centrado(screen, fuente, texto, color, y, centro_x=SCREEN_WIDTH // 2):
    superficie = fuente.render(texto, True, color)
    rect = superficie.get_rect(center=(centro_x, y))
    screen.blit(superficie, rect)
    return rect


class Boton:
    """Botón rectangular que se acciona con el clic izquierdo del mouse."""

    def __init__(self, texto, rect, fuente):
        self.texto = texto
        self.rect = pygame.Rect(rect)
        self.fuente = fuente

    def clic(self, evento):
        return (evento.type == pygame.MOUSEBUTTONDOWN and evento.button == 1
                and self.rect.collidepoint(evento.pos))

    def dibujar(self, screen, resaltado=None):
        """`resaltado=None` significa: resaltar si el mouse está encima."""
        if resaltado is None:
            resaltado = self.rect.collidepoint(pygame.mouse.get_pos())
        color = COLOR_AMARILLO if resaltado else COLOR_GRIS
        pygame.draw.rect(screen, COLOR_BOTON, self.rect, border_radius=10)
        pygame.draw.rect(screen, color, self.rect, width=3, border_radius=10)
        texto = COLOR_AMARILLO if resaltado else COLOR_BLANCO
        texto_centrado(screen, self.fuente, self.texto, texto, self.rect.centery, self.rect.centerx)


class ListaBotones:
    """Lista vertical de botones. Se maneja con flechas + ENTER o con el mouse."""

    def __init__(self, etiquetas, fuente, centro_x, y_inicial, separacion=80, ancho=520, alto=64):
        self.botones = [
            Boton(etiqueta, (centro_x - ancho // 2, y_inicial - alto // 2 + i * separacion, ancho, alto), fuente)
            for i, etiqueta in enumerate(etiquetas)
        ]
        self.opcion = 0

    def reiniciar(self):
        self.opcion = 0

    def procesar(self, eventos):
        """Devuelve el índice del botón elegido en este frame, o None."""
        for evento in eventos:
            if evento.type == pygame.KEYDOWN:
                if evento.key == pygame.K_UP:
                    self.opcion = (self.opcion - 1) % len(self.botones)
                elif evento.key == pygame.K_DOWN:
                    self.opcion = (self.opcion + 1) % len(self.botones)
                elif evento.key in (pygame.K_RETURN, pygame.K_KP_ENTER):
                    return self.opcion
            elif evento.type == pygame.MOUSEMOTION:
                for i, boton in enumerate(self.botones):
                    if boton.rect.collidepoint(evento.pos):
                        self.opcion = i
            elif evento.type == pygame.MOUSEBUTTONDOWN and evento.button == 1:
                for i, boton in enumerate(self.botones):
                    if boton.clic(evento):
                        self.opcion = i
                        return i
        return None

    def dibujar(self, screen):
        for i, boton in enumerate(self.botones):
            boton.dibujar(screen, resaltado=(i == self.opcion))

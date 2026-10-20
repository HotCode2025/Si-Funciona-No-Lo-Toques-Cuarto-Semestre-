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


class Slider:
    """Deslizador horizontal (0.0 a 1.0) que se arrastra con el mouse."""

    def __init__(self, etiqueta, rect, fuente, valor=1.0):
        self.etiqueta = etiqueta
        self.rect = pygame.Rect(rect)
        self.fuente = fuente
        self.valor = valor
        self.arrastrando = False

    def _desde_x(self, x):
        self.valor = round(min(1.0, max(0.0, (x - self.rect.left) / self.rect.width)), 2)

    def procesar(self, eventos):
        """Devuelve (cambio, solto): si el valor cambió y si se terminó de arrastrar."""
        cambio = solto = False
        for evento in eventos:
            if evento.type == pygame.MOUSEBUTTONDOWN and evento.button == 1 and self.rect.collidepoint(evento.pos):
                self.arrastrando = True
                self._desde_x(evento.pos[0])
                cambio = True
            elif evento.type == pygame.MOUSEMOTION and self.arrastrando:
                anterior = self.valor
                self._desde_x(evento.pos[0])
                cambio = cambio or self.valor != anterior
            elif evento.type == pygame.MOUSEBUTTONUP and evento.button == 1 and self.arrastrando:
                self.arrastrando = False
                solto = True
        return cambio, solto

    def dibujar(self, screen, silenciado=False):
        color = COLOR_GRIS if silenciado else COLOR_AMARILLO
        y = self.rect.centery
        etiqueta = self.fuente.render(self.etiqueta, True, COLOR_BLANCO)
        screen.blit(etiqueta, etiqueta.get_rect(midright=(self.rect.left - 16, y)))
        pista = pygame.Rect(self.rect.left, y - 4, self.rect.width, 8)
        pygame.draw.rect(screen, COLOR_BOTON, pista, border_radius=4)
        pygame.draw.rect(screen, COLOR_GRIS, pista, width=1, border_radius=4)
        relleno = pista.copy()
        relleno.width = int(pista.width * self.valor)
        if relleno.width:
            pygame.draw.rect(screen, color, relleno, border_radius=4)
        pygame.draw.circle(screen, COLOR_BLANCO, (pista.left + relleno.width, y), 11)
        pygame.draw.circle(screen, color, (pista.left + relleno.width, y), 11, 3)
        porcentaje = "Silencio" if silenciado else f"{round(self.valor * 100)}%"
        texto = self.fuente.render(porcentaje, True, color)
        screen.blit(texto, texto.get_rect(midleft=(self.rect.right + 16, y)))

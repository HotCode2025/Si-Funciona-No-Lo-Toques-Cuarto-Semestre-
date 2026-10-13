"""Pantallas bloqueantes: imagen inicial, logo y prólogo estilo Star Wars."""
import pygame

from constantes import (
    SCREEN_WIDTH, SCREEN_HEIGHT, FPS, COLOR_NEGRO, COLOR_AMARILLO, COLOR_GRIS,
    COLOR_LOGO_FONDO,
)
from interfaz import texto_centrado
from utilidades import salir

TEXTO_PROLOGO_POR_DEFECTO = "Que la Fuerza te acompañe"


def _cargar_pantalla(ruta):
    try:
        return pygame.image.load(ruta).convert()
    except (pygame.error, FileNotFoundError):
        print(f"[aviso] No se pudo cargar la imagen: {ruta}")
        return None


def _hay_salto(eventos):
    """True si el jugador pidió saltar la pantalla. Cierra el juego si cerró la ventana."""
    for event in eventos:
        if event.type == pygame.QUIT:
            salir()
        if event.type == pygame.KEYDOWN:
            return True
    return False


def mostrar_imagen_inicial(screen, imagen_path, duracion):
    """Muestra una imagen que se desvanece durante `duracion` ms."""
    imagen = _cargar_pantalla(imagen_path)
    if imagen is None:
        return
    imagen = pygame.transform.scale(imagen, (SCREEN_WIDTH, SCREEN_HEIGHT))
    clock = pygame.time.Clock()
    inicio = pygame.time.get_ticks()

    while True:
        transcurrido = pygame.time.get_ticks() - inicio
        if transcurrido >= duracion or _hay_salto(pygame.event.get()):
            break
        imagen.set_alpha(max(0, 255 - int(255 * transcurrido / duracion)))
        screen.fill(COLOR_NEGRO)
        screen.blit(imagen, (0, 0))
        pygame.display.flip()
        clock.tick(FPS)


def mostrar_logo(screen, imagen_path, duracion=3000, fondo=COLOR_LOGO_FONDO):
    """Muestra el logo con aparición y desvanecimiento. Se salta con cualquier tecla."""
    logo = _cargar_pantalla(imagen_path)
    if logo is None:
        return
    rect = logo.get_rect(center=(SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2))
    clock = pygame.time.Clock()
    inicio = pygame.time.get_ticks()
    mitad = duracion / 2

    while True:
        transcurrido = pygame.time.get_ticks() - inicio
        if transcurrido >= duracion or _hay_salto(pygame.event.get()):
            break
        # Sube de 0 a 255 en la primera mitad y baja en la segunda
        if transcurrido < mitad:
            alpha = int(255 * transcurrido / mitad)
        else:
            alpha = int(255 * (duracion - transcurrido) / mitad)
        logo.set_alpha(max(0, min(255, alpha)))
        screen.fill(fondo)
        screen.blit(logo, rect)
        pygame.display.flip()
        clock.tick(FPS)


def _envolver(texto, fuente, ancho_max):
    """Parte el texto en líneas que entren en `ancho_max`. Una línea vacía separa párrafos."""
    lineas = []
    for parrafo in texto.split('\n'):
        palabras = parrafo.split()
        if not palabras:
            lineas.append('')
            continue
        actual = ''
        for palabra in palabras:
            prueba = f'{actual} {palabra}'.strip()
            if fuente.size(prueba)[0] <= ancho_max:
                actual = prueba
            else:
                if actual:
                    lineas.append(actual)
                actual = palabra
        lineas.append(actual)
    return lineas


def _leer_texto(ruta):
    try:
        with open(ruta, encoding='utf-8') as archivo:
            return archivo.read()
    except OSError:
        print(f"[aviso] No se pudo leer el prólogo: {ruta}")
        return TEXTO_PROLOGO_POR_DEFECTO


def mostrar_prologo(screen, ruta, velocidad=1.6):
    """Texto que sube y se aleja, como en los créditos de Star Wars.

    Se salta con ENTER, ESPACIO o ESC.
    """
    fuente = pygame.font.Font(None, 48)
    fuente_chica = pygame.font.Font(None, 28)
    lineas = _envolver(_leer_texto(ruta), fuente, int(SCREEN_WIDTH * 0.6))
    superficies = [fuente.render(linea, True, COLOR_AMARILLO) if linea else None for linea in lineas]
    interlineado = 56
    recorrido_total = SCREEN_HEIGHT + len(lineas) * interlineado
    clock = pygame.time.Clock()
    scroll = 0.0

    while scroll < recorrido_total:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                salir()
            if event.type == pygame.KEYDOWN and event.key in (
                    pygame.K_RETURN, pygame.K_SPACE, pygame.K_ESCAPE):
                return

        screen.fill(COLOR_NEGRO)
        for i, superficie in enumerate(superficies):
            y = SCREEN_HEIGHT - scroll + i * interlineado
            if superficie is None or y < -interlineado or y > SCREEN_HEIGHT:
                continue
            t = max(0.0, min(1.0, y / SCREEN_HEIGHT))   # 0 = lejos (arriba), 1 = cerca (abajo)
            escala = 0.2 + 0.8 * t
            ancho = max(1, int(superficie.get_width() * escala))
            alto = max(1, int(superficie.get_height() * escala))
            reducida = pygame.transform.smoothscale(superficie, (ancho, alto))
            reducida.set_alpha(int(255 * min(1.0, t * 3)))   # se desvanece al alejarse
            screen.blit(reducida, (SCREEN_WIDTH // 2 - ancho // 2, int(y)))

        texto_centrado(screen, fuente_chica, "ENTER para saltar", COLOR_GRIS,
                       SCREEN_HEIGHT - 20, SCREEN_WIDTH - 110)
        pygame.display.flip()
        clock.tick(FPS)
        scroll += velocidad

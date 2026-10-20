"""Todos los valores configurables del juego. Editá acá para cambiar la dificultad o el ritmo."""
import os

# ---------------------------------------------------------------- Pantalla
SCREEN_WIDTH = 1700
SCREEN_HEIGHT = 1000
FPS = 60

# La lógica avanza en pasos fijos de 1/60 s: el juego va a la misma velocidad
# aunque la computadora dibuje más lento o más rápido.
PASO_MS = 1000 / FPS
MAX_PASOS_POR_FRAME = 5      # límite para no "trabarse" tras una demora larga
TOLERANCIA_PASO_MS = 1.0     # evita saltos por redondeo del reloj

# ------------------------------------------------------------------ Rutas
BASE_PATH = os.path.dirname(os.path.abspath(__file__))
ASSETS_PATH = os.path.join(BASE_PATH, 'assets_1')
IMAGES_PATH = os.path.join(ASSETS_PATH, 'images')
SOUNDS_PATH = os.path.join(ASSETS_PATH, 'sounds')
PROLOGO_PATH = os.path.join(ASSETS_PATH, 'prologo.txt')
RECORD_PATH = os.path.join(BASE_PATH, 'record.json')
AJUSTES_PATH = os.path.join(BASE_PATH, 'ajustes.json')   # volumen guardado

# ------------------------------------------------------------------ Audio
MUSICA_FONDO = 'efectos.mp3'
MUSICA_JEFE = 'Imperial_March_-_Kenobi.mp3'  # suena en el jefe y en el GAME OVER

VOLUMEN_INICIAL = 0.8        # 0.0 a 1.0
PASO_VOLUMEN = 0.1           # cuánto cambia con las teclas + y -
DURACION_AVISO_VOLUMEN_MS = 1500

# ---------------------------------------------------------------- Colores
COLOR_BLANCO = (255, 255, 255)
COLOR_NEGRO = (0, 0, 0)
COLOR_ROJO = (255, 0, 0)
COLOR_VERDE = (0, 255, 0)
COLOR_GRIS = (170, 170, 170)
COLOR_AMARILLO = (255, 232, 31)   # amarillo "Star Wars"
COLOR_BOTON = (18, 24, 40)
COLOR_LOGO_FONDO = (21, 26, 32)
COLOR_TINTE_DISPARADOR = (255, 150, 150, 255)
COLOR_TINTE_JEFE = (255, 110, 110, 255)

# ------------------------------------------------------------------ Naves
IMG_JUGADOR = 'nave_jugador.png'
IMG_JEFE = 'nave_enemiga1.png'
# (archivo, tamaño en pantalla). None = se usa el tamaño original del archivo.
TIPOS_ENEMIGO = (
    ('nave_enemiga1.png', (140, 64)),
    ('nave_enemiga2.png', None),
)

# -------------------------------------------------------------- Personaje
ENERGIA_MAXIMA = 100
# Movimiento con inercia: la nave acelera hasta su velocidad máxima y frena de a poco.
VELOCIDAD_PERSONAJE = 6.0    # velocidad máxima en píxeles por paso (también en diagonal)
ACELERACION_PERSONAJE = 0.55  # cuánto gana por paso al apretar una tecla (llega al máximo en ~11 pasos)
FRENADO_PERSONAJE = 0.45     # cuánto pierde por paso al soltar las teclas (se desliza un poco)
GIRO_BRUSCO = 2.0            # al cambiar de sentido frena el doble de rápido (más control)
INCLINACION_MAX = 14         # grados que se inclina la nave al girar
SUAVIZADO_INCLINACION = 0.2  # 0 = no se mueve, 1 = instantáneo
COOLDOWN_LASER_MS = 250      # tiempo mínimo entre disparos
DANO_COLISION = 10
VELOCIDAD_LASER = 10

# --------------------------------------------------------------- Enemigos
# Velocidad: sube de a poco con el nivel y tiene tope (siempre se puede esquivar).
VELOCIDAD_ENEMIGO_BASE = 5.0
VELOCIDAD_ENEMIGO_INCREMENTO = 0.5
VELOCIDAD_ENEMIGO_MAX = 9.0

# Aparición: un enemigo cada cierto tiempo (más seguido en niveles altos) y con tope en pantalla.
INTERVALO_SPAWN_BASE_MS = 850
INTERVALO_SPAWN_REDUCCION_MS = 55
INTERVALO_SPAWN_MIN_MS = 350
VARIACION_SPAWN = (0.6, 1.4)     # el intervalo se multiplica por un número al azar entre estos
SPAWN_INICIAL_MS = 800
MAX_ENEMIGOS_BASE = 6
MAX_ENEMIGOS_TOPE = 14

# Enemigos que disparan (aparecen desde cierto nivel y son cada vez más frecuentes)
NIVEL_ENEMIGOS_DISPARAN = 2
PROB_DISPARADOR_BASE = 0.15
PROB_DISPARADOR_INCREMENTO = 0.05
PROB_DISPARADOR_MAX = 0.5
INTERVALO_DISPARO_ENEMIGO = (1200, 2200)   # ms (mínimo, máximo)
VELOCIDAD_LASER_ENEMIGO = 8
DANO_LASER_ENEMIGO = 10

# ------------------------------------------------------------------ Jefe
NIVEL_JEFE_CADA = 3          # hay jefe en los niveles 3, 6, 9...
VIDA_JEFE_BASE = 20
INTERVALO_DISPARO_JEFE = 1400
VELOCIDAD_JEFE_MAX = 9
DANO_JEFE_CONTACTO = 20
INVULNERABILIDAD_JEFE_MS = 1000
PUNTOS_JEFE = 100
PAUSA_TRAS_JEFE_MS = 1500    # respiro antes de que vuelvan los enemigos comunes

# ------------------------------------------------------- Ítems de energía
PROB_ITEM = 0.15             # probabilidad de soltar ítem al destruir un enemigo
ENERGIA_ITEM = 25
VELOCIDAD_ITEM = 3

# ------------------------------------------------------ Puntaje y niveles
PUNTOS_POR_ENEMIGO = 10
PUNTOS_POR_NIVEL = 250
DURACION_AVISO_MS = 2000

# -------------------------------------------------------------- Animación
FRAMES_POR_IMAGEN_EXPLOSION = 4
FONDO_VELOCIDAD = 1.5        # píxeles por paso del scroll del fondo

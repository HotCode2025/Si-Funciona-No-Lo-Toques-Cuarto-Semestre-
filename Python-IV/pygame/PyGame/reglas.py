"""Reglas de dificultad y niveles como funciones puras (fáciles de testear)."""
from constantes import (
    PUNTOS_POR_NIVEL, NIVEL_JEFE_CADA, VIDA_JEFE_BASE, INTERVALO_DISPARO_JEFE,
    VELOCIDAD_ENEMIGO_BASE, VELOCIDAD_ENEMIGO_INCREMENTO, VELOCIDAD_ENEMIGO_MAX,
    INTERVALO_SPAWN_BASE_MS, INTERVALO_SPAWN_REDUCCION_MS, INTERVALO_SPAWN_MIN_MS,
    MAX_ENEMIGOS_BASE, MAX_ENEMIGOS_TOPE, NIVEL_ENEMIGOS_DISPARAN,
    PROB_DISPARADOR_BASE, PROB_DISPARADOR_INCREMENTO, PROB_DISPARADOR_MAX,
    VELOCIDAD_JEFE_MAX,
)


def calcular_nivel(puntos):
    return max(0, puntos) // PUNTOS_POR_NIVEL + 1


# ---------------------------------------------------------------- enemigos
def velocidad_enemigo(nivel):
    return min(VELOCIDAD_ENEMIGO_BASE + VELOCIDAD_ENEMIGO_INCREMENTO * (nivel - 1),
               VELOCIDAD_ENEMIGO_MAX)


def intervalo_spawn(nivel):
    """Milisegundos promedio entre un enemigo y el siguiente."""
    return max(INTERVALO_SPAWN_BASE_MS - INTERVALO_SPAWN_REDUCCION_MS * (nivel - 1),
               INTERVALO_SPAWN_MIN_MS)


def max_enemigos(nivel):
    """Cantidad máxima de enemigos comunes a la vez en pantalla."""
    return min(MAX_ENEMIGOS_BASE + (nivel - 1), MAX_ENEMIGOS_TOPE)


def prob_disparador(nivel):
    """Probabilidad de que un enemigo nuevo sea de los que disparan."""
    if nivel < NIVEL_ENEMIGOS_DISPARAN:
        return 0.0
    return min(PROB_DISPARADOR_BASE + PROB_DISPARADOR_INCREMENTO * (nivel - NIVEL_ENEMIGOS_DISPARAN),
               PROB_DISPARADOR_MAX)


# -------------------------------------------------------------------- jefe
def jefes_debidos(nivel):
    """Cuántos jefes tienen que haber aparecido hasta este nivel (uno cada NIVEL_JEFE_CADA).

    Se cuenta en vez de comparar el nivel exacto, así nunca se saltea un jefe.
    """
    return nivel // NIVEL_JEFE_CADA


def vida_jefe(nivel_jefe):
    """El jefe tiene más vida cada vez que aparece."""
    return VIDA_JEFE_BASE + 8 * (nivel_jefe // NIVEL_JEFE_CADA - 1)


def velocidad_jefe(nivel_jefe):
    return min(4 + nivel_jefe // NIVEL_JEFE_CADA, VELOCIDAD_JEFE_MAX)


def intervalo_disparo_jefe(nivel_jefe):
    return max(600, INTERVALO_DISPARO_JEFE - 100 * (nivel_jefe // NIVEL_JEFE_CADA))

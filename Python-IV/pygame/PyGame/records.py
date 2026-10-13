"""Guarda y lee el mejor puntaje en un archivo JSON."""
import json

from constantes import RECORD_PATH


def cargar_record(ruta=RECORD_PATH):
    try:
        with open(ruta, encoding='utf-8') as archivo:
            return max(0, int(json.load(archivo).get('record', 0)))
    except (OSError, ValueError, TypeError, AttributeError):
        return 0


def guardar_record(puntos, ruta=RECORD_PATH):
    try:
        with open(ruta, 'w', encoding='utf-8') as archivo:
            json.dump({'record': int(puntos)}, archivo)
    except OSError:
        pass  # si no se puede escribir, el juego sigue igual

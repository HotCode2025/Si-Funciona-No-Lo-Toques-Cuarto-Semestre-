"""Guarda y lee los ajustes del jugador (volumen) en un archivo JSON."""
import json

from constantes import AJUSTES_PATH, VOLUMEN_INICIAL


def cargar_ajustes(ruta=AJUSTES_PATH):
    try:
        with open(ruta, encoding='utf-8') as archivo:
            datos = json.load(archivo)
        volumen = min(1.0, max(0.0, float(datos.get('volumen', VOLUMEN_INICIAL))))
        return {'volumen': volumen, 'silenciado': bool(datos.get('silenciado', False))}
    except (OSError, ValueError, TypeError, AttributeError):
        return {'volumen': VOLUMEN_INICIAL, 'silenciado': False}


def guardar_ajustes(volumen, silenciado, ruta=AJUSTES_PATH):
    try:
        with open(ruta, 'w', encoding='utf-8') as archivo:
            json.dump({'volumen': round(float(volumen), 2), 'silenciado': bool(silenciado)}, archivo)
    except OSError:
        pass  # si no se puede escribir, el juego sigue igual

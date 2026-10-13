"""Muestra qué archivos de assets_1/ faltan.   Uso:  python tools/verificar_assets.py"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

from constantes import ASSETS_PATH  # noqa: E402
from utilidades import ASSETS_REQUERIDOS, verificar_assets  # noqa: E402

print("Carpeta de assets que busca el juego:")
print("  ", os.path.abspath(ASSETS_PATH))
print("  existe:", os.path.isdir(ASSETS_PATH))
faltan = verificar_assets()
print(f"\nEncontrados: {len(ASSETS_REQUERIDOS) - len(faltan)} de {len(ASSETS_REQUERIDOS)}")
if faltan:
    print("Faltan:")
    for ruta in faltan:
        print("   -", ruta)
else:
    print("Está todo: el juego va a mostrar las imágenes originales.")

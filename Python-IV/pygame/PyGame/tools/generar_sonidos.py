"""Genera los efectos de sonido nuevos (golpe, nivel, item) como archivos WAV.

Uso:  python tools/generar_sonidos.py
No necesita librerías externas. Si querés otros sonidos, reemplazá los .wav
en assets_1/sounds/ manteniendo los mismos nombres.
"""
import math
import os
import random
import struct
import wave

TASA = 22050
DESTINO = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets_1', 'sounds')


def tono(frecuencia, duracion, volumen=0.5, caida=4.0):
    n = int(TASA * duracion)
    return [volumen * math.exp(-caida * i / n) * math.sin(2 * math.pi * frecuencia * i / TASA)
            for i in range(n)]


def guardar(nombre, muestras):
    ruta = os.path.join(DESTINO, nombre)
    with wave.open(ruta, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(TASA)
        w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, m)) * 32767)) for m in muestras))
    print('creado', os.path.normpath(ruta))


def golpe():
    random.seed(7)
    n = int(TASA * 0.3)
    grave = tono(110, 0.3, 0.6, 5)
    return [grave[i] + random.uniform(-1, 1) * 0.35 * math.exp(-8 * i / n) for i in range(n)]


def nivel():
    muestras = []
    for frecuencia in (523, 659, 784, 1047):   # do - mi - sol - do
        muestras += tono(frecuencia, 0.11, 0.45, 3)
    return muestras


def item():
    return tono(880, 0.07, 0.45, 2) + tono(1320, 0.12, 0.45, 4)


if __name__ == '__main__':
    os.makedirs(DESTINO, exist_ok=True)
    guardar('golpe.wav', golpe())
    guardar('nivel.wav', nivel())
    guardar('item.wav', item())

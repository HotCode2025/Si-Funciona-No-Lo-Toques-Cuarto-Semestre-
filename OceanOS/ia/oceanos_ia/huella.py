"""Huella perceptual (dHash) para detectar la misma foto aunque la recompriman o la achiquen."""
import hashlib
import numpy as np
from PIL import Image

def dhash(im: Image.Image) -> str:
    g = im.convert("L").resize((9, 8), Image.LANCZOS)
    a = np.asarray(g, dtype="i2"); bits = 0
    for b in (a[:, 1:] < a[:, :-1]).ravel():
        bits = (bits << 1) | int(b)
    return f"{bits:016x}"

def hamming(a: str, b: str) -> int:
    return bin(int(a, 16) ^ int(b, 16)).count("1")

def sha256(datos: bytes) -> str:
    return hashlib.sha256(datos).hexdigest()

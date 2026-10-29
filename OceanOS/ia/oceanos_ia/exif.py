"""Fecha y GPS que trae la foto, y si coinciden con lo que declara quien la sube."""
import math
from PIL import Image

def _grados(v, ref):
    d = float(v[0]) + float(v[1]) / 60 + float(v[2]) / 3600
    return -d if ref in ("S", "W") else d

def leer(im: Image.Image):
    """im: imagen abierta ANTES de rotarla (conserva el EXIF). -> {lat,lng,fecha} (campos None si no hay)."""
    out = {"lat": None, "lng": None, "fecha": None}
    try:
        ex = im.getexif()
        gps = ex.get_ifd(0x8825)
        if gps and 2 in gps and 4 in gps:
            out["lat"] = round(_grados(gps[2], gps.get(1, "N")), 6)
            out["lng"] = round(_grados(gps[4], gps.get(3, "E")), 6)
        sub = ex.get_ifd(0x8769)
        f = sub.get(0x9003) or ex.get(0x0132)
        if f: out["fecha"] = str(f).replace(":", "-", 2)
    except Exception:
        pass
    return out

def km(lat1, lng1, lat2, lng2):
    p = math.pi / 180
    a = math.sin((lat2 - lat1) * p / 2) ** 2 + math.cos(lat1 * p) * math.cos(lat2 * p) * math.sin((lng2 - lng1) * p / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(a))

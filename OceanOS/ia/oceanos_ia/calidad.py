"""Controles de calidad de la foto. Las fotos bajo el agua son turbias a propósito: los umbrales son tolerantes."""
import numpy as np
from PIL import Image
from . import config

def evaluar(im: Image.Image):
    w, h = im.size
    g = im.convert("L"); s = 512 / max(w, h)
    if s < 1: g = g.resize((max(1, round(w * s)), max(1, round(h * s))), Image.BILINEAR)
    a = np.asarray(g, "f")
    lap = 4 * a[1:-1, 1:-1] - a[:-2, 1:-1] - a[2:, 1:-1] - a[1:-1, :-2] - a[1:-1, 2:]
    nitidez = float(lap.var()); brillo = float(a.mean()); contraste = float(a.std())
    quemado = float((a > 250).mean()); negro = float((a < 8).mean())
    problemas = []
    if min(w, h) < config.MIN_LADO: problemas.append(f"Es muy chica ({w}x{h}); conviene al menos {config.MIN_LADO} px de lado.")
    if nitidez < 12: problemas.append("Está borrosa o movida: el animal puede no distinguirse.")
    if brillo < 28 or negro > 0.6: problemas.append("Está muy oscura.")
    if brillo > 232 or quemado > 0.5: problemas.append("Está sobreexpuesta (muy clara).")
    if contraste < 10: problemas.append("Tiene muy poco contraste, casi no se ve nada.")
    puntaje = max(0.0, 1.0 - 0.3 * len(problemas))
    return {"ok": not problemas, "puntaje": round(puntaje, 2), "problemas": problemas, "ancho": w, "alto": h,
            "detalle": {"nitidez": round(nitidez, 1), "brillo": round(brillo, 1), "contraste": round(contraste, 1)}}

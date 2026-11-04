#!/usr/bin/env python3
"""
Arma el dataset inicial con fotogramas de los videos del sitio (hace falta ffmpeg).
Las etiquetas salen de datos/semilla/etiquetas.csv: REVISALAS, son una primera aproximación.

    python sembrar_desde_videos.py [--videos ../frontend/public/videos] [--fps 3]
"""
import argparse, csv, subprocess, tempfile
from pathlib import Path
import numpy as np
from PIL import Image
from oceanos_ia import config
from oceanos_ia.encoder import encoder

ap = argparse.ArgumentParser()
ap.add_argument("--videos", default=str(config.RAIZ.parent / "frontend" / "public" / "videos")); ap.add_argument("--fps", type=float, default=3)
a = ap.parse_args()

filas = list(csv.DictReader(open(config.RAIZ / "datos" / "semilla" / "etiquetas.csv", encoding="utf-8")))
E, F, Y, G = [], [], [], []
for f in filas:
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["ffmpeg", "-v", "error", "-i", str(Path(a.videos) / f["archivo"]), "-vf", f"fps={a.fps}", f"{tmp}/%04d.jpg"], check=True)
        for p in sorted(Path(tmp).glob("*.jpg")):
            e, fl, _ = encoder().embed(Image.open(p).convert("RGB")); E.append(e); F.append(fl); Y.append(f["etiqueta"]); G.append(f["archivo"].rsplit(".", 1)[0])
    print(f"{f['archivo']:22s} -> {f['etiqueta']:14s} {sum(1 for g in G if g == f['archivo'].rsplit('.', 1)[0])} fotogramas")
np.savez_compressed(config.SEMILLA, emb=np.array(E, "f4"), flip=np.array(F, "f4"), y=np.array(Y), grupos=np.array(G))
print("Guardado", config.SEMILLA, "- ahora corré: python entrenar.py (borrá datos/fotos.db antes si ya existía)")

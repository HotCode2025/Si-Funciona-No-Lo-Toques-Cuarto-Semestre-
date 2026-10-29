#!/usr/bin/env python3
"""
Reentrena la IA con todas las fotos etiquetadas y publica la versión nueva si no es peor.

    python entrenar.py                 entrena y publica
    python entrenar.py --forzar        publica aunque las métricas sean peores
    python entrenar.py --listar        muestra las versiones
    python entrenar.py --activar v0003 vuelve a una versión anterior
"""
import argparse, json
from oceanos_ia import modelo
from oceanos_ia.almacen import Almacen

ap = argparse.ArgumentParser()
ap.add_argument("--forzar", action="store_true"); ap.add_argument("--listar", action="store_true"); ap.add_argument("--activar")
a = ap.parse_args()

if a.listar:
    for v in modelo.listar():
        m = v["metricas"] or {}
        print(f"{'*' if v['activa'] else ' '} {v['version']}  {v['fecha']}  fotos={v['fotos']:<5} clases={len(v['clases'])}  F1={m.get('f1_macro', 'sin validar')}")
elif a.activar:
    modelo.activar(a.activar); print("Activa:", a.activar)
else:
    al = Almacen(); print(json.dumps(al.resumen(), indent=2, ensure_ascii=False))
    try:
        r = modelo.entrenar_y_publicar(al.dataset(), a.forzar)
    except modelo.SinDatos as e:
        raise SystemExit(f"\n✗ {e}")
    m = r["meta"]
    print(f"\n✓ {r['version']}  {'PUBLICADA' if r['publicada'] else 'candidata (no activa)'}  — {r['motivo']}")
    print("  Métricas (validación agrupada):", m["metricas"] or "no calculables todavía: faltan fotos de distintos eventos")
    for c, i in m["clases"].items():
        print(f"  {c:22s} fotos={i['fotos']:<4} eventos={i['grupos']:<3} {'VALIDADA' if i['validada'] else 'en aprendizaje'}  {({k: i[k] for k in ('precision','recall') if k in i}) or ''}")
    if m["en_recoleccion"]: print("  Juntando fotos:", m["en_recoleccion"])

"""El pipeline completo: foto -> calidad, duplicado, EXIF, predicción, pista general."""
import io
import threading

import numpy as np
from PIL import Image, ImageOps

from . import calidad, config, exif, huella, modelo, taxonomia
from .almacen import Almacen
from .encoder import encoder

Image.MAX_IMAGE_PIXELS = 60_000_000

class FotoInvalida(ValueError):
    pass

class Servicio:
    def __init__(self):
        self.almacen = Almacen(); self.entrenamiento = {"estado": "libre", "detalle": None}; self._lock = threading.Lock()

    # ---------- análisis ----------
    def analizar(self, datos: bytes, lat=None, lng=None, grupo=None, fuente="usuario"):
        if len(datos) > config.MAX_BYTES: raise FotoInvalida(f"La foto pesa más de {config.MAX_BYTES // 1048576} MB")
        try:
            orig = Image.open(io.BytesIO(datos)); orig.load()
        except Exception:
            raise FotoInvalida("No pude leer la imagen. Probá con JPG o PNG.")
        datos_exif = exif.leer(orig)
        im = ImageOps.exif_transpose(orig).convert("RGB")
        cal = calidad.evaluar(im)
        sha = huella.sha256(datos); dh = huella.dhash(im)
        emb, flip, probs = encoder().embed(im)

        existente = self.almacen.por_sha(sha)
        dup = {"foto_id": existente["id"], "similitud": 1.0, "bits": 0} if existente else self.almacen.buscar_duplicado(dh, emb)

        cab = modelo.cargar_actual()
        pred = self._predecir(cab, emb, probs)
        pista = taxonomia.pista(probs)
        if pred["estado"] in ("desconocida", "incierta", "sin_modelo") and pista:
            for p in pista["parecidos"]:
                clase = taxonomia.PISTA_A_CLASE.get(p["indice"])
                if clase and p["prob"] >= 0.30: pred["sugerencia_base"] = {"clase": taxonomia.ficha(clase), "prob": p["prob"]}; break
        for p in (pista or {}).get("parecidos", []): p.pop("indice", None)

        ex = dict(datos_exif); ex["distancia_km"] = None; ex["coincide"] = None
        if lat is not None and lng is not None and ex["lat"] is not None:
            d = exif.km(lat, lng, ex["lat"], ex["lng"]); ex["distancia_km"] = round(d, 2); ex["coincide"] = d <= config.EXIF_KM_MAX

        foto_id = existente["id"] if existente else None
        if not existente:
            foto_id = self._guardar(im, sha, dh, emb, flip, pred, cab, fuente, grupo)
        auto = bool(config.AUTOVERIFICAR and cab and cab.meta.get("apto_autoverificar") and pred["estado"] == "sugerida"
                    and pred["confianza"] >= config.UMBRAL_AUTO and pred.get("validada") and cal["ok"] and not dup and ex["coincide"] is not False)
        return {"id": foto_id, "modelo": {"version": cab.version if cab else None, "validado": bool(cab and cab.meta.get("apto_autoverificar"))},
                "calidad": cal, "duplicado": dup, "exif": ex, "prediccion": pred, "pista_general": pista, "puede_autoverificar": auto,
                "imagen": f"/fotos/{foto_id}/imagen"}

    def _predecir(self, cab, emb, probs):
        if cab is None: return {"estado": "sin_modelo", "clase": None, "confianza": 0.0, "alternativas": [], "validada": False}
        p, sim = cab.predecir(emb); orden = np.argsort(-p)[:3]
        alt = [{**taxonomia.ficha(cab.clases[j]), "confianza": round(float(p[j]), 3)} for j in orden]
        top = alt[0]; info = cab.meta["clases"].get(top["id"], {})
        if cab.tau is not None and sim < cab.tau: estado = "desconocida"
        elif top["confianza"] >= config.UMBRAL_SUGERIR: estado = "sugerida"
        else: estado = "incierta"
        return {"estado": estado, "clase": top if estado != "desconocida" else None, "confianza": top["confianza"] if estado != "desconocida" else 0.0,
                "alternativas": alt if estado != "desconocida" else [], "validada": bool(info.get("validada")), "semejanza": round(sim, 3)}

    def _guardar(self, im, sha, dh, emb, flip, pred, cab, fuente, grupo):
        import uuid
        fid = uuid.uuid4().hex[:16]; chica = im.copy(); chica.thumbnail((1280, 1280))
        ruta = config.DATOS / "imagenes" / f"{fid}.jpg"; chica.save(ruta, "JPEG", quality=85)   # re-codificada: sin EXIF ni GPS
        self.almacen.agregar(id=fid, sha=sha, dh=dh, ancho=im.width, alto=im.height, ruta=str(ruta), emb=emb, emb_flip=flip, fuente=fuente,
                             grupo=grupo, ia={"etiqueta": (pred["clase"] or {}).get("id"), "conf": pred["confianza"], "estado": pred["estado"]},
                             modelo=cab.version if cab else None)
        return fid

    # ---------- aprendizaje ----------
    def etiquetar(self, foto_id, etiqueta, fuente, quien, grupo=None):
        if etiqueta != "ninguna" and taxonomia.por_id(etiqueta) is None: raise ValueError("Esa especie no está en la taxonomía")
        if fuente not in ("usuario", "verificador"): raise ValueError("fuente inválida")
        if grupo: self.almacen.asignar_grupo(foto_id, grupo)
        return self.almacen.etiquetar(foto_id, etiqueta, fuente, quien)

    def entrenar(self, forzar=False):
        with self._lock:
            if self.entrenamiento["estado"] == "entrenando": return self.entrenamiento
            self.entrenamiento = {"estado": "entrenando", "detalle": None}
        def tarea():
            try:
                r = modelo.entrenar_y_publicar(self.almacen.dataset(), forzar)
                self.entrenamiento = {"estado": "listo", "detalle": {k: r[k] for k in ("version", "publicada", "motivo")} | {"metricas": r["meta"]["metricas"]}}
            except modelo.SinDatos as e:
                self.entrenamiento = {"estado": "sin_datos", "detalle": str(e)}
            except Exception as e:  # noqa
                self.entrenamiento = {"estado": "error", "detalle": repr(e)}
        threading.Thread(target=tarea, daemon=True).start()
        return self.entrenamiento

    def estado_modelo(self):
        cab = modelo.cargar_actual(); res = self.almacen.resumen()
        return {"version": cab.version if cab else None, "meta": cab.meta if cab else None, "dataset": res,
                "min_ejemplos": config.MIN_EJEMPLOS, "versiones": modelo.listar(), "entrenamiento": self.entrenamiento,
                "autoverificar_habilitado": config.AUTOVERIFICAR, "taxonomia": taxonomia.cargar()}

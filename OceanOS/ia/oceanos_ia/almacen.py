"""Base de datos (SQLite) de fotos, embeddings y etiquetas. Es el dataset que se va armando solo."""
import sqlite3
import time
import uuid
from contextlib import contextmanager

import numpy as np

from . import config, huella

ESQUEMA = """
CREATE TABLE IF NOT EXISTS fotos(
  id TEXT PRIMARY KEY, sha256 TEXT UNIQUE, dhash TEXT, ancho INT, alto INT, ruta TEXT,
  emb BLOB NOT NULL, emb_flip BLOB NOT NULL, creado TEXT NOT NULL,
  fuente TEXT NOT NULL, grupo TEXT, ia_etiqueta TEXT, ia_conf REAL, ia_estado TEXT, modelo TEXT);
CREATE TABLE IF NOT EXISTS etiquetas(
  foto_id TEXT NOT NULL, etiqueta TEXT NOT NULL, fuente TEXT NOT NULL, quien TEXT NOT NULL, creado TEXT NOT NULL,
  PRIMARY KEY(foto_id, fuente, quien));
CREATE INDEX IF NOT EXISTS ix_eti_foto ON etiquetas(foto_id);
"""
ahora = lambda: time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime())
vec = lambda b: np.frombuffer(b, dtype="f4")

def consenso(filas):
    """filas: etiquetas de UNA foto. La ganadora necesita peso mínimo y mayoría clara; si no, la foto no entra a entrenar."""
    pesos = {}
    for f in filas: pesos[f["etiqueta"]] = pesos.get(f["etiqueta"], 0) + config.PESOS_FUENTE.get(f["fuente"], 0.5)
    if not pesos: return None, 0.0
    gana, w = max(pesos.items(), key=lambda kv: kv[1])
    if w >= config.CONSENSO_PESO_MIN and w / sum(pesos.values()) >= config.CONSENSO_SHARE_MIN: return gana, w
    return None, w

class Almacen:
    def __init__(self):
        config.DATOS.mkdir(parents=True, exist_ok=True)
        (config.DATOS / "imagenes").mkdir(exist_ok=True)
        self.ruta = config.DATOS / "fotos.db"
        with self.con() as c: c.executescript(ESQUEMA)
        self._importar_semilla()

    @contextmanager
    def con(self):
        c = sqlite3.connect(self.ruta, timeout=30); c.row_factory = sqlite3.Row
        try:
            yield c; c.commit()
        finally:
            c.close()

    # ---------- escritura ----------
    def agregar(self, *, id=None, sha, dh, ancho, alto, ruta, emb, emb_flip, fuente, grupo=None, ia=None, modelo=None):
        id = id or uuid.uuid4().hex[:16]; ia = ia or {}
        with self.con() as c:
            c.execute("INSERT INTO fotos VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                      (id, sha, dh, ancho, alto, ruta, emb.astype("f4").tobytes(), emb_flip.astype("f4").tobytes(), ahora(),
                       fuente, grupo, ia.get("etiqueta"), ia.get("conf"), ia.get("estado"), modelo))
        return id

    def etiquetar(self, foto_id, etiqueta, fuente, quien):
        with self.con() as c:
            if not c.execute("SELECT 1 FROM fotos WHERE id=?", (foto_id,)).fetchone(): raise KeyError(foto_id)
            c.execute("INSERT OR REPLACE INTO etiquetas VALUES(?,?,?,?,?)", (foto_id, etiqueta, fuente, quien, ahora()))
            filas = c.execute("SELECT * FROM etiquetas WHERE foto_id=?", (foto_id,)).fetchall()
        gana, w = consenso(filas)
        return {"consenso": gana, "peso": round(w, 2), "entra_a_entrenar": gana is not None}

    def asignar_grupo(self, foto_id, grupo):
        with self.con() as c: c.execute("UPDATE fotos SET grupo=? WHERE id=? AND (grupo IS NULL OR grupo='')", (grupo, foto_id))

    # ---------- lectura ----------
    def foto(self, foto_id):
        with self.con() as c: return c.execute("SELECT * FROM fotos WHERE id=?", (foto_id,)).fetchone()

    def por_sha(self, sha):
        with self.con() as c: return c.execute("SELECT id FROM fotos WHERE sha256=?", (sha,)).fetchone()

    def buscar_duplicado(self, dh, emb):
        """La foto más parecida entre las subidas por personas (la semilla no cuenta)."""
        mejor = None
        with self.con() as c:
            for f in c.execute("SELECT id,dhash,emb FROM fotos WHERE fuente!='semilla' ORDER BY creado DESC LIMIT 20000"):
                h = huella.hamming(dh, f["dhash"]); cos = float(vec(f["emb"]) @ emb)
                if h <= config.DUP_HAMMING or cos >= config.DUP_COSENO:
                    if mejor is None or cos > mejor["similitud"]: mejor = {"foto_id": f["id"], "similitud": round(cos, 3), "bits": h}
        return mejor

    def dataset(self):
        """Fotos con etiqueta de consenso -> arrays listos para entrenar (cada foto aporta original y espejada)."""
        with self.con() as c:
            etis = {}
            for e in c.execute("SELECT * FROM etiquetas"): etis.setdefault(e["foto_id"], []).append(e)
            y, g, w, E, F, ids = [], [], [], [], [], []
            for f in c.execute("SELECT id,grupo,emb,emb_flip FROM fotos"):
                gana, peso = consenso(etis.get(f["id"], []))
                if gana is None: continue
                ids.append(f["id"]); y.append(gana); g.append(f["grupo"] or f["id"]); w.append(min(peso, 2.0))
                E.append(vec(f["emb"])); F.append(vec(f["emb_flip"]))
        d = config.DATOS
        return {"ids": ids, "y": np.array(y), "g": np.array(g), "w": np.array(w, "f4"),
                "E": np.stack(E) if E else np.zeros((0, 1280), "f4"), "F": np.stack(F) if F else np.zeros((0, 1280), "f4")}

    def resumen(self):
        ds = self.dataset(); clases = {}
        for c in sorted(set(ds["y"].tolist())):
            m = ds["y"] == c
            clases[c] = {"fotos": int(m.sum()), "grupos": int(len(set(ds["g"][m].tolist())))}
        with self.con() as c:
            total = c.execute("SELECT COUNT(*) FROM fotos").fetchone()[0]
            de_gente = c.execute("SELECT COUNT(*) FROM fotos WHERE fuente!='semilla'").fetchone()[0]
        return {"clases": clases, "fotos_total": total, "fotos_de_gente": de_gente,
                "fotos_con_etiqueta": int(len(ds["ids"])), "sin_etiqueta_confiable": total - int(len(ds["ids"]))}

    # ---------- semilla ----------
    def _importar_semilla(self):
        if not config.SEMILLA.exists(): return
        with self.con() as c:
            if c.execute("SELECT 1 FROM fotos WHERE fuente='semilla' LIMIT 1").fetchone(): return
        z = np.load(config.SEMILLA, allow_pickle=False)
        for i in range(len(z["y"])):
            fid = f"semilla-{i:04d}"
            self.agregar(id=fid, sha=f"semilla:{i}", dh="0" * 16, ancho=0, alto=0, ruta=None, emb=z["emb"][i], emb_flip=z["flip"][i],
                         fuente="semilla", grupo=str(z["grupos"][i]))
            self.etiquetar(fid, str(z["y"][i]), "semilla", "semilla")

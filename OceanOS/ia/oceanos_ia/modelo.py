"""
La "cabeza" entrenable: regresión logística sobre los embeddings, con
- validación cruzada AGRUPADA (los fotogramas de un mismo video o de un mismo reporte nunca se reparten entre
  entrenamiento y prueba, así que la métrica no se infla),
- calibración por temperatura (la confianza que se muestra se parece a la probabilidad real de acertar),
- rechazo de lo desconocido (una foto que no se parece a nada de lo visto no se clasifica a la fuerza),
- versiones numeradas, con vuelta atrás y una compuerta que evita publicar un modelo peor.
"""
import json
import time

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GroupKFold

from . import config

class SinDatos(Exception):
    pass

def _softmax(z):
    z = z - z.max(axis=-1, keepdims=True); e = np.exp(z)
    return e / e.sum(axis=-1, keepdims=True)

class Cabeza:
    def __init__(self, npz, meta):
        self.clases = [str(c) for c in npz["clases"]]; self.mu, self.sd = npz["mu"], npz["sd"]
        self.W, self.b, self.T = npz["W"], npz["b"], float(npz["T"])
        t = float(npz["tau"]); self.tau = None if np.isnan(t) else t
        self.bank = npz["bank"].astype("f4"); self.meta = meta; self.version = meta["version"]

    def predecir(self, emb):
        z = ((emb - self.mu) / self.sd) @ self.W.T + self.b
        sim = float((self.bank @ emb).max()) if len(self.bank) else 1.0
        return _softmax(z / self.T), sim

def _ajustar(X, y, w, C):
    lr = LogisticRegression(C=C, max_iter=3000, class_weight="balanced")
    lr.fit(X, y, sample_weight=w); return lr

def _logits(lr, X, clases):
    out = np.full((len(X), len(clases)), -20.0, "f4"); z = lr.decision_function(X)
    if z.ndim == 1: z = np.stack([-z, z], 1)
    for j, c in enumerate(lr.classes_): out[:, clases.index(c)] = z[:, j]
    return out

def _nll(z, yi, T): p = _softmax(z / T); return float(-np.log(p[np.arange(len(yi)), yi] + 1e-9).mean())

def entrenar(ds):
    n_por = {c: int((ds["y"] == c).sum()) for c in set(ds["y"].tolist())}
    clases = sorted(c for c, n in n_por.items() if n >= config.MIN_EJEMPLOS)
    faltan = {c: n for c, n in n_por.items() if n < config.MIN_EJEMPLOS}
    if len(clases) < 2:
        raise SinDatos(f"Hacen falta al menos 2 clases con {config.MIN_EJEMPLOS} fotos etiquetadas. Hoy: {n_por}")
    m = np.isin(ds["y"], clases)
    E, F, y, g, w = ds["E"][m], ds["F"][m], ds["y"][m], ds["g"][m], ds["w"][m]
    X = np.vstack([E, F]); Y = np.concatenate([y, y]); G = np.concatenate([g, g]); W = np.concatenate([w, w])
    mu = X.mean(0); sd = X.std(0) + 1e-3; Xs = (X - mu) / sd
    yi = np.array([clases.index(c) for c in Y])
    grupos_de = {c: len(set(g[y == c].tolist())) for c in clases}
    evaluable = np.array([grupos_de[c] >= 2 for c in Y])
    n_grupos = len(set(G.tolist()))

    # --- validación agrupada ---
    oof = None; C = 0.1
    if n_grupos >= 3 and evaluable.any():
        k = min(5, n_grupos); pliegues = list(GroupKFold(n_splits=k).split(Xs, Y, G))
        def correr(c_):
            z = np.zeros((len(Xs), len(clases)), "f4")
            for tr, te in pliegues:
                if len(set(Y[tr].tolist())) < 2: z[te] = -20.0; continue
                z[te] = _logits(_ajustar(Xs[tr], Y[tr], W[tr], c_), Xs[te], clases)
            return z
        mejor = None
        for c_ in (0.02, 0.1, 0.5):
            z = correr(c_); s = _nll(z[evaluable], yi[evaluable], 1.0)
            if mejor is None or s < mejor[0]: mejor = (s, c_, z)
        _, C, oof = mejor
    T = 3.0; metricas = None; por_clase = {}
    if oof is not None:
        z = oof[evaluable]; t = yi[evaluable]
        T = float(min(np.linspace(0.5, 6, 45), key=lambda T_: _nll(z, t, T_)))
        pred = z.argmax(1); acc = float((pred == t).mean()); f1s = []
        for j, c in enumerate(clases):
            tp = int(((pred == j) & (t == j)).sum()); pp = int((pred == j).sum()); rr = int((t == j).sum())
            if rr == 0: continue
            p_ = tp / pp if pp else 0.0; r_ = tp / rr; f1s.append(2 * p_ * r_ / (p_ + r_) if p_ + r_ else 0.0)
            por_clase[c] = {"precision": round(p_, 3), "recall": round(r_, 3)}
        metricas = {"exactitud": round(acc, 3), "f1_macro": round(float(np.mean(f1s)), 3), "evaluadas": int(evaluable.sum() // 2),
                    "pliegues": k, "nll": round(_nll(z, t, T), 3)}

    lr = _ajustar(Xs, Y, W, C)
    Wf = np.zeros((len(clases), Xs.shape[1]), "f4"); bf = np.zeros(len(clases), "f4")
    co = lr.coef_ if lr.coef_.shape[0] > 1 else np.vstack([-lr.coef_, lr.coef_]); ic = lr.intercept_ if lr.coef_.shape[0] > 1 else np.array([-lr.intercept_[0], lr.intercept_[0]])
    for j, c in enumerate(lr.classes_): Wf[clases.index(c)] = co[j]; bf[clases.index(c)] = ic[j]

    # --- umbral de "no lo conozco": semejanza al vecino de OTRO grupo ---
    tau = np.nan; gE = np.array(g)
    if len(set(gE.tolist())) >= 2:
        idx = np.random.default_rng(0).permutation(len(E))[:3000]; mx = []
        for i in idx:
            otros = gE != gE[i]
            if otros.any(): mx.append(float((E[otros] @ E[i]).max()))
        if mx: tau = float(np.percentile(mx, 10))
    banco = E[np.random.default_rng(1).permutation(len(E))[:4000]]

    info = {}
    for c in clases:
        r = por_clase.get(c, {}); ng = grupos_de[c]; nf = int((y == c).sum())
        info[c] = {"fotos": nf, "grupos": ng, **r,
                   "validada": bool(ng >= 3 and r.get("recall", 0) >= 0.8 and r.get("precision", 0) >= 0.8)}
    apto = bool(metricas and all(v["validada"] for v in info.values()) and metricas["f1_macro"] >= 0.9 and len(y) >= 150)
    meta = {"fecha": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "encoder": "efficientnet-b0",
            "fotos": int(len(y)), "clases": info, "en_recoleccion": faltan, "metricas": metricas, "C": C, "temperatura": round(T, 2),
            "umbral_desconocido": None if np.isnan(tau) else round(tau, 3), "apto_autoverificar": apto}
    arr = dict(clases=np.array(clases), mu=mu.astype("f4"), sd=sd.astype("f4"), W=Wf, b=bf, T=np.float32(T),
               tau=np.float32(tau), bank=banco.astype("f2"))
    return arr, meta

# ---------- versiones ----------
def _versiones():
    config.VERSIONES.mkdir(parents=True, exist_ok=True)
    return sorted(p.name for p in config.VERSIONES.iterdir() if p.is_dir() and p.name.startswith("v"))

def guardar(arr, meta):
    vs = _versiones(); n = (int(vs[-1][1:]) + 1) if vs else 1; nombre = f"v{n:04d}"
    d = config.VERSIONES / nombre; d.mkdir(); meta["version"] = nombre
    np.savez_compressed(d / "cabeza.npz", **arr); (d / "meta.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")
    for viejo in vs[:-(config.MAX_VERSIONES - 1)] if len(vs) >= config.MAX_VERSIONES else []:
        if viejo != activa(): [f.unlink() for f in (config.VERSIONES / viejo).iterdir()]; (config.VERSIONES / viejo).rmdir()
    return nombre

def activa():
    p = config.MODELOS / "actual.json"
    return json.loads(p.read_text())["version"] if p.exists() else None

def activar(nombre):
    if not (config.VERSIONES / nombre / "cabeza.npz").exists(): raise KeyError(nombre)
    (config.MODELOS / "actual.json").write_text(json.dumps({"version": nombre}))

def cargar(nombre):
    d = config.VERSIONES / nombre
    return Cabeza(np.load(d / "cabeza.npz", allow_pickle=False), json.loads((d / "meta.json").read_text(encoding="utf-8")))

_cache = {}
def cargar_actual():
    v = activa()
    if v is None: return None
    if v not in _cache: _cache.clear(); _cache[v] = cargar(v)
    return _cache[v]

def listar():
    out = []
    for v in _versiones():
        m = json.loads((config.VERSIONES / v / "meta.json").read_text(encoding="utf-8"))
        out.append({"version": v, "fecha": m["fecha"], "fotos": m["fotos"], "clases": list(m["clases"]), "metricas": m["metricas"], "activa": v == activa()})
    return out

def entrenar_y_publicar(ds, forzar=False):
    """Entrena una versión nueva. La publica solo si no es claramente peor que la activa."""
    arr, meta = entrenar(ds); nueva = guardar(arr, meta)
    previa = cargar_actual(); motivo = "primera versión"; publicar = True
    if previa is not None:
        a, b = previa.meta.get("metricas"), meta.get("metricas")
        if a and b and b["f1_macro"] < a["f1_macro"] - 0.02 and not forzar:
            publicar, motivo = False, f"F1 {b['f1_macro']} < {a['f1_macro']} de {previa.version}: quedó como candidata, no activa"
        else: motivo = "no es peor que la activa"
    if publicar: activar(nueva); _cache.clear()
    return {"version": nueva, "publicada": publicar, "motivo": motivo, "meta": meta}

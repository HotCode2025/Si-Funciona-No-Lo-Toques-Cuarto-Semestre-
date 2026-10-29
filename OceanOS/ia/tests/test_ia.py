import io, time
import numpy as np
import pytest
from PIL import Image, ImageFilter
from fastapi.testclient import TestClient

from oceanos_ia import calidad, config, huella, modelo
from oceanos_ia.api import app

rng = np.random.default_rng(7)
def jpg(im, **kw):
    b = io.BytesIO(); im.save(b, "JPEG", **kw); return b.getvalue()
def escena(seed, w=640, h=480):
    r = np.random.default_rng(seed); base = r.integers(0, 255, (h // 16, w // 16, 3), dtype=np.uint8)
    return Image.fromarray(base).resize((w, h), Image.BICUBIC)

# ---------- calidad y huella ----------
def test_calidad_detecta_oscura_borrosa_y_chica():
    assert not calidad.evaluar(Image.new("RGB", (800, 600), (3, 3, 5)))["ok"]
    assert any("borrosa" in p for p in calidad.evaluar(escena(1).filter(ImageFilter.GaussianBlur(14)))["problemas"])
    assert any("chica" in p for p in calidad.evaluar(escena(1, 200, 150))["problemas"])
    nitida = Image.fromarray(rng.integers(0, 255, (480, 640, 3), dtype=np.uint8))
    assert calidad.evaluar(nitida)["ok"]

def test_huella_reconoce_la_misma_foto_recomprimida():
    a = escena(3); b = Image.open(io.BytesIO(jpg(a.resize((320, 240)), quality=50)))
    assert huella.hamming(huella.dhash(a), huella.dhash(b)) <= config.DUP_HAMMING
    assert huella.hamming(huella.dhash(a), huella.dhash(escena(4))) > 12

# ---------- entrenamiento ----------
def _dataset(ruido=0.9, barajar=False, grupos=4, por_grupo=10, clases=("a", "b", "c")):
    r = np.random.default_rng(1); D = 1280
    cent = {c: (lambda v: v / np.linalg.norm(v))(r.normal(size=D)) for c in clases}
    E, y, g = [], [], []
    for c in clases:
        for k in range(grupos):
            off = r.normal(size=D) * 0.01
            for _ in range(por_grupo):
                v = cent[c] + off + r.normal(size=D) * ruido / np.sqrt(D) * 0.25; E.append(v / np.linalg.norm(v)); y.append(c); g.append(f"{c}{k}")
    E = np.array(E, "f4"); y = np.array(y)
    if barajar: y = r.permutation(y)
    return {"ids": list(range(len(y))), "y": y, "g": np.array(g), "w": np.ones(len(y), "f4"), "E": E, "F": E.copy()}

def test_entrena_valida_y_calibra():
    arr, meta = modelo.entrenar(_dataset())
    assert meta["metricas"]["f1_macro"] > 0.9
    assert all(c["validada"] for c in meta["clases"].values())
    assert meta["umbral_desconocido"] is not None and 0.5 <= meta["temperatura"] <= 6

def test_clase_con_pocas_fotos_no_entra_al_modelo():
    ds = _dataset(); ds["y"] = ds["y"].astype(object); ds["y"][:3] = "rara"; ds["y"] = ds["y"].astype(str)
    _, meta = modelo.entrenar(ds)
    assert "rara" not in meta["clases"] and "rara" in meta["en_recoleccion"]

def test_sin_datos_suficientes_avisa():
    ds = _dataset(clases=("a",))
    with pytest.raises(modelo.SinDatos): modelo.entrenar(ds)

def test_la_compuerta_no_publica_un_modelo_peor():
    r1 = modelo.entrenar_y_publicar(_dataset()); assert r1["publicada"]
    r2 = modelo.entrenar_y_publicar(_dataset(barajar=True))     # etiquetas con ruido: debe ser peor
    assert not r2["publicada"] and modelo.activa() == r1["version"]
    modelo.activar(r2["version"]); assert modelo.activa() == r2["version"]   # y se puede forzar / volver atrás
    modelo.activar(r1["version"])

# ---------- API de punta a punta ----------
@pytest.fixture(scope="module")
def cli():
    with TestClient(app) as c: yield c

def test_api_analiza_etiqueta_y_reentrena(cli):
    assert cli.get("/salud").json()["ok"]
    assert cli.post("/analizar", files={"foto": ("x.jpg", b"no es una imagen", "image/jpeg")}).status_code == 422

    r = cli.post("/analizar", files={"foto": ("f.jpg", jpg(escena(11)), "image/jpeg")}, data={"lat": "-42.77", "lng": "-64.86"}).json()
    for k in ("id", "calidad", "duplicado", "exif", "prediccion", "pista_general", "puede_autoverificar", "modelo"):
        assert k in r
    assert r["puede_autoverificar"] is False                       # apagado por defecto: el sistema paga con ese número
    assert cli.get(r["imagen"]).status_code == 200
    r2 = cli.post("/analizar", files={"foto": ("f.jpg", jpg(escena(11)), "image/jpeg")}).json()
    assert r2["duplicado"] and r2["id"] == r["id"]

    assert cli.post(f"/fotos/{r['id']}/etiqueta", json={"etiqueta": "unicornio"}).status_code == 422
    uno = cli.post(f"/fotos/{r['id']}/etiqueta", json={"etiqueta": "orca", "fuente": "usuario", "quien": "ana"}).json()
    assert uno["entra_a_entrenar"] is False                        # una sola persona (peso 0.5) no alcanza
    dos = cli.post(f"/fotos/{r['id']}/etiqueta", json={"etiqueta": "orca", "fuente": "verificador", "quien": "beto"}).json()
    assert dos["entra_a_entrenar"] and dos["consenso"] == "orca"
    cont = cli.post(f"/fotos/{r['id']}/etiqueta", json={"etiqueta": "delfin", "fuente": "usuario", "quien": "carla"}).json()
    assert cont["consenso"] == "orca"                              # un voto en contra no la tumba

    assert cli.post("/entrenar").status_code == 401 or cli.post("/entrenar").status_code == 403
    assert cli.post("/entrenar", headers={"x-admin-token": "mal"}).status_code == 401
    assert cli.post("/entrenar", headers={"x-admin-token": "secreto-de-prueba"}).status_code == 200
    for _ in range(120):
        est = cli.get("/entrenar/estado").json()
        if est["estado"] != "entrenando": break
        time.sleep(1)
    assert est["estado"] == "listo", est
    m = cli.get("/modelo").json()
    assert m["version"] and m["dataset"]["fotos_de_gente"] == 1 and m["dataset"]["clases"]["orca"]["fotos"] >= 37

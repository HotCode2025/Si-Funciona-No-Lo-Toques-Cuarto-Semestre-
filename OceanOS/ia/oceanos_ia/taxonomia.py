"""Taxonomía editable (taxonomia.json) y la "pista general" que sale de las 1000 clases de ImageNet."""
import json
from . import config

def cargar():
    return json.loads(config.TAXONOMIA.read_text(encoding="utf-8"))

def por_id(clase_id):
    return next((t for t in cargar() if t["id"] == clase_id), None)

def ficha(clase_id):
    t = por_id(clase_id)
    return t or {"id": clase_id, "nombre": clase_id.replace("_", " ").capitalize(), "cientifico": None, "tipo": "fauna"}

# Grupos amplios: sirven cuando el modelo propio no reconoce la foto. Es una
# señal más débil y se muestra como tal ("parece un mamífero marino").
GRUPOS = {
    "mamifero_marino": ("mamífero marino", {147: "ballena", 148: "orca", 149: "dugongo", 150: "lobo marino"}),
    "tiburon_raya":    ("tiburón o raya", {2: "tiburón blanco", 3: "tiburón tigre", 4: "tiburón martillo", 5: "raya eléctrica", 6: "raya"}),
    "ave":             ("ave", {143: "ostrero", 144: "pelícano", 145: "pingüino", 146: "albatros", 141: "chorlo", 142: "playero", 130: "flamenco"}),
    "pez":             ("pez", {0: "tenca", 1: "pez dorado", 389: "barracuda", 390: "anguila", 391: "salmón", 392: "pez roca", 393: "pez payaso", 394: "esturión", 396: "pez león", 397: "pez globo"}),
    "invertebrado":    ("invertebrado marino", {107: "medusa", 108: "anémona", 109: "coral", 327: "estrella de mar", 328: "erizo", 329: "pepino de mar", 118: "cangrejo", 121: "langosta"}),
    "paisaje_costero": ("paisaje costero", {978: "costa", 977: "banco de arena", 976: "promontorio", 973: "arrecife", 975: "orilla", 972: "acantilado"}),
}
# Cuando la pista es muy específica, sugiere esa clase de la taxonomía.
PISTA_A_CLASE = {147: "ballena", 148: "orca", 150: "lobo_marino", 145: "pinguino_magallanes",
                 2: "tiburon", 3: "tiburon", 4: "tiburon", 144: "aves_marinas", 146: "aves_marinas", 143: "aves_marinas"}

def pista(probs):
    """probs: softmax de ImageNet (1000,). Devuelve el grupo dominante y los parecidos."""
    mejor = None
    for gid, (nombre, items) in GRUPOS.items():
        total = float(sum(probs[i] for i in items))
        if total >= 0.12 and (mejor is None or total > mejor["prob"]):
            parecidos = sorted(({"nombre": n, "prob": round(float(probs[i]), 3), "indice": i} for i, n in items.items() if probs[i] >= 0.02),
                               key=lambda d: -d["prob"])[:3]
            mejor = {"grupo": gid, "nombre": nombre, "prob": round(total, 3), "parecidos": parecidos}
    return mejor

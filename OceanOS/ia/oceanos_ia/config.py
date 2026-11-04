"""Configuración. Todo se puede cambiar con variables de entorno OCEANOS_IA_*."""
import os
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DATOS = Path(os.environ.get("OCEANOS_IA_DATOS", RAIZ / "datos"))
MODELOS = Path(os.environ.get("OCEANOS_IA_MODELOS", RAIZ / "modelos"))
VERSIONES = MODELOS / "versiones"
ENCODER_ONNX = RAIZ / "modelos" / "encoder_efficientnet_b0.onnx"
IMAGENET_CLASES = RAIZ / "modelos" / "imagenet_clases.txt"
TAXONOMIA = RAIZ / "oceanos_ia" / "taxonomia.json"
SEMILLA = RAIZ / "datos" / "semilla" / "semilla_embeddings.npz"

def _f(nombre, defecto): return float(os.environ.get(f"OCEANOS_IA_{nombre}", defecto))
def _i(nombre, defecto): return int(os.environ.get(f"OCEANOS_IA_{nombre}", defecto))

# --- Entrenamiento ---
MIN_EJEMPLOS = _i("MIN_EJEMPLOS", 8)      # fotos por clase para entrar al modelo
PESOS_FUENTE = {"semilla": 2.0, "verificador": 1.0, "usuario": 0.5}
CONSENSO_PESO_MIN = 1.0                   # peso mínimo de la etiqueta ganadora
CONSENSO_SHARE_MIN = 0.6                  # y que gane con al menos este % del total
MAX_VERSIONES = 12

# --- Predicción ---
UMBRAL_SUGERIR = _f("UMBRAL_SUGERIR", 0.55)   # debajo: "no estoy seguro"
UMBRAL_AUTO = _f("UMBRAL_AUTO", 0.92)         # mínimo para que cuente como confianza del reporte
# El sistema verifica y PAGA solo con la confianza de la IA. Por eso queda
# apagado salvo que se active a propósito, y aun así exige un modelo validado.
AUTOVERIFICAR = bool(_i("AUTOVERIFICAR", 0))

# --- Fotos ---
MAX_BYTES = _i("MAX_BYTES", 15 * 1024 * 1024)
MIN_LADO = 320
DUP_HAMMING = 6          # bits de diferencia en el dHash para llamarla duplicada
DUP_COSENO = 0.985
EXIF_KM_MAX = _f("EXIF_KM_MAX", 5)

# --- Seguridad ---
TOKEN_ADMIN = os.environ.get("OCEANOS_IA_TOKEN", "")   # vacío = reentrenar por API deshabilitado
ORIGENES = [o for o in os.environ.get(
    "OCEANOS_IA_ORIGENES",
    "http://localhost:5173,http://localhost:4173,https://localhost,capacitor://localhost,http://localhost").split(",") if o]

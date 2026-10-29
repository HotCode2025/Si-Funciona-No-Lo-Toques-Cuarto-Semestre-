"""EfficientNet-B0 en ONNX: foto -> embedding de 1280 números (+ pista de ImageNet)."""
import threading
import numpy as np
import onnxruntime as ort
from PIL import Image
from . import config

_MEDIA = np.array([0.485, 0.456, 0.406], "f")
_STD = np.array([0.229, 0.224, 0.225], "f")
TAM = 224

class Encoder:
    def __init__(self):
        op = ort.SessionOptions(); op.intra_op_num_threads = 2
        self.sesion = ort.InferenceSession(str(config.ENCODER_ONNX), op, providers=["CPUExecutionProvider"])
        self._lock = threading.Lock()

    @staticmethod
    def preparar(im: Image.Image, voltear=False):
        """Letterbox a 224x224: no recorta (un animal en el borde sigue a la vista)."""
        w, h = im.size; s = TAM / max(w, h)
        im = im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.BICUBIC)
        if voltear: im = im.transpose(Image.FLIP_LEFT_RIGHT)
        lienzo = Image.new("RGB", (TAM, TAM), tuple((_MEDIA * 255).astype(int)))
        lienzo.paste(im, ((TAM - im.width) // 2, (TAM - im.height) // 2))
        return ((np.asarray(lienzo, "f") / 255 - _MEDIA) / _STD).transpose(2, 0, 1)

    def embed(self, im: Image.Image):
        """-> (emb, emb_volteada, probs_imagenet). Los embeddings salen normalizados (norma 1)."""
        lote = np.stack([self.preparar(im), self.preparar(im, True)]).astype("f")
        with self._lock:
            car, logits = self.sesion.run(None, {"imagen": lote})
        car = car / (np.linalg.norm(car, axis=1, keepdims=True) + 1e-9)
        z = logits[0] - logits[0].max(); p = np.exp(z); p /= p.sum()
        return car[0].astype("f"), car[1].astype("f"), p

_enc = None
def encoder():
    global _enc
    if _enc is None: _enc = Encoder()
    return _enc

"""
Construye modelos/encoder_efficientnet_b0.onnx a partir de los pesos abiertos
de EfficientNet-B0 (Apache-2.0, lukemelas/EfficientNet-PyTorch), SIN PyTorch.

Se corre una sola vez; el .onnx resultante ya viene en el repo.
    python construir_encoder.py [ruta_a_efficientnet-b0.pth]

Salidas del modelo: `caracteristicas` [N,1280] (el "embedding" sobre el que se
entrena) y `logits` [N,1000] (las clases de ImageNet, usadas como pista).
"""
import io, math, os, pickle, struct, sys, urllib.request
from collections import OrderedDict
import numpy as np
import onnx
from onnx import TensorProto, helper, numpy_helper

URL = "https://github.com/lukemelas/EfficientNet-PyTorch/releases/download/1.0/efficientnet-b0-355c32eb.pth"
SALIDA = os.path.join(os.path.dirname(__file__), "modelos", "encoder_efficientnet_b0.onnx")


# ---------- lector del formato .pth antiguo (sin torch) ----------
class _Almacen:
    def __init__(self, tipo, clave): self.tipo, self.clave, self.datos = tipo, clave, None
class _Tensor:
    def __init__(self, alm, off, size, stride): self.alm, self.off, self.size, self.stride = alm, off, tuple(size), tuple(stride)

def _rebuild(alm, off, size, stride, *_): return _Tensor(alm, off, size, stride)

class _Lector(pickle.Unpickler):
    almacenes = {}
    def find_class(self, mod, nombre):
        if nombre == "_rebuild_tensor_v2": return _rebuild
        if mod == "collections" and nombre == "OrderedDict": return OrderedDict
        if mod == "torch" and nombre.endswith("Storage"): return nombre
        raise pickle.UnpicklingError(f"no permitido: {mod}.{nombre}")
    def persistent_load(self, pid):
        _, tipo, clave = pid[0], pid[1], pid[2]
        return self.almacenes.setdefault(clave, _Almacen(tipo, clave))

DTYPES = {"FloatStorage": np.float32, "LongStorage": np.int64, "DoubleStorage": np.float64}

def leer_pth(ruta):
    with open(ruta, "rb") as f:
        pickle.load(f); pickle.load(f); pickle.load(f)          # magia, versión, sys_info
        lector = _Lector(f); lector.almacenes = {}
        raiz = lector.load()
        claves = pickle.load(f)
        for k in claves:
            alm = lector.almacenes[k]
            n = struct.unpack("<q", f.read(8))[0]
            dt = np.dtype(DTYPES[alm.tipo])
            alm.datos = np.frombuffer(f.read(n * dt.itemsize), dtype=dt)
    out = {}
    for nombre, t in raiz.items():
        base = t.alm.datos[t.off:]
        isz = base.itemsize
        out[nombre] = np.lib.stride_tricks.as_strided(base, t.size, [s * isz for s in t.stride]).copy()
    return out


# ---------- grafo ONNX ----------
class G:
    def __init__(self): self.nodos, self.ini, self.n = [], [], 0
    def nom(self, p): self.n += 1; return f"{p}_{self.n}"
    def const(self, arr, p="w"):
        nombre = self.nom(p); self.ini.append(numpy_helper.from_array(np.asarray(arr), nombre)); return nombre
    def op(self, tipo, ent, **atr):
        sal = self.nom(tipo.lower()); self.nodos.append(helper.make_node(tipo, ent, [sal], **atr)); return sal

    def pad_same(self, x, ih, k, s):
        total = max((math.ceil(ih / s) - 1) * s + k - ih, 0)
        a, b = total // 2, total - total // 2
        if total == 0: return x
        pads = self.const(np.array([0, 0, a, a, 0, 0, b, b], dtype=np.int64), "pads")
        return self.op("Pad", [x, pads], mode="constant")

    def conv(self, x, w, ih, k, s, grupos=1, sesgo=None, same=True):
        if same: x = self.pad_same(x, ih, k, s)
        ent = [x, self.const(w)] + ([self.const(sesgo)] if sesgo is not None else [])
        return self.op("Conv", ent, kernel_shape=[k, k], strides=[s, s], group=grupos, pads=[0, 0, 0, 0])

    def bn(self, x, P, pref):
        return self.op("BatchNormalization", [x] + [self.const(P[f"{pref}.{n}"]) for n in ("weight", "bias", "running_mean", "running_var")], epsilon=1e-3)

    def swish(self, x): return self.op("Mul", [x, self.op("Sigmoid", [x])])


# (repeticiones, kernel, stride, expansión, entrada, salida) de EfficientNet-B0
BLOQUES = [(1,3,1,1,32,16),(2,3,2,6,16,24),(2,5,2,6,24,40),(3,3,2,6,40,80),(3,5,1,6,80,112),(4,5,2,6,112,192),(1,3,1,6,192,320)]

def construir(P, tam=224):
    g = G()
    x = "imagen"
    ih = tam
    x = g.conv(x, P["_conv_stem.weight"], ih, 3, 2); ih = math.ceil(ih / 2)
    x = g.swish(g.bn(x, P, "_bn0"))
    i = 0
    for rep, k, s, e, cin, cout in BLOQUES:
        for r in range(rep):
            entrada, stride, cin_b = x, (s if r == 0 else 1), (cin if r == 0 else cout)
            pref = f"_blocks.{i}"
            if e != 1:
                x = g.conv(x, P[f"{pref}._expand_conv.weight"], ih, 1, 1, same=False)
                x = g.swish(g.bn(x, P, f"{pref}._bn0"))
            ch = P[f"{pref}._depthwise_conv.weight"].shape[0]
            x = g.conv(x, P[f"{pref}._depthwise_conv.weight"], ih, k, stride, grupos=ch)
            ih = math.ceil(ih / stride)
            x = g.swish(g.bn(x, P, f"{pref}._bn1"))
            se = g.op("GlobalAveragePool", [x])
            se = g.conv(se, P[f"{pref}._se_reduce.weight"], 1, 1, 1, sesgo=P[f"{pref}._se_reduce.bias"], same=False)
            se = g.swish(se)
            se = g.conv(se, P[f"{pref}._se_expand.weight"], 1, 1, 1, sesgo=P[f"{pref}._se_expand.bias"], same=False)
            x = g.op("Mul", [x, g.op("Sigmoid", [se])])
            x = g.conv(x, P[f"{pref}._project_conv.weight"], ih, 1, 1, same=False)
            x = g.bn(x, P, f"{pref}._bn2")
            if stride == 1 and cin_b == cout: x = g.op("Add", [x, entrada])
            i += 1
    x = g.conv(x, P["_conv_head.weight"], ih, 1, 1, same=False)
    x = g.swish(g.bn(x, P, "_bn1"))
    x = g.op("GlobalAveragePool", [x])
    car = g.op("Flatten", [x], axis=1)
    g.nodos.append(helper.make_node("Identity", [car], ["caracteristicas"]))
    g.nodos.append(helper.make_node("Gemm", ["caracteristicas", g.const(P["_fc.weight"]), g.const(P["_fc.bias"])], ["logits"], transB=1))

    grafo = helper.make_graph(
        g.nodos, "efficientnet_b0",
        [helper.make_tensor_value_info("imagen", TensorProto.FLOAT, ["N", 3, tam, tam])],
        [helper.make_tensor_value_info("caracteristicas", TensorProto.FLOAT, ["N", 1280]),
         helper.make_tensor_value_info("logits", TensorProto.FLOAT, ["N", 1000])],
        initializer=g.ini)
    modelo = helper.make_model(grafo, opset_imports=[helper.make_opsetid("", 13)])
    modelo.ir_version = 8
    onnx.checker.check_model(modelo)
    return modelo


if __name__ == "__main__":
    ruta = sys.argv[1] if len(sys.argv) > 1 else "/tmp/efficientnet-b0.pth"
    if not os.path.exists(ruta):
        print("Descargando pesos…"); urllib.request.urlretrieve(URL, ruta)
    P = leer_pth(ruta)
    print(len(P), "tensores leídos")
    onnx.save(construir(P), SALIDA)
    print("OK ->", SALIDA, round(os.path.getsize(SALIDA) / 1e6, 1), "MB")

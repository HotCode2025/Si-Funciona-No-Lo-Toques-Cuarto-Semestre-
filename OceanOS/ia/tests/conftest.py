import os, tempfile
_t = tempfile.mkdtemp(prefix="oceanos_ia_")
os.environ["OCEANOS_IA_DATOS"] = os.path.join(_t, "datos")
os.environ["OCEANOS_IA_MODELOS"] = os.path.join(_t, "modelos")
os.environ["OCEANOS_IA_TOKEN"] = "secreto-de-prueba"

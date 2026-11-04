"""API HTTP. Arranque:  uvicorn oceanos_ia.api:app --port 8000"""
from typing import Optional

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from . import __version__, config, modelo, taxonomia
from .servicio import FotoInvalida, Servicio

app = FastAPI(title="OceanOS IA", version=__version__)
app.add_middleware(CORSMiddleware, allow_origins=config.ORIGENES, allow_methods=["GET", "POST"], allow_headers=["*"])
_svc = None
def svc():
    global _svc
    if _svc is None: _svc = Servicio()
    return _svc

class Etiqueta(BaseModel):
    etiqueta: str                      # id de la taxonomía, o "ninguna"
    fuente: str = "usuario"            # "usuario" (quien subió la foto) | "verificador" (la comunidad)
    quien: str = "anonimo"             # id de la persona: evita que una sola cuente dos veces
    grupo: Optional[str] = None        # id del reporte: agrupa fotos del mismo evento para validar bien

@app.get("/salud")
def salud():
    return {"ok": True, "version": __version__, "modelo": modelo.activa()}

@app.post("/analizar")
async def analizar(foto: UploadFile = File(...), lat: Optional[float] = Form(None), lng: Optional[float] = Form(None), grupo: Optional[str] = Form(None)):
    datos = await foto.read(config.MAX_BYTES + 1)
    try:
        return svc().analizar(datos, lat, lng, grupo)
    except FotoInvalida as e:
        raise HTTPException(422, str(e))

@app.get("/fotos/{foto_id}/imagen")
def imagen(foto_id: str):
    f = svc().almacen.foto(foto_id)
    if not f or not f["ruta"]: raise HTTPException(404, "No existe esa foto")
    return FileResponse(f["ruta"], media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})

@app.post("/fotos/{foto_id}/etiqueta")
def etiquetar(foto_id: str, e: Etiqueta):
    try:
        return svc().etiquetar(foto_id, e.etiqueta, e.fuente, e.quien, e.grupo)
    except KeyError:
        raise HTTPException(404, "No existe esa foto")
    except ValueError as err:
        raise HTTPException(422, str(err))

@app.get("/taxonomia")
def tax(): return taxonomia.cargar()

@app.get("/modelo")
def estado(): return svc().estado_modelo()

def _admin(token):
    if not config.TOKEN_ADMIN: raise HTTPException(403, "Reentrenar por API está deshabilitado (definí OCEANOS_IA_TOKEN)")
    if token != config.TOKEN_ADMIN: raise HTTPException(401, "Token inválido")

@app.post("/entrenar")
def entrenar(forzar: bool = False, x_admin_token: str = Header(default="")):
    _admin(x_admin_token); return svc().entrenar(forzar)

@app.get("/entrenar/estado")
def estado_entrenamiento(): return svc().entrenamiento

@app.post("/modelo/activar/{version}")
def activar(version: str, x_admin_token: str = Header(default="")):
    _admin(x_admin_token)
    try: modelo.activar(version)
    except KeyError: raise HTTPException(404, "No existe esa versión")
    modelo._cache.clear(); return {"activa": version}

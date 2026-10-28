from fastapi import FastAPI
from fastapi.responses import HTMLResponse
import store

app = FastAPI()

# Primera ruta (Principal)
@app.get("/")
def get_list():
    return [1, 2, 3]

# Segunda ruta (Contact) con respuesta HTML personalizada
@app.get("/contact", response_class=HTMLResponse)
def get_contact(): 
    return """
    <html>
        <head>
            <title>Mi Sitio Web</title>
        </head>
        <body>
            <h1>Soy un sitio web</h1>
            <p>Soy un párrafo para que tu leas</p>
        </body>
    </html>
    """

# Tercera ruta para obtener las razas usando el módulo store
@app.get("/razas")
def get_razas():
    return store.get_razas()
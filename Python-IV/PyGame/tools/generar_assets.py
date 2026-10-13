"""Genera las imágenes del juego a partir de los SVG y de código.

Uso:   python tools/generar_assets.py
Necesita:  pip install pillow cairosvg

Crea en assets_1/images/:
  nave_jugador.png, nave_enemiga1.png, nave_enemiga2.png   (desde los SVG)
  lase1.png, regularExplosion000..008.png                  (láser y explosión)
  fondo2.jfif, fondo3.jpg, 001.jfif, inicio/star.png       (fondos, ícono e intro)

Para usar otra nave, reemplazá el SVG en assets_1/svg/ y volvé a ejecutar este script.
"""
import io
import math
import os
import random

import cairosvg
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets_1')
SVG = os.path.join(BASE, 'svg')
IMG = os.path.join(BASE, 'images')

SVG_JUGADOR = 'fighter-aircraft-icon-by-Vexels.svg'
SVG_ENEMIGO = 'nave_combate_6507108_37862.svg'


def renderizar_svg(nombre, ancho):
    datos = cairosvg.svg2png(url=os.path.join(SVG, nombre), output_width=ancho)
    imagen = Image.open(io.BytesIO(datos)).convert('RGBA')
    return imagen.crop(imagen.getbbox())   # recorta el margen transparente


def escalar(imagen, ancho=None, alto=None):
    if alto:
        ancho = round(imagen.width * alto / imagen.height)
    else:
        alto = round(imagen.height * ancho / imagen.width)
    return imagen.resize((ancho, alto), Image.LANCZOS)


def teñir(imagen, color):
    """Multiplica los colores por `color` conservando la transparencia."""
    r, g, b, a = imagen.split()
    rgb = ImageChops.multiply(Image.merge('RGB', (r, g, b)), Image.new('RGB', imagen.size, color))
    return Image.merge('RGBA', (*rgb.split(), a))


def naves():
    jugador = escalar(renderizar_svg(SVG_JUGADOR, 1200), alto=120)
    jugador.save(os.path.join(IMG, 'nave_jugador.png'))

    combate = escalar(renderizar_svg(SVG_ENEMIGO, 1320), ancho=330)
    combate.save(os.path.join(IMG, 'nave_enemiga1.png'))

    caza = renderizar_svg(SVG_JUGADOR, 1200).rotate(180, expand=True)   # mira hacia abajo
    caza = teñir(escalar(caza, alto=112), (170, 140, 210))
    caza.save(os.path.join(IMG, 'nave_enemiga2.png'))
    return jugador


def laser():
    imagen = Image.new('RGBA', (16, 44), (0, 0, 0, 0))
    d = ImageDraw.Draw(imagen)
    d.rounded_rectangle((3, 2, 12, 41), radius=4, fill=(40, 120, 255, 255))
    glow = imagen.filter(ImageFilter.GaussianBlur(2.5))
    d = ImageDraw.Draw(glow)
    d.rounded_rectangle((6, 4, 9, 39), radius=2, fill=(220, 240, 255, 255))
    glow.save(os.path.join(IMG, 'lase1.png'))


def explosion(cantidad=9, tamano=140):
    azar = random.Random(5)
    chispas = [(azar.uniform(0, 2 * math.pi), azar.uniform(0.6, 1.1)) for _ in range(16)]
    centro = tamano / 2
    for i in range(cantidad):
        t = i / (cantidad - 1)
        radio = tamano * 0.10 + tamano * 0.36 * t ** 0.6
        alfa = int(255 * (1 - 0.9 * t ** 2))
        capa = Image.new('RGBA', (tamano, tamano), (0, 0, 0, 0))
        d = ImageDraw.Draw(capa)
        for k, color in enumerate([(255, 70, 0), (255, 150, 0), (255, 220, 90), (255, 255, 235)]):
            r = radio * (1 - 0.22 * k)
            d.ellipse((centro - r, centro - r, centro + r, centro + r), fill=color + (alfa,))
        for angulo, dist in chispas:
            x = centro + math.cos(angulo) * radio * dist * 1.2
            y = centro + math.sin(angulo) * radio * dist * 1.2
            d.ellipse((x - 2, y - 2, x + 2, y + 2), fill=(255, 220, 120, alfa))
        capa = capa.filter(ImageFilter.GaussianBlur(1.6))
        capa.save(os.path.join(IMG, f'regularExplosion0{i:02d}.png'))


def fondo_espacio(destino, semilla, tonos, formato='JPEG'):
    ancho, alto = 1700, 1000
    azar = random.Random(semilla)
    mitad = (ancho // 2, alto // 2)
    nebulosa = Image.new('RGB', mitad, (4, 6, 16))
    d = ImageDraw.Draw(nebulosa)
    for _ in range(16):
        x, y, r = azar.randint(0, mitad[0]), azar.randint(0, mitad[1]), azar.randint(60, 200)
        d.ellipse((x - r, y - r, x + r, y + r), fill=azar.choice(tonos))
    nebulosa = nebulosa.filter(ImageFilter.GaussianBlur(55)).resize((ancho, alto), Image.LANCZOS)
    fondo = ImageChops.multiply(nebulosa, Image.new('RGB', (ancho, alto), (255, 255, 255)))
    d = ImageDraw.Draw(fondo)
    for _ in range(950):
        x, y = azar.randint(0, ancho - 1), azar.randint(0, alto - 1)
        brillo = azar.randint(110, 255)
        color = azar.choice([(brillo, brillo, brillo), (brillo, brillo, 255), (255, 240, brillo)])
        r = azar.choice([0.6, 0.8, 1.0, 1.3, 1.8])
        d.ellipse((x - r, y - r, x + r, y + r), fill=color)
    fondo.save(os.path.join(IMG, destino), format=formato, quality=90)


def icono(jugador):
    lienzo = Image.new('RGB', (64, 64), (6, 8, 20))
    nave = escalar(jugador, alto=56)
    lienzo.paste(nave, ((64 - nave.width) // 2, 4), nave)
    lienzo.save(os.path.join(IMG, '001.jfif'), format='JPEG', quality=92)


def intro():
    lienzo = Image.new('RGB', (1700, 1000), (0, 0, 0))
    d = ImageDraw.Draw(lienzo)
    rutas = ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
             'C:/Windows/Fonts/arialbd.ttf', '/Library/Fonts/Arial Bold.ttf']
    fuente = ImageFont.load_default(size=52)
    for ruta in rutas:
        if os.path.exists(ruta):
            fuente = ImageFont.truetype(ruta, 52)
            break
    lineas = ["Hace mucho tiempo, en una galaxia", "muy, muy lejana..."]
    for i, linea in enumerate(lineas):
        ancho = d.textlength(linea, font=fuente)
        d.text(((1700 - ancho) / 2, 440 + i * 80), linea, font=fuente, fill=(75, 213, 238))
    lienzo.save(os.path.join(IMG, 'inicio', 'star.png'))


if __name__ == '__main__':
    os.makedirs(os.path.join(IMG, 'inicio'), exist_ok=True)
    nave_jugador = naves()
    laser()
    explosion()
    fondo_espacio('fondo2.jfif', 11, [(20, 40, 110), (60, 30, 110), (10, 70, 120)])
    fondo_espacio('fondo3.jpg', 23, [(110, 30, 60), (90, 50, 20), (50, 20, 100)])
    icono(nave_jugador)
    intro()
    print('Listo: imágenes generadas en', os.path.normpath(IMG))

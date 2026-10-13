import math

from constantes import (
    SCREEN_WIDTH, SCREEN_HEIGHT, ENERGIA_MAXIMA, COOLDOWN_LASER_MS,
    FRAMES_POR_IMAGEN_EXPLOSION,
)
from elementos import Jefe, ItemEnergia, LaserEnemigo
from explosion import Explosion
from personaje import Personaje, Enemigo


def test_dano_y_muerte():
    p = Personaje(100, 100)
    assert p.recibir_dano(30) is True
    assert p.energia == ENERGIA_MAXIMA - 30
    assert p.recibir_dano(1000) is False
    assert p.energia == 0


def test_curar_no_supera_el_maximo():
    p = Personaje(100, 100)
    p.recibir_dano(20)
    p.curar(5)
    assert p.energia == ENERGIA_MAXIMA - 15
    p.curar(1000)
    assert p.energia == ENERGIA_MAXIMA


def test_no_puede_salir_de_la_pantalla():
    p = Personaje(5, 5)
    p.mover(-1000, -1000)
    assert p.shape.left == 0 and p.shape.top == 0
    p.mover(10 ** 5, 10 ** 5)
    assert p.shape.right == SCREEN_WIDTH and p.shape.bottom == SCREEN_HEIGHT


def test_el_movimiento_acepta_decimales_sin_perder_distancia():
    p = Personaje(500, 500)
    x0 = p.shape.x
    for _ in range(100):
        p.mover(3.5, 0)          # 3,5 px por paso durante 100 pasos
    assert p.shape.x - x0 == 350


def test_cooldown_del_laser():
    p = Personaje(100, 100)
    assert p.lanzar_laser(0) is True          # el primer disparo sale enseguida
    assert p.lanzar_laser(COOLDOWN_LASER_MS - 1) is False
    assert p.lanzar_laser(COOLDOWN_LASER_MS) is True
    assert len(p.lasers) == 2


def test_laseres_fuera_de_pantalla_se_descartan():
    p = Personaje(100, 100)
    p.lanzar_laser(0)
    p.lasers[0].rect.bottom = -1
    p.actualizar()
    assert p.lasers == []


def test_explosion_termina():
    e = Explosion(0, 0)
    pasos = 0
    while e.actualizar():
        pasos += 1
        assert pasos < 10_000
    assert pasos == len(e.images) * FRAMES_POR_IMAGEN_EXPLOSION - 1


def test_enemigo_comun_no_dispara_y_el_disparador_si():
    comun = Enemigo(0, 0)
    assert comun.disparar(10 ** 9) is None
    tirador = Enemigo(0, 0, dispara=True)
    assert isinstance(tirador.disparar(10 ** 9), LaserEnemigo)
    assert tirador.disparar(10 ** 9) is None   # recién disparó: espera


def test_velocidad_con_decimales_se_acumula():
    e = Enemigo(0, 0, velocidad=6.5)
    for _ in range(100):
        e.mover()
    assert e.rect.y == 650


def test_hay_mas_de_un_tipo_de_nave_enemiga():
    imagenes = {Enemigo(0, 0).image.get_size() for _ in range(60)}
    assert len(imagenes) == 2


def test_enemigo_sale_de_pantalla():
    e = Enemigo(0, 0)
    assert not e.fuera_de_pantalla()
    e.rect.top = SCREEN_HEIGHT + 1
    assert e.fuera_de_pantalla()


def test_item_cae():
    item = ItemEnergia(50, 50)
    y = item.rect.y
    item.mover()
    assert item.rect.y > y


def test_jefe_entra_dispara_y_muere():
    jefe = Jefe(3)
    ahora = 0
    while jefe.entrando:
        assert jefe.actualizar(ahora) == []
        ahora += 16
    disparos = []
    for _ in range(300):
        ahora += 16
        disparos += jefe.actualizar(ahora)
    assert len(disparos) >= 3 and all(isinstance(d, LaserEnemigo) for d in disparos)
    assert 0 <= jefe.rect.left and jefe.rect.right <= SCREEN_WIDTH

    assert not jefe.derrotado
    for _ in range(jefe.vida_max):
        jefe.recibir_golpe()
    assert jefe.derrotado and jefe.vida == 0


def test_el_modulo_math_esta_disponible_para_la_diagonal():
    assert math.isclose(math.hypot(1, 1), 2 ** 0.5)


def test_si_falta_una_imagen_se_dibuja_una_nave_y_no_un_cuadrado():
    import utilidades
    for nombre in ('nave_jugador.png', 'nave_enemiga1.png', 'nave_enemiga2.png'):
        imagen = utilidades._reemplazo(nombre, None)
        w, h = imagen.get_size()
        assert imagen.get_at((0, 0)).a == 0 and imagen.get_at((w - 1, h - 1)).a == 0   # esquinas transparentes
        assert imagen.get_at((w // 2, h // 2)).a > 0                                   # hay nave en el centro


def test_las_imagenes_y_sonidos_del_proyecto_estan_completos():
    import utilidades
    assert utilidades.verificar_assets() == []

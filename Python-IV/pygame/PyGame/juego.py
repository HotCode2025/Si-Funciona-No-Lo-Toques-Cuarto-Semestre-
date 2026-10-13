"""Controlador del juego: estados (menú, jugando, pausa, game over), entrada, pantalla y sonido.

Las reglas del juego viven en `Partida`; acá solo se decide qué mostrar y a qué hacer caso.
"""
import os

import pygame

from audio import Audio
from constantes import (
    SCREEN_WIDTH, SCREEN_HEIGHT, FPS, PASO_MS, MAX_PASOS_POR_FRAME, TOLERANCIA_PASO_MS,
    IMAGES_PATH, PROLOGO_PATH, MUSICA_FONDO, MUSICA_JEFE, COLOR_BLANCO, COLOR_NEGRO,
    COLOR_ROJO, COLOR_AMARILLO, COLOR_GRIS,
)
from fondo import Fondo
from interfaz import Boton, ListaBotones, texto_centrado
from pantallas import mostrar_imagen_inicial, mostrar_logo, mostrar_prologo
from partida import Partida, EV_MUSICA_JEFE, EV_MUSICA_NORMAL
from records import cargar_record, guardar_record
from utilidades import cargar_fondo, salir, verificar_assets

MENU, JUGANDO, PAUSA, GAME_OVER = 'menu', 'jugando', 'pausa', 'game_over'
CENTRO_X = SCREEN_WIDTH // 2
CENTRO_Y = SCREEN_HEIGHT // 2


class Juego:
    def __init__(self):
        self.faltantes = verificar_assets()
        pygame.init()
        self.screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
        pygame.display.set_caption('Amenaza Fantasma')
        self._poner_icono()
        self.clock = pygame.time.Clock()
        self.audio = Audio()
        self.fondo = Fondo([cargar_fondo('fondo2.jfif'), cargar_fondo('fondo3.jpg')])

        self.f_titulo = pygame.font.Font(None, 130)
        self.f_grande = pygame.font.Font(None, 74)
        self.f_menu = pygame.font.Font(None, 60)
        self.f_hud = pygame.font.Font(None, 36)
        self.f_chica = pygame.font.Font(None, 28)
        self._velo = pygame.Surface((SCREEN_WIDTH, SCREEN_HEIGHT))
        self._velo.fill(COLOR_NEGRO)

        self.lista_menu = ListaBotones(('JUGAR', 'VER PRÓLOGO', 'SALIR'), self.f_menu, CENTRO_X, 520)
        self.lista_pausa = ListaBotones(('CONTINUAR', 'REINICIAR', 'MENÚ'), self.f_menu, CENTRO_X, CENTRO_Y + 10)
        self.lista_game_over = ListaBotones(('JUGAR DE NUEVO', 'MENÚ', 'SALIR'), self.f_menu, CENTRO_X, CENTRO_Y + 200)
        self.btn_reiniciar = Boton('REINICIAR  [R]', (SCREEN_WIDTH - 250, 10, 240, 44), self.f_chica)

        self.record = cargar_record()
        self._avisar_faltantes()
        self.estado = MENU
        self.snapshot = None
        self.nuevo_record = False
        self._acumulador = 0.0
        self.partida = Partida()

    def _avisar_faltantes(self):
        if not self.faltantes:
            return
        print(f"[aviso] Faltan {len(self.faltantes)} archivos en assets_1/ (se usan dibujos de reemplazo):")
        for ruta in self.faltantes:
            print("   -", ruta)

    @staticmethod
    def _poner_icono():
        try:
            pygame.display.set_icon(pygame.image.load(os.path.join(IMAGES_PATH, '001.jfif')))
        except (pygame.error, FileNotFoundError):
            print("[aviso] No se pudo cargar el icono de la ventana.")

    # ================================================================ bucle
    def ejecutar(self):
        mostrar_imagen_inicial(self.screen, os.path.join(IMAGES_PATH, 'inicio', 'star.png'), 5000)
        mostrar_logo(self.screen, os.path.join(IMAGES_PATH, 'logo.jpg'), 3000)
        self.audio.musica(MUSICA_FONDO)

        while True:
            dt = self.clock.tick(FPS)
            eventos = pygame.event.get()
            for evento in eventos:
                if evento.type == pygame.QUIT:
                    salir()
            self._procesar_eventos(eventos)
            for _ in range(self._pasos(dt)):
                self._actualizar()
            self._dibujar()
            pygame.display.flip()

    def _pasos(self, dt_ms):
        """Cuántos pasos de lógica (1/60 s) corresponden al tiempo transcurrido.

        Así el juego va a la misma velocidad aunque la computadora dibuje
        a menos de 60 FPS, y una demora larga no genera una avalancha de pasos.
        """
        self._acumulador = min(self._acumulador + dt_ms, MAX_PASOS_POR_FRAME * PASO_MS)
        pasos = 0
        while self._acumulador >= PASO_MS - TOLERANCIA_PASO_MS:
            self._acumulador -= PASO_MS
            pasos += 1
        return pasos

    @staticmethod
    def _tecla(eventos, *teclas):
        return any(e.type == pygame.KEYDOWN and e.key in teclas for e in eventos)

    def _procesar_eventos(self, eventos):
        {
            MENU: self._eventos_menu,
            JUGANDO: self._eventos_jugando,
            PAUSA: self._eventos_pausa,
            GAME_OVER: self._eventos_game_over,
        }[self.estado](eventos)

    def _actualizar(self):
        """Un paso de lógica (1/60 s)."""
        if self.estado == MENU:
            self.fondo.actualizar()
        elif self.estado == JUGANDO:
            self._actualizar_partida()

    def _dibujar(self):
        {
            MENU: self._dibujar_menu,
            JUGANDO: lambda: self._dibujar_mundo(con_boton=True),
            PAUSA: self._dibujar_pausa,
            GAME_OVER: self._dibujar_game_over,
        }[self.estado]()

    # ============================================================ transiciones
    def _iniciar_partida(self):
        self.partida = Partida()
        self.fondo.cambiar(0)
        self.nuevo_record = False
        self.snapshot = None
        self.estado = JUGANDO
        self.audio.reanudar()
        self.audio.musica(MUSICA_FONDO)

    def _reiniciar(self):
        """Empieza de cero. Si el puntaje que se llevaba era récord, se guarda."""
        self._actualizar_record()
        self._iniciar_partida()

    def _volver_al_menu(self):
        self._actualizar_record()
        self.snapshot = None
        self.estado = MENU
        self.lista_menu.reiniciar()
        self.audio.reanudar()
        self.audio.musica(MUSICA_FONDO)

    def _pausar(self):
        if self.estado != JUGANDO:
            return
        self.snapshot = None
        self.estado = PAUSA
        self.lista_pausa.reiniciar()
        self.audio.pausar()

    def _reanudar(self):
        self.estado = JUGANDO
        self.audio.reanudar()

    def _terminar_partida(self):
        self.estado = GAME_OVER
        self.snapshot = None
        self.nuevo_record = self._actualizar_record()
        self.lista_game_over.reiniciar()
        self.audio.musica(MUSICA_JEFE, repeticiones=0)   # Marcha Imperial

    def _actualizar_record(self):
        """Guarda el puntaje si supera el récord. Devuelve True si lo superó."""
        if self.partida.puntos > self.record:
            self.record = self.partida.puntos
            guardar_record(self.record)
            return True
        return False

    def _reproducir(self, eventos):
        for evento in eventos:
            if evento == EV_MUSICA_JEFE:
                self.audio.musica(MUSICA_JEFE)
            elif evento == EV_MUSICA_NORMAL:
                self.audio.musica(MUSICA_FONDO)
            else:
                self.audio.efecto(evento)

    def _oscurecer(self, alpha):
        self._velo.set_alpha(alpha)
        self.screen.blit(self._velo, (0, 0))

    # ==================================================================== menú
    def _eventos_menu(self, eventos):
        if self._tecla(eventos, pygame.K_ESCAPE):
            salir()
        elegido = self.lista_menu.procesar(eventos)
        if elegido == 0:
            self._iniciar_partida()
        elif elegido == 1:
            mostrar_prologo(self.screen, PROLOGO_PATH)
            pygame.event.clear()
        elif elegido == 2:
            salir()

    def _dibujar_menu(self):
        self.fondo.dibujar(self.screen)
        self._oscurecer(110)
        texto_centrado(self.screen, self.f_titulo, "AMENAZA", COLOR_AMARILLO, 210)
        texto_centrado(self.screen, self.f_titulo, "FANTASMA", COLOR_AMARILLO, 330)
        self.lista_menu.dibujar(self.screen)
        texto_centrado(self.screen, self.f_hud, f"Récord: {self.record}", COLOR_BLANCO, 800)
        if self.faltantes:
            texto_centrado(self.screen, self.f_chica,
                           f"Faltan {len(self.faltantes)} archivos en assets_1/ (mirá la consola)", COLOR_ROJO, 850)
        texto_centrado(self.screen, self.f_chica,
                       "Flechas o WASD: mover   |   Espacio: disparar   |   P o ESC: pausa   |   R: reiniciar",
                       COLOR_GRIS, SCREEN_HEIGHT - 40)

    # ================================================================ partida
    def _eventos_jugando(self, eventos):
        if any(e.type == pygame.WINDOWFOCUSLOST for e in eventos):
            self._pausar()   # si cambiás de ventana, el juego se pausa solo
            return
        if self._tecla(eventos, pygame.K_p, pygame.K_ESCAPE):
            self._pausar()
        elif self._tecla(eventos, pygame.K_r) or any(self.btn_reiniciar.clic(e) for e in eventos):
            self._reiniciar()

    def _leer_direccion(self):
        keys = pygame.key.get_pressed()
        izq = keys[pygame.K_LEFT] or keys[pygame.K_a]
        der = keys[pygame.K_RIGHT] or keys[pygame.K_d]
        arriba = keys[pygame.K_UP] or keys[pygame.K_w]
        abajo = keys[pygame.K_DOWN] or keys[pygame.K_s]
        dx = int(bool(der)) - int(bool(izq))
        dy = int(bool(abajo)) - int(bool(arriba))
        return dx, dy, bool(keys[pygame.K_SPACE])

    def _actualizar_partida(self):
        sonidos = self.partida.actualizar(*self._leer_direccion())
        self._reproducir(sonidos)
        self.fondo.actualizar()
        if self.partida.terminada:
            self._terminar_partida()

    def _dibujar_mundo(self, con_boton):
        p = self.partida
        self.fondo.cambiar(p.nivel - 1)
        self.fondo.dibujar(self.screen)
        p.dibujar(self.screen)
        self.screen.blit(self.f_hud.render(f"Puntos: {p.puntos}", True, COLOR_BLANCO), (10, 50))
        self.screen.blit(self.f_hud.render(f"Nivel: {p.nivel}", True, COLOR_BLANCO), (10, 90))
        self.screen.blit(
            self.f_hud.render(f"Récord: {max(self.record, p.puntos)}", True, COLOR_BLANCO), (10, 130))
        if con_boton:   # solo durante el juego (no en el cuadro congelado de pausa / game over)
            if p.tiempo < p.aviso_hasta:
                texto_centrado(self.screen, self.f_grande, p.aviso, COLOR_AMARILLO, SCREEN_HEIGHT // 3)
            self.btn_reiniciar.dibujar(self.screen)

    def _dibujar_fondo_congelado(self):
        """Pausa y game over muestran el último cuadro de la partida, sin el botón del HUD."""
        if self.snapshot is None:
            self._dibujar_mundo(con_boton=False)
            self.snapshot = self.screen.copy()
        else:
            self.screen.blit(self.snapshot, (0, 0))

    # ==================================================================== pausa
    def _eventos_pausa(self, eventos):
        if self._tecla(eventos, pygame.K_p, pygame.K_ESCAPE):
            self._reanudar()
            return
        if self._tecla(eventos, pygame.K_r):
            self._reiniciar()
            return
        if self._tecla(eventos, pygame.K_m):
            self._volver_al_menu()
            return
        elegido = self.lista_pausa.procesar(eventos)
        if elegido == 0:
            self._reanudar()
        elif elegido == 1:
            self._reiniciar()
        elif elegido == 2:
            self._volver_al_menu()

    def _dibujar_pausa(self):
        self._dibujar_fondo_congelado()
        self._oscurecer(150)
        texto_centrado(self.screen, self.f_titulo, "PAUSA", COLOR_AMARILLO, CENTRO_Y - 130)
        self.lista_pausa.dibujar(self.screen)

    # ================================================================ game over
    def _eventos_game_over(self, eventos):
        if self._tecla(eventos, pygame.K_ESCAPE):
            salir()
        if self._tecla(eventos, pygame.K_r):
            self._reiniciar()
            return
        if self._tecla(eventos, pygame.K_m):
            self._volver_al_menu()
            return
        elegido = self.lista_game_over.procesar(eventos)
        if elegido == 0:
            self._reiniciar()
        elif elegido == 1:
            self._volver_al_menu()
        elif elegido == 2:
            salir()

    def _dibujar_game_over(self):
        self._dibujar_fondo_congelado()
        self._oscurecer(190)
        p = self.partida
        texto_centrado(self.screen, self.f_titulo, "GAME OVER", COLOR_ROJO, CENTRO_Y - 170)
        texto_centrado(self.screen, self.f_menu, "Que la Fuerza te acompañe", COLOR_BLANCO, CENTRO_Y - 90)
        texto_centrado(self.screen, self.f_hud, f"Puntos: {p.puntos}   |   Nivel: {p.nivel}",
                       COLOR_BLANCO, CENTRO_Y - 35)
        if self.nuevo_record:
            texto_centrado(self.screen, self.f_menu, "¡NUEVO RÉCORD!", COLOR_AMARILLO, CENTRO_Y + 25)
        else:
            texto_centrado(self.screen, self.f_hud, f"Récord: {self.record}", COLOR_GRIS, CENTRO_Y + 25)
        self.lista_game_over.dibujar(self.screen)

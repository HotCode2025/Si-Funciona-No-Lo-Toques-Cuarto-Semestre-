// ============================================================
//  ESQUIVA ELEMENTAL — Minijuego 2 de "La Leyenda de Aang"
//
//  Objetivo: sobrevivir el mayor tiempo posible esquivando los
//  proyectiles de tu propio elemento. Cada impacto cuesta una vida.
//
//  POO: una sola clase (Esquiva) que reutiliza lo que ya existe:
//    - Personaje  → foto, elemento, vidas y ficha (crearFicha)
//    - ELEMENTOS  → colores de cada elemento
//    - Efectos    → sonidos y temblor de pantalla
//  Se carga después de avatar.js y se engancha al botón "Esquiva".
// ============================================================

class Esquiva {

    static ANCHO = 600;
    static ALTO  = 400;
    static RADIO = 16;          // radio de la "caja de golpe" del personaje

    constructor(juego) {
        this.juego   = juego;
        this.seccion = document.getElementById('esquiva');
        this.lienzo  = document.getElementById('lienzo-esquiva');
        this.ctx     = this.lienzo.getContext('2d');
        this.ficha   = document.getElementById('ficha-esquiva');
        this.recordTexto = document.getElementById('esquiva-record');

        this.jugador = null;
        this.estado  = 'inactivo';      // inactivo | listo | jugando | pausa | fin
        this.teclas  = new Set();
        this.botones = new Set();
        this.cuadro  = null;
        this.ultimo  = 0;
        this.reloj   = 0;               // tiempo total (para animaciones)

        this.conectarEventos();
    }

    // ---------- ENTRADAS ----------

    conectarEventos() {
        document.getElementById('boton-esquiva').addEventListener('click', () => this.abrir());
        document.getElementById('boton-esquiva-salir').addEventListener('click', e => { e.currentTarget.blur(); this.cerrar(); });
        document.getElementById('boton-esquiva-jugar').addEventListener('click', e => { e.currentTarget.blur(); this.comenzar(); });

        // Botones en pantalla: mantener presionado = moverse (igual que el mapa)
        document.querySelectorAll('#esquiva .control-mapa').forEach(boton => {
            const dir = boton.dataset.dir;
            boton.addEventListener('pointerdown', e => { e.preventDefault(); this.botones.add(dir); });
            ['pointerup', 'pointerleave', 'pointercancel'].forEach(tipo =>
                boton.addEventListener(tipo, () => this.botones.delete(dir)));
        });
        document.getElementById('boton-esquiva-impulso').addEventListener('pointerdown', e => { e.preventDefault(); this.impulsar(); });

        this.lienzo.addEventListener('pointerdown', () => {
            if (this.estado === 'listo' || this.estado === 'fin') this.comenzar();
            else if (this.estado === 'pausa') this.estado = 'jugando';
        });

        window.addEventListener('keydown', e => this.alPresionar(e));
        window.addEventListener('keyup',   e => this.teclas.delete(this.direccionDe(e.code)));
        window.addEventListener('blur', () => this.pausar());
        document.addEventListener('visibilitychange', () => { if (document.hidden) this.pausar(); });
    }

    direccionDe(codigo) {
        return ({
            ArrowUp: 'arriba', KeyW: 'arriba', ArrowDown: 'abajo', KeyS: 'abajo',
            ArrowLeft: 'izquierda', KeyA: 'izquierda', ArrowRight: 'derecha', KeyD: 'derecha'
        })[codigo];
    }

    alPresionar(e) {
        if (this.estado === 'inactivo') return;
        if (e.target.closest?.('input, textarea, select')) return;

        const dir = this.direccionDe(e.code);
        if (dir) {
            this.teclas.add(dir);
            e.preventDefault();
        } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
            e.preventDefault();
            if (!e.repeat) this.impulsar();
        } else if (e.code === 'Space' || e.code === 'Enter') {
            if (e.target.tagName === 'BUTTON') return;
            e.preventDefault();
            if (this.estado === 'listo' || this.estado === 'fin') this.comenzar();
            else if (this.estado === 'pausa') this.estado = 'jugando';
            else if (e.code === 'Space') this.impulsar();
        } else if (e.code === 'Escape' || e.code === 'KeyP') {
            if (this.estado === 'jugando') this.pausar();
            else if (this.estado === 'pausa') this.estado = 'jugando';
        }
    }

    pausar() {
        if (this.estado === 'jugando') this.estado = 'pausa';
    }

    // ---------- ENTRAR Y SALIR DEL MINIJUEGO ----------

    abrir() {
        const juego = this.juego;
        const elegido = document.querySelector('input[name="personaje"]:checked');
        if (!elegido) {
            juego.seccionMensajes.classList.remove('oculto');
            juego.mostrarMensaje('⚠️ Elegí un personaje para jugar a Esquiva.', 'tie');
            return;
        }

        this.jugador = juego.buscarPersonaje(elegido.value).clonar();
        this.jugador.ancho = 64;
        this.jugador.alto  = 64;
        this.jugador.prepararMapa();

        juego.seccionPersonaje.classList.add('oculto');
        juego.seccionMensajes.classList.add('oculto');
        this.seccion.classList.remove('oculto');
        this.ficha.replaceChildren(this.jugador.crearFicha());

        this.preparar();
        this.iniciarBucle();
    }

    cerrar() {
        cancelAnimationFrame(this.cuadro);
        this.estado = 'inactivo';
        this.teclas.clear();
        this.botones.clear();
        this.seccion.classList.add('oculto');
        this.juego.seccionPersonaje.classList.remove('oculto');
    }

    // ---------- PARTIDA ----------

    preparar() {
        this.x = Esquiva.ANCHO / 2;
        this.y = Esquiva.ALTO / 2;
        this.vx = 0;
        this.vy = 0;
        this.vidas = this.jugador.vidasMax;
        this.tiempo = 0;
        this.bonus = 0;
        this.proyectiles = [];
        this.estrellas = [];
        this.particulas = [];
        this.proxDisparo = 0.8;
        this.proxEstrella = 6;
        this.proxOleada = 14;
        this.invulnerable = 0;
        this.impulso = 0;
        this.enfriamiento = 0;
        this.mirandoIzquierda = false;
        this.nuevoRecord = false;
        this.estado = 'listo';
        this.mostrarRecord();
        document.getElementById('boton-esquiva-jugar').textContent = '▶ Empezar';
    }

    comenzar() {
        this.preparar();
        this.estado = 'jugando';
        document.getElementById('boton-esquiva-jugar').textContent = '↻ Reintentar';
    }

    get puntos() {
        return Math.floor(this.tiempo * 10) + this.bonus;
    }

    get dificultad() {
        return Math.min(1 + this.tiempo / 25, 3.5);
    }

    get info() {
        return ELEMENTOS[this.jugador.elemento] ?? ELEMENTOS.guerrero;
    }

    // Récord guardado por personaje (si el navegador no deja guardar, sigue funcionando)
    leerRecord() {
        try { return Number(localStorage.getItem(`esquiva-record-${this.jugador.id}`)) || 0; }
        catch { return 0; }
    }

    guardarRecord(valor) {
        try { localStorage.setItem(`esquiva-record-${this.jugador.id}`, String(valor)); }
        catch { /* sin almacenamiento: el récord dura solo esta sesión */ }
    }

    mostrarRecord() {
        this.recordTexto.textContent = `🏆 Récord de ${this.jugador.nombre}: ${this.leerRecord()} pts`;
    }

    impulsar() {
        if (this.estado !== 'jugando' || this.enfriamiento > 0) return;
        this.impulso = 0.22;
        this.enfriamiento = 0.9;
        this.invulnerable = Math.max(this.invulnerable, 0.28);
        this.juego.efectos.sonar('patada', this.jugador.elemento);
        this.chispas(14, 1.5);
    }

    // ---------- BUCLE ----------

    iniciarBucle() {
        cancelAnimationFrame(this.cuadro);
        this.ultimo = performance.now();
        const bucle = ahora => {
            const dt = Math.min((ahora - this.ultimo) / 1000, 0.05);
            this.ultimo = ahora;
            this.reloj += dt;
            if (this.estado === 'jugando') this.actualizar(dt);
            else this.animarParticulas(dt);
            this.pintar();
            this.cuadro = requestAnimationFrame(bucle);
        };
        this.cuadro = requestAnimationFrame(bucle);
    }

    actualizar(dt) {
        this.tiempo += dt;
        this.invulnerable = Math.max(0, this.invulnerable - dt);
        this.impulso      = Math.max(0, this.impulso - dt);
        this.enfriamiento = Math.max(0, this.enfriamiento - dt);

        this.mover(dt);
        this.generar(dt);

        // Proyectiles
        const R = Esquiva.RADIO;
        for (const p of this.proyectiles) {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.edad += dt;
        }
        this.proyectiles = this.proyectiles.filter(p =>
            p.x > -80 && p.x < Esquiva.ANCHO + 80 && p.y > -80 && p.y < Esquiva.ALTO + 80);

        if (this.invulnerable <= 0) {
            const golpe = this.proyectiles.find(p => Math.hypot(p.x - this.x, p.y - this.y) < p.r + R);
            if (golpe) {
                this.proyectiles = this.proyectiles.filter(p => p !== golpe);
                this.recibirImpacto(golpe);
            }
        }

        // Estrellas (bonus)
        for (const s of this.estrellas) s.vida -= dt;
        this.estrellas = this.estrellas.filter(s => {
            if (Math.hypot(s.x - this.x, s.y - this.y) < 26) {
                this.bonus += 50;
                this.juego.efectos.sonar('barrida', this.jugador.elemento);
                this.chispas(12, 1.2, '#fde047');
                return false;
            }
            return s.vida > 0;
        });

        this.animarParticulas(dt);
    }

    mover(dt) {
        const e = new Set([...this.teclas, ...this.botones]);
        let dx = (e.has('derecha') ? 1 : 0) - (e.has('izquierda') ? 1 : 0);
        let dy = (e.has('abajo') ? 1 : 0) - (e.has('arriba') ? 1 : 0);
        const largo = Math.hypot(dx, dy);
        if (largo) {
            dx /= largo; dy /= largo;
            this.ultima = { x: dx, y: dy };
        } else if (this.impulso > 0 && this.ultima) {
            dx = this.ultima.x; dy = this.ultima.y;
        }

        const maxima = this.impulso > 0 ? 640 : 270;
        const suave = 1 - Math.exp(-dt * (largo || this.impulso > 0 ? 12 : 8));
        this.vx += (dx * maxima - this.vx) * suave;
        this.vy += (dy * maxima - this.vy) * suave;
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        const m = 24;
        this.x = Math.max(m, Math.min(Esquiva.ANCHO - m, this.x));
        this.y = Math.max(m + 18, Math.min(Esquiva.ALTO - m, this.y));
        if (Math.abs(this.vx) > 30) this.mirandoIzquierda = this.vx < 0;

        if (Math.hypot(this.vx, this.vy) > 150) this.chispas(1, 0.6);
    }

    // ---------- GENERADORES ----------

    generar(dt) {
        this.proxDisparo -= dt;
        if (this.proxDisparo <= 0) {
            this.disparar();
            this.proxDisparo = Math.max(0.26, 0.95 / this.dificultad) * (0.7 + Math.random() * 0.6);
        }

        this.proxOleada -= dt;
        if (this.proxOleada <= 0) {
            this.oleada();
            this.proxOleada = Math.max(8, 16 - this.dificultad * 2);
        }

        this.proxEstrella -= dt;
        if (this.proxEstrella <= 0 && this.estrellas.length < 2) {
            this.estrellas.push({
                x: 50 + Math.random() * (Esquiva.ANCHO - 100),
                y: 70 + Math.random() * (Esquiva.ALTO - 120),
                vida: 7
            });
            this.proxEstrella = 7 + Math.random() * 5;
        }
    }

    colorProyectil() {
        const colores = (PARTICULAS_MAPA[this.jugador.elemento] ?? PARTICULAS_MAPA.guerrero).colores;
        return colores[Math.floor(Math.random() * colores.length)];
    }

    // Proyectil que sale de un borde y apunta cerca del jugador
    disparar() {
        const W = Esquiva.ANCHO, H = Esquiva.ALTO;
        const borde = Math.floor(Math.random() * 4);
        let x, y;
        if (borde === 0)      { x = Math.random() * W; y = -20; }
        else if (borde === 1) { x = W + 20; y = Math.random() * H; }
        else if (borde === 2) { x = Math.random() * W; y = H + 20; }
        else                  { x = -20; y = Math.random() * H; }

        const grande = Math.random() < 0.15;
        const objetivoX = this.x + (Math.random() - 0.5) * 120;
        const objetivoY = this.y + (Math.random() - 0.5) * 120;
        const distancia = Math.hypot(objetivoX - x, objetivoY - y) || 1;
        const velocidad = grande ? 105 : (150 + Math.random() * 80) * Math.min(this.dificultad, 2.2);

        this.proyectiles.push({
            x, y, edad: 0,
            vx: (objetivoX - x) / distancia * velocidad,
            vy: (objetivoY - y) / distancia * velocidad,
            r: grande ? 17 : 7 + Math.random() * 4,
            color: this.colorProyectil()
        });
    }

    // Pared de proyectiles con un hueco por donde pasar
    oleada() {
        const vertical = Math.random() < 0.5;
        const largo = vertical ? Esquiva.ANCHO : Esquiva.ALTO;
        const paso = 42;
        const cantidad = Math.floor(largo / paso);
        const hueco = 1 + Math.floor(Math.random() * (cantidad - 2));
        const velocidad = 130 + this.dificultad * 18;
        const desdeAtras = Math.random() < 0.5;

        for (let i = 0; i < cantidad; i++) {
            if (i === hueco || i === hueco + 1) continue;
            const pos = paso / 2 + i * paso;
            const p = { edad: 0, r: 9, color: this.colorProyectil() };
            if (vertical) {
                p.x = pos; p.y = desdeAtras ? -20 : Esquiva.ALTO + 20;
                p.vx = 0;  p.vy = desdeAtras ? velocidad : -velocidad;
            } else {
                p.y = pos; p.x = desdeAtras ? -20 : Esquiva.ANCHO + 20;
                p.vy = 0;  p.vx = desdeAtras ? velocidad : -velocidad;
            }
            this.proyectiles.push(p);
        }
    }

    // ---------- DAÑO Y FIN ----------

    recibirImpacto(proyectil) {
        this.vidas--;
        this.invulnerable = 1.3;
        this.juego.efectos.sonar('puno', this.jugador.elemento);
        this.juego.efectos.temblarPantalla('leve');
        this.chispas(22, 2, proyectil.color);
        if (this.vidas <= 0) this.terminar();
    }

    terminar() {
        this.estado = 'fin';
        const puntos = this.puntos;
        if (puntos > this.leerRecord()) {
            this.guardarRecord(puntos);
            this.nuevoRecord = true;
            if (!this.juego.efectos.reproducir('victoria')) this.juego.efectos.sonar('barrida', this.jugador.elemento);
        } else if (!this.juego.efectos.reproducir('derrota')) {
            this.juego.efectos.sonar('barrida', this.jugador.elemento);
        }
        this.mostrarRecord();
    }

    // ---------- PARTÍCULAS ----------

    chispas(cantidad, fuerza, color) {
        const info = PARTICULAS_MAPA[this.jugador.elemento] ?? PARTICULAS_MAPA.guerrero;
        for (let i = 0; i < cantidad; i++) {
            const angulo = Math.random() * Math.PI * 2;
            const rapidez = (40 + Math.random() * 120) * fuerza;
            this.particulas.push({
                x: this.x, y: this.y + 8,
                vx: Math.cos(angulo) * rapidez, vy: Math.sin(angulo) * rapidez,
                vida: 0.4 + Math.random() * 0.4, total: 0.8,
                tam: 2 + Math.random() * 3,
                color: color ?? info.colores[Math.floor(Math.random() * info.colores.length)]
            });
        }
    }

    animarParticulas(dt) {
        for (const q of this.particulas) {
            q.vida -= dt;
            q.x += q.vx * dt;
            q.y += q.vy * dt;
            q.vx *= 0.96; q.vy *= 0.96;
        }
        this.particulas = this.particulas.filter(q => q.vida > 0);
    }

    // ---------- DIBUJO ----------

    pintar() {
        const ctx = this.ctx;
        const W = Esquiva.ANCHO, H = Esquiva.ALTO;
        const info = this.info;
        ctx.clearRect(0, 0, W, H);

        // Estrellas de bonus
        for (const s of this.estrellas) {
            const parpadeo = s.vida < 2 ? (Math.sin(this.reloj * 18) > 0 ? 1 : 0.25) : 1;
            ctx.globalAlpha = parpadeo;
            const brillo = ctx.createRadialGradient(s.x, s.y, 1, s.x, s.y, 20);
            brillo.addColorStop(0, 'rgba(253, 224, 71, 0.9)');
            brillo.addColorStop(1, 'rgba(253, 224, 71, 0)');
            ctx.fillStyle = brillo;
            ctx.fillRect(s.x - 20, s.y - 20, 40, 40);
            ctx.font = '20px serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('⭐', s.x, s.y + 1 + Math.sin(this.reloj * 4 + s.x) * 2);
        }
        ctx.globalAlpha = 1;

        // Proyectiles: estela + brillo del elemento + núcleo claro
        for (const p of this.proyectiles) {
            ctx.strokeStyle = p.color + '66';
            ctx.lineWidth = p.r * 1.4;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - p.vx * 0.09, p.y - p.vy * 0.09);
            ctx.stroke();

            const brillo = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, p.r * 2.2);
            brillo.addColorStop(0, p.color);
            brillo.addColorStop(0.45, p.color + 'aa');
            brillo.addColorStop(1, p.color + '00');
            ctx.fillStyle = brillo;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r * 2.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r * 0.45, 0, Math.PI * 2);
            ctx.fill();
        }

        // Partículas
        for (const q of this.particulas) {
            ctx.globalAlpha = Math.max(0, q.vida / q.total);
            ctx.fillStyle = q.color;
            ctx.beginPath();
            ctx.arc(q.x, q.y, q.tam, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        if (this.jugador) this.pintarJugador(ctx, info);
        this.pintarInterfaz(ctx, info);
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
    }

    pintarJugador(ctx, info) {
        const p = this.jugador;
        const flotar = p.elemento === 'aire' ? 6 + Math.sin(this.reloj * 3) * 3 : 0;
        const parpadea = this.invulnerable > 0 && this.impulso <= 0 && Math.sin(this.reloj * 40) > 0;

        // Sombra y aura
        ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + 28, 20, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        const aura = ctx.createRadialGradient(this.x, this.y, 4, this.x, this.y, 46);
        aura.addColorStop(0, info.color + '55');
        aura.addColorStop(1, info.color + '00');
        ctx.fillStyle = aura;
        ctx.fillRect(this.x - 46, this.y - 46, 92, 92);

        ctx.save();
        ctx.globalAlpha = parpadea ? 0.3 : (this.impulso > 0 ? 0.7 : 1);
        ctx.translate(this.x, this.y - flotar);
        ctx.rotate(Math.max(-1, Math.min(1, this.vx / 270)) * 0.14);
        ctx.scale(this.mirandoIzquierda ? -1 : 1, 1);
        p.pintarEnMapa(ctx, -p.ancho / 2, -p.alto / 2);
        ctx.restore();

        // Placa con el nombre
        ctx.font = '600 13px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const rotulo = `${info.emoji} ${p.nombre}`;
        const ancho = ctx.measureText(rotulo).width + 20;
        const yp = this.y - 44 - flotar;
        ctx.fillStyle = 'rgba(10, 5, 2, 0.8)';
        ctx.strokeStyle = info.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(this.x - ancho / 2, yp - 10, ancho, 20, 10);
        else ctx.rect(this.x - ancho / 2, yp - 10, ancho, 20);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.fillText(rotulo, this.x, yp + 1);
    }

    pintarInterfaz(ctx, info) {
        const W = Esquiva.ANCHO, H = Esquiva.ALTO;

        // Barra superior: vidas, puntaje y tiempo
        ctx.fillStyle = 'rgba(10, 5, 2, 0.72)';
        ctx.fillRect(0, 0, W, 34);
        ctx.fillStyle = info.color;
        ctx.fillRect(0, 33, W, 2);

        ctx.textBaseline = 'middle';
        ctx.font = '18px serif';
        ctx.textAlign = 'left';
        const max = this.jugador?.vidasMax ?? 3;
        for (let i = 0; i < max; i++) {
            ctx.globalAlpha = i < this.vidas ? 1 : 0.22;
            ctx.fillText('❤️', 12 + i * 26, 18);
        }
        ctx.globalAlpha = 1;

        ctx.fillStyle = '#fff';
        ctx.font = '700 17px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${this.puntos} pts`, W / 2, 18);
        ctx.textAlign = 'right';
        ctx.font = '600 14px Outfit, sans-serif';
        ctx.fillText(`⏱ ${this.tiempo.toFixed(1)} s`, W - 12, 18);

        // Carga del impulso
        const carga = 1 - this.enfriamiento / 0.9;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.fillRect(W - 112, H - 14, 100, 6);
        ctx.fillStyle = carga >= 1 ? info.color : '#a8a29e';
        ctx.fillRect(W - 112, H - 14, 100 * Math.max(0, Math.min(1, carga)), 6);
        ctx.fillStyle = '#fff';
        ctx.font = '600 11px Outfit, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('IMPULSO', W - 118, H - 11);

        // Carteles según el estado
        if (this.estado === 'listo') {
            this.cartel(ctx, 'Esquiva Elemental', [
                'Esquivá los proyectiles y juntá ⭐ para sumar puntos.',
                'Mové con ← ↑ ↓ → o W A S D · Shift = impulso (invulnerable un instante)',
                'Tocá el mapa o presioná Enter para empezar'
            ], info);
        } else if (this.estado === 'pausa') {
            this.cartel(ctx, 'Pausa', ['Tocá el mapa, Enter o Esc para seguir'], info);
        } else if (this.estado === 'fin') {
            this.cartel(ctx, this.nuevoRecord ? '🏆 ¡Nuevo récord!' : '¡Te alcanzaron!', [
                `${this.puntos} puntos · ${this.tiempo.toFixed(1)} segundos`,
                'Enter o tocá el mapa para reintentar'
            ], info);
        }
    }

    cartel(ctx, titulo, lineas, info) {
        const W = Esquiva.ANCHO, H = Esquiva.ALTO;
        ctx.fillStyle = 'rgba(8, 4, 2, 0.74)';
        ctx.fillRect(0, 35, W, H - 35);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = info.color;
        ctx.font = '700 30px Cinzel, serif';
        ctx.fillText(titulo, W / 2, H / 2 - 36);
        ctx.fillStyle = '#fdf3e6';
        ctx.font = '400 14px Outfit, sans-serif';
        lineas.forEach((texto, i) => ctx.fillText(texto, W / 2, H / 2 + 4 + i * 24));
    }
}

// Arranque: se engancha al juego principal (avatar.js ya creó "juego")
window.esquiva = new Esquiva(juego);

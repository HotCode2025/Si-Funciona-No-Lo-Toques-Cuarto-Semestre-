// ============================================================
//  DUELO EN LA ARENA — Minijuego 3 de "La Leyenda de Aang"
//
//  Pelea en tiempo real: movés a tu personaje por la arena y
//  atacás con Puño, Patada o Barrida contra un enemigo que te
//  persigue. Usa las MISMAS reglas de ventaja del combate por
//  turnos (Ataque.leGanaA):
//
//    tu ataque vence a su guardia  → ¡VENTAJA!   (2 de daño)
//    empatan                       → golpe normal (1 de daño)
//    su guardia vence a tu ataque  → BLOQUEADO    (0 de daño)
//
//  El enemigo cambia de guardia cada tanto: leela (el ícono
//  sobre su cabeza) y elegí el ataque que le gana.
// ============================================================

class Duelo {

    static ANCHO = 600;
    static ALTO  = 400;
    static RADIO = 18;
    static VIDA  = 6;

    // Alcance y recarga de cada ataque. "frontal": solo pega hacia donde mirás.
    static ATAQUES = {
        puno:    { alcance: 62, enfria: 0.32, frontal: true  },
        patada:  { alcance: 86, enfria: 0.60, frontal: true  },
        barrida: { alcance: 98, enfria: 1.00, frontal: false }
    };

    constructor(juego) {
        this.juego   = juego;
        this.seccion = document.getElementById('duelo');
        this.lienzo  = document.getElementById('lienzo-duelo');
        this.ctx     = this.lienzo.getContext('2d');
        this.ficha   = document.getElementById('ficha-duelo');
        this.recordTexto = document.getElementById('duelo-record');

        this.jugador = null;
        this.enemigo = null;
        this.estado  = 'inactivo';      // inactivo | listo | jugando | pausa | fin
        this.teclas  = new Set();
        this.botones = new Set();
        this.cuadro  = null;
        this.ultimo  = 0;
        this.reloj   = 0;

        this.conectarEventos();
    }

    // ---------- ENTRADAS ----------

    conectarEventos() {
        document.getElementById('boton-duelo').addEventListener('click', () => this.abrir());
        document.getElementById('boton-duelo-salir').addEventListener('click', e => { e.currentTarget.blur(); this.cerrar(); });
        document.getElementById('boton-duelo-jugar').addEventListener('click', e => { e.currentTarget.blur(); this.comenzar(); });

        // Botones en pantalla (mantener presionado = moverse)
        document.querySelectorAll('#duelo .control-mapa').forEach(boton => {
            const dir = boton.dataset.dir;
            boton.addEventListener('pointerdown', e => { e.preventDefault(); this.botones.add(dir); });
            ['pointerup', 'pointerleave', 'pointercancel'].forEach(tipo =>
                boton.addEventListener(tipo, () => this.botones.delete(dir)));
        });
        document.querySelectorAll('#duelo [data-ataque]').forEach(boton =>
            boton.addEventListener('pointerdown', e => { e.preventDefault(); this.atacar(boton.dataset.ataque); }));
        document.getElementById('boton-duelo-impulso').addEventListener('pointerdown', e => { e.preventDefault(); this.impulsar(); });

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

    ataqueDe(codigo) {
        return ({ KeyJ: 'puno', KeyZ: 'puno', KeyK: 'patada', KeyX: 'patada', KeyL: 'barrida', KeyC: 'barrida' })[codigo];
    }

    alPresionar(e) {
        if (this.estado === 'inactivo') return;
        if (e.target.closest?.('input, textarea, select')) return;

        const dir = this.direccionDe(e.code);
        const ataque = this.ataqueDe(e.code);
        if (dir) {
            this.teclas.add(dir);
            e.preventDefault();
        } else if (ataque) {
            e.preventDefault();
            if (!e.repeat) this.atacar(ataque);
        } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'Space') {
            if (e.target.tagName === 'BUTTON' && e.code === 'Space') return;
            e.preventDefault();
            if (e.code === 'Space' && (this.estado === 'listo' || this.estado === 'fin')) this.comenzar();
            else if (!e.repeat) this.impulsar();
        } else if (e.code === 'Enter') {
            if (e.target.tagName === 'BUTTON') return;
            e.preventDefault();
            if (this.estado === 'listo' || this.estado === 'fin') this.comenzar();
            else if (this.estado === 'pausa') this.estado = 'jugando';
        } else if (e.code === 'Escape' || e.code === 'KeyP') {
            if (this.estado === 'jugando') this.pausar();
            else if (this.estado === 'pausa') this.estado = 'jugando';
        }
    }

    pausar() {
        if (this.estado === 'jugando') this.estado = 'pausa';
    }

    // ---------- ENTRAR Y SALIR ----------

    abrir() {
        const juego = this.juego;
        const elegido = document.querySelector('input[name="personaje"]:checked');
        if (!elegido) {
            juego.seccionMensajes.classList.remove('oculto');
            juego.mostrarMensaje('⚠️ Elegí un personaje para entrar al Duelo.', 'tie');
            return;
        }

        this.jugador = juego.buscarPersonaje(elegido.value).clonar();
        this.jugador.ancho = this.jugador.alto = 70;
        this.jugador.prepararMapa();

        // Rival aleatorio (si se puede, distinto de vos)
        let rival = juego.personajeAleatorio();
        for (let i = 0; i < 6 && rival.id === this.jugador.id; i++) rival = juego.personajeAleatorio();
        this.enemigo = rival.clonar();
        this.enemigo.ancho = this.enemigo.alto = 70;
        this.enemigo.prepararMapa();

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

    get infoJugador() { return ELEMENTOS[this.jugador.elemento] ?? ELEMENTOS.guerrero; }
    get infoEnemigo() { return ELEMENTOS[this.enemigo.elemento] ?? ELEMENTOS.guerrero; }

    ataque(id) {
        return this.juego.ataques.find(a => a.id === id);
    }

    preparar() {
        const W = Duelo.ANCHO, H = Duelo.ALTO;
        this.j = { x: W * 0.25, y: H * 0.62, vx: 0, vy: 0, vida: Duelo.VIDA, cd: 0, inv: 0, impulso: 0, enfria: 0,
                   mirando: 1, destello: 0, anim: null, ultima: null };
        this.e = { x: W * 0.75, y: H * 0.62, vx: 0, vy: 0, vida: Duelo.VIDA, inv: 0, mirando: -1, destello: 0, anim: null,
                   estado: 'perseguir', t: 0, guardia: 'puno', tGuardia: 1.5 };
        this.particulas = [];
        this.textos = [];
        this.tiempo = 0;
        this.resultado = null;
        this.estado = 'listo';
        this.mostrarRecord();
        document.getElementById('boton-duelo-jugar').textContent = '▶ Empezar';
    }

    comenzar() {
        this.preparar();
        this.estado = 'jugando';
        document.getElementById('boton-duelo-jugar').textContent = '↻ Revancha';
    }

    leerVictorias() {
        try { return Number(localStorage.getItem(`duelo-victorias-${this.jugador.id}`)) || 0; }
        catch { return 0; }
    }

    sumarVictoria() {
        try { localStorage.setItem(`duelo-victorias-${this.jugador.id}`, String(this.leerVictorias() + 1)); }
        catch { /* sin almacenamiento: no se guarda */ }
    }

    mostrarRecord() {
        this.recordTexto.textContent = `🏆 Victorias de ${this.jugador.nombre}: ${this.leerVictorias()}  ·  Rival: ${this.enemigo.emoji} ${this.enemigo.nombre}`;
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
            else this.animarEfectos(dt);
            this.pintar();
            this.cuadro = requestAnimationFrame(bucle);
        };
        this.cuadro = requestAnimationFrame(bucle);
    }

    actualizar(dt) {
        const j = this.j, e = this.e;
        this.tiempo += dt;
        for (const o of [j, e]) {
            o.inv = Math.max(0, o.inv - dt);
            o.destello = Math.max(0, o.destello - dt);
            if (o.anim && (o.anim.t -= dt) <= 0) o.anim = null;
        }
        j.cd      = Math.max(0, j.cd - dt);
        j.impulso = Math.max(0, j.impulso - dt);
        j.enfria  = Math.max(0, j.enfria - dt);

        this.moverJugador(dt);
        this.pensarEnemigo(dt);
        this.separar();
        this.animarEfectos(dt);
    }

    moverJugador(dt) {
        const j = this.j;
        const activas = new Set([...this.teclas, ...this.botones]);
        let dx = (activas.has('derecha') ? 1 : 0) - (activas.has('izquierda') ? 1 : 0);
        let dy = (activas.has('abajo') ? 1 : 0) - (activas.has('arriba') ? 1 : 0);
        const largo = Math.hypot(dx, dy);
        if (largo) { dx /= largo; dy /= largo; j.ultima = { x: dx, y: dy }; }
        else if (j.impulso > 0 && j.ultima) { dx = j.ultima.x; dy = j.ultima.y; }

        const maxima = j.impulso > 0 ? 620 : 250;
        const suave = 1 - Math.exp(-dt * (largo || j.impulso > 0 ? 12 : 9));
        j.vx += (dx * maxima - j.vx) * suave;
        j.vy += (dy * maxima - j.vy) * suave;
        this.desplazar(j, dt);
        if (Math.abs(j.vx) > 40) j.mirando = Math.sign(j.vx);
        else this.mirarAlRival();
        if (Math.hypot(j.vx, j.vy) > 160) this.chispas(j.x, j.y + 10, 1, 0.6, this.infoJugador.color);
    }

    mirarAlRival() {
        const dx = this.e.x - this.j.x;
        if (Math.abs(dx) > 8) this.j.mirando = Math.sign(dx);
    }

    desplazar(o, dt) {
        o.x += o.vx * dt;
        o.y += o.vy * dt;
        o.x = Math.max(28, Math.min(Duelo.ANCHO - 28, o.x));
        o.y = Math.max(78, Math.min(Duelo.ALTO - 26, o.y));
    }

    // Que no se superpongan los dos personajes
    separar() {
        const j = this.j, e = this.e;
        const dx = e.x - j.x, dy = e.y - j.y;
        const d = Math.hypot(dx, dy) || 1;
        const minimo = Duelo.RADIO * 1.7;
        if (d < minimo) {
            const empuje = (minimo - d) / 2;
            j.x -= dx / d * empuje; j.y -= dy / d * empuje;
            e.x += dx / d * empuje; e.y += dy / d * empuje;
        }
    }

    // ---------- ATAQUES DEL JUGADOR ----------

    impulsar() {
        const j = this.j;
        if (this.estado !== 'jugando' || j.enfria > 0) return;
        j.impulso = 0.2;
        j.enfria = 0.9;
        j.inv = Math.max(j.inv, 0.26);
        this.juego.efectos.sonar('barrida', this.jugador.elemento);
        this.chispas(j.x, j.y + 10, 14, 1.5, this.infoJugador.color);
    }

    atacar(id) {
        const j = this.j, e = this.e;
        const def = Duelo.ATAQUES[id];
        if (this.estado !== 'jugando' || !def || j.cd > 0) return;

        j.cd = def.enfria;
        j.anim = { id, t: 0.2, total: 0.2 };
        this.mirarAlRival();
        this.juego.efectos.sonar(id, this.jugador.elemento);

        if (e.inv > 0) return;
        const dx = e.x - j.x, dy = e.y - j.y;
        const distancia = Math.hypot(dx, dy);
        const alFrente = !def.frontal || Math.sign(dx) === j.mirando || Math.abs(dx) < 12;
        if (distancia > def.alcance + Duelo.RADIO || !alFrente) return;

        const mio = this.ataque(id), suyo = this.ataque(e.guardia);
        let dano = 1, texto = '¡Golpe!', color = '#fde68a';
        if (mio.leGanaA(suyo))      { dano = 2; texto = '¡VENTAJA! −2'; color = '#4ade80'; }
        else if (suyo.leGanaA(mio)) { dano = 0; texto = 'BLOQUEADO';    color = '#94a3b8'; }

        e.inv = 0.35;
        e.destello = 0.18;
        this.texto(e.x, e.y - 52, texto, color);
        if (dano > 0) {
            e.vida = Math.max(0, e.vida - dano);
            this.empujar(e, j, 260);
            this.chispas(e.x, e.y, 16 * dano, 1.6, mio.colorClaro);
            this.juego.efectos.temblarPantalla(dano > 1 ? 'medio' : 'leve');
            if (e.vida <= 0) this.terminar(true);
        } else {
            this.empujar(j, e, 140);
            this.chispas(e.x, e.y, 6, 1, '#94a3b8');
        }
    }

    empujar(objetivo, origen, fuerza) {
        const dx = objetivo.x - origen.x, dy = objetivo.y - origen.y;
        const d = Math.hypot(dx, dy) || 1;
        objetivo.vx = dx / d * fuerza;
        objetivo.vy = dy / d * fuerza;
    }

    // ---------- ENEMIGO (IA sencilla con 4 estados) ----------

    pensarEnemigo(dt) {
        const j = this.j, e = this.e;
        const dx = j.x - e.x, dy = j.y - e.y;
        const distancia = Math.hypot(dx, dy) || 1;
        const dificultad = 1 + Math.min(this.tiempo / 60, 0.5);
        if (Math.abs(dx) > 8) e.mirando = Math.sign(dx);

        // Cambia de guardia cada tanto: es la pista para elegir tu ataque
        e.tGuardia -= dt;
        if (e.tGuardia <= 0) {
            const ids = Object.keys(Duelo.ATAQUES).filter(id => id !== e.guardia);
            e.guardia = ids[Math.floor(Math.random() * ids.length)];
            e.tGuardia = 2 + Math.random() * 1.4;
        }

        const def = Duelo.ATAQUES[e.guardia];
        const alcance = def.alcance * 0.85;
        const velocidad = 100 * dificultad;

        // Fricción del empujón
        e.vx *= Math.exp(-dt * 6);
        e.vy *= Math.exp(-dt * 6);

        if (e.estado === 'perseguir') {
            if (distancia > alcance) {
                e.vx += (dx / distancia * velocidad - e.vx) * Math.min(1, dt * 8);
                e.vy += (dy / distancia * velocidad - e.vy) * Math.min(1, dt * 8);
            } else {
                e.estado = 'preparar';
                e.t = 0.5 / dificultad;
                e.tipo = e.guardia;
            }
        } else if (e.estado === 'preparar') {
            e.t -= dt;   // avisa el golpe: hay tiempo para esquivarlo
            if (e.t <= 0) {
                const d = Duelo.ATAQUES[e.tipo];
                e.anim = { id: e.tipo, t: 0.2, total: 0.2 };
                this.juego.efectos.sonar(e.tipo, this.enemigo.elemento);
                if (j.inv <= 0 && distancia < d.alcance * 0.85 + Duelo.RADIO) {
                    j.vida = Math.max(0, j.vida - 1);
                    j.inv = 0.7;
                    j.destello = 0.2;
                    this.empujar(j, e, 300);
                    this.chispas(j.x, j.y, 14, 1.5, this.ataque(e.tipo).colorClaro);
                    this.texto(j.x, j.y - 52, '−1', '#f87171');
                    this.juego.efectos.temblarPantalla('leve');
                    if (j.vida <= 0) this.terminar(false);
                }
                e.estado = 'enfriar';
                e.t = (0.8 + Math.random() * 0.8) / dificultad;
            }
        } else if (e.estado === 'enfriar') {
            e.t -= dt;
            e.vx += (-dx / distancia * velocidad * 0.5 - e.vx) * Math.min(1, dt * 5);
            e.vy += (-dy / distancia * velocidad * 0.5 - e.vy) * Math.min(1, dt * 5);
            if (e.t <= 0) e.estado = 'perseguir';
        }
        this.desplazar(e, dt);
    }

    // ---------- FIN ----------

    terminar(gano) {
        this.estado = 'fin';
        this.resultado = gano ? 'victoria' : 'derrota';
        if (gano) this.sumarVictoria();
        if (!this.juego.efectos.reproducir(this.resultado)) this.juego.efectos.sonar('barrida', this.jugador.elemento);
        this.mostrarRecord();
    }

    // ---------- EFECTOS ----------

    chispas(x, y, cantidad, fuerza, color) {
        for (let i = 0; i < cantidad; i++) {
            const angulo = Math.random() * Math.PI * 2;
            const rapidez = (40 + Math.random() * 130) * fuerza;
            this.particulas.push({
                x, y, vx: Math.cos(angulo) * rapidez, vy: Math.sin(angulo) * rapidez,
                vida: 0.35 + Math.random() * 0.4, total: 0.75, tam: 2 + Math.random() * 3, color
            });
        }
    }

    texto(x, y, texto, color) {
        this.textos.push({ x, y, texto, color, vida: 0.9 });
    }

    animarEfectos(dt) {
        for (const q of this.particulas) {
            q.vida -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.95; q.vy *= 0.95;
        }
        this.particulas = this.particulas.filter(q => q.vida > 0);
        for (const t of this.textos) { t.vida -= dt; t.y -= 34 * dt; }
        this.textos = this.textos.filter(t => t.vida > 0);
    }

    // ---------- DIBUJO ----------

    pintar() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, Duelo.ANCHO, Duelo.ALTO);
        if (!this.j) return;

        // El que está más abajo se dibuja encima (sensación de profundidad)
        const orden = [
            { o: this.j, p: this.jugador, info: this.infoJugador, jugador: true },
            { o: this.e, p: this.enemigo, info: this.infoEnemigo, jugador: false }
        ].sort((a, b) => a.o.y - b.o.y);
        orden.forEach(c => this.pintarLuchador(ctx, c));

        for (const q of this.particulas) {
            ctx.globalAlpha = Math.max(0, q.vida / q.total);
            ctx.fillStyle = q.color;
            ctx.beginPath();
            ctx.arc(q.x, q.y, q.tam, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '800 17px Outfit, sans-serif';
        for (const t of this.textos) {
            ctx.globalAlpha = Math.min(1, t.vida * 2);
            ctx.lineWidth = 4;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.strokeText(t.texto, t.x, t.y);
            ctx.fillStyle = t.color;
            ctx.fillText(t.texto, t.x, t.y);
        }
        ctx.globalAlpha = 1;

        this.pintarInterfaz(ctx);
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
    }

    pintarLuchador(ctx, { o, p, info, jugador }) {
        const flotar = p.elemento === 'aire' ? 5 + Math.sin(this.reloj * 3) * 3 : 0;

        // Aviso del golpe enemigo: el círculo se llena hasta que pega
        if (!jugador && o.estado === 'preparar') {
            const alcance = Duelo.ATAQUES[o.tipo].alcance * 0.85;
            const avance = 1 - Math.max(0, o.t) / 0.5;
            ctx.fillStyle = `rgba(239, 68, 68, ${0.08 + avance * 0.22})`;
            ctx.strokeStyle = `rgba(239, 68, 68, ${0.4 + avance * 0.5})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(o.x, o.y + 10, alcance, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }

        // Sombra y aura
        ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
        ctx.beginPath();
        ctx.ellipse(o.x, o.y + 30, 22, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        const aura = ctx.createRadialGradient(o.x, o.y, 4, o.x, o.y, 48);
        aura.addColorStop(0, info.color + '44');
        aura.addColorStop(1, info.color + '00');
        ctx.fillStyle = aura;
        ctx.fillRect(o.x - 48, o.y - 48, 96, 96);

        // Arco del ataque en curso
        if (o.anim) this.pintarGolpe(ctx, o);

        const parpadea = jugador && o.inv > 0 && o.impulso <= 0 && Math.sin(this.reloj * 40) > 0;
        ctx.save();
        ctx.globalAlpha = parpadea ? 0.3 : (jugador && o.impulso > 0 ? 0.65 : 1);
        ctx.translate(o.x, o.y - flotar);
        ctx.rotate(Math.max(-1, Math.min(1, o.vx / 260)) * 0.12);
        ctx.scale(o.mirando < 0 ? -1 : 1, 1);
        if (o.destello > 0) ctx.filter = 'brightness(2.2) saturate(0.4)';
        p.pintarEnMapa(ctx, -p.ancho / 2, -p.alto / 2);
        ctx.restore();

        // Placa con el nombre (la del enemigo, en rojo)
        ctx.font = '600 12px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const rotulo = `${info.emoji} ${p.nombre}`;
        const ancho = ctx.measureText(rotulo).width + 18;
        const yp = o.y - 46 - flotar;
        ctx.fillStyle = 'rgba(10, 5, 2, 0.82)';
        ctx.strokeStyle = jugador ? info.color : '#ef4444';
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(o.x - ancho / 2, yp - 9, ancho, 18, 9);
        else ctx.rect(o.x - ancho / 2, yp - 9, ancho, 18);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.fillText(rotulo, o.x, yp + 1);

        // Guardia del enemigo: el ícono que hay que leer para ganar ventaja
        if (!jugador) {
            const gu = this.ataque(o.guardia);
            const cy = yp - 26;
            ctx.fillStyle = 'rgba(10, 5, 2, 0.85)';
            ctx.strokeStyle = gu.colorClaro;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(o.x, cy, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.font = '16px serif';
            ctx.fillStyle = '#fff';
            ctx.fillText(gu.emoji, o.x, cy + 1);
        }
    }

    pintarGolpe(ctx, o) {
        const def = Duelo.ATAQUES[o.anim.id];
        const ataque = this.ataque(o.anim.id);
        const avance = 1 - o.anim.t / o.anim.total;
        ctx.save();
        ctx.globalAlpha = 0.85 * (1 - avance * 0.6);
        ctx.strokeStyle = ataque.colorClaro;
        ctx.fillStyle = ataque.colorOscuro + '55';
        ctx.lineWidth = 5;
        ctx.beginPath();
        const radio = def.alcance * (0.55 + avance * 0.45);
        if (def.frontal) {
            const base = o.mirando < 0 ? Math.PI : 0;
            ctx.moveTo(o.x, o.y + 6);
            ctx.arc(o.x, o.y + 6, radio, base - 0.8, base + 0.8);
            ctx.closePath();
        } else {
            ctx.arc(o.x, o.y + 10, radio, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    barraVida(ctx, x, ancho, vida, color, alinearDerecha) {
        const segmentos = Duelo.VIDA, hueco = 3;
        const w = (ancho - hueco * (segmentos - 1)) / segmentos;
        for (let i = 0; i < segmentos; i++) {
            const idx = alinearDerecha ? segmentos - 1 - i : i;
            ctx.fillStyle = idx < vida ? color : 'rgba(255, 255, 255, 0.14)';
            ctx.fillRect(x + i * (w + hueco), 22, w, 9);
        }
    }

    pintarInterfaz(ctx) {
        const W = Duelo.ANCHO, H = Duelo.ALTO;
        ctx.fillStyle = 'rgba(10, 5, 2, 0.74)';
        ctx.fillRect(0, 0, W, 38);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(0, 37, W, 2);

        ctx.textBaseline = 'middle';
        ctx.font = '700 13px Outfit, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        ctx.fillText(`${this.infoJugador.emoji} ${this.jugador.nombre}`, 12, 11);
        ctx.textAlign = 'right';
        ctx.fillText(`${this.enemigo.nombre} ${this.infoEnemigo.emoji}`, W - 12, 11);
        this.barraVida(ctx, 12, 230, this.j.vida, this.infoJugador.color, false);
        this.barraVida(ctx, W - 242, 230, this.e.vida, '#ef4444', true);
        ctx.textAlign = 'center';
        ctx.font = '700 15px Cinzel, serif';
        ctx.fillStyle = '#f59e0b';
        ctx.fillText('VS', W / 2, 19);

        // Recargas de los 3 ataques, abajo a la izquierda
        ctx.font = '600 11px Outfit, sans-serif';
        Object.keys(Duelo.ATAQUES).forEach((id, i) => {
            const a = this.ataque(id);
            const x = 14 + i * 74;
            const lista = this.j.cd <= 0;
            ctx.fillStyle = 'rgba(10, 5, 2, 0.7)';
            ctx.fillRect(x, H - 26, 66, 18);
            ctx.fillStyle = lista ? a.colorClaro : '#78716c';
            ctx.textAlign = 'center';
            ctx.fillText(`${a.emoji} ${{ puno: 'J', patada: 'K', barrida: 'L' }[id]}`, x + 33, H - 17);
        });

        // Carga del impulso
        const carga = 1 - this.j.enfria / 0.9;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.fillRect(W - 112, H - 14, 100, 6);
        ctx.fillStyle = carga >= 1 ? this.infoJugador.color : '#a8a29e';
        ctx.fillRect(W - 112, H - 14, 100 * Math.max(0, Math.min(1, carga)), 6);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'right';
        ctx.fillText('IMPULSO', W - 118, H - 11);

        if (this.estado === 'listo') {
            this.cartel(ctx, 'Duelo en la Arena', [
                'Mové con ← ↑ ↓ → o W A S D · Shift = impulso',
                'Atacá con J 👊 puño · K 🦵 patada · L 🌀 barrida',
                'Mirá el ícono sobre el rival: elegí el ataque que le gana (ventaja = 2 de daño)',
                'Enter o tocá la arena para empezar'
            ], this.infoJugador.color);
        } else if (this.estado === 'pausa') {
            this.cartel(ctx, 'Pausa', ['Tocá la arena, Enter o Esc para seguir'], this.infoJugador.color);
        } else if (this.estado === 'fin') {
            const gano = this.resultado === 'victoria';
            this.cartel(ctx, gano ? '🏆 ¡Victoria!' : '💀 Derrota', [
                gano ? `Le ganaste a ${this.enemigo.nombre} en ${this.tiempo.toFixed(1)} segundos`
                     : `${this.enemigo.nombre} te venció. ¡Probá con otra estrategia!`,
                'Enter o tocá la arena para la revancha'
            ], gano ? '#4ade80' : '#f87171');
        }
    }

    cartel(ctx, titulo, lineas, color) {
        const W = Duelo.ANCHO, H = Duelo.ALTO;
        ctx.fillStyle = 'rgba(8, 4, 2, 0.76)';
        ctx.fillRect(0, 39, W, H - 39);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = color;
        ctx.font = '700 30px Cinzel, serif';
        ctx.fillText(titulo, W / 2, H / 2 - 56);
        ctx.fillStyle = '#fdf3e6';
        ctx.font = '400 14px Outfit, sans-serif';
        lineas.forEach((texto, i) => ctx.fillText(texto, W / 2, H / 2 - 12 + i * 24));
    }
}

// Arranque: se engancha al juego principal (avatar.js ya creó "juego")
window.duelo = new Duelo(juego);

// ============================================================
//  LA LEYENDA DE AANG — LÓGICA DEL JUEGO
//  Clase 4: Programación Orientada a Objetos (Clases y Objetos)
//
//  Equipo: Lautaro (SM + Dev), Samira, Gabriel, Leandro
//  SCRUM con dailies en Discord + Live Share. Detalle en SCRUM.md
// ============================================================
//
//  ANTES (clases 1 a 3):
//      const jugador   = { nombre: '', emoji: '', vidas: 3 };
//      const personajes = { aang: {...}, katara: {...} };
//      ...y las 4 tarjetas de personaje escritas a mano en el HTML.
//
//  AHORA (POO):
//      Una CLASE es el molde (el "plano de la casa").
//      Cada personaje es un OBJETO fabricado con ese molde.
//      Los ATRIBUTOS son sus datos (nombre, emoji, vidas...).
//      Los MÉTODOS son sus acciones (atacar, recibir golpe, dibujarse...).
//
//      Resultado: agregar un personaje nuevo es UNA línea de código y no
//      se toca el HTML. Sirve para 4, para 100 o para 1000 personajes.
// ============================================================
//
//  RELACIÓN CON LA TEORÍA DE LA CLASE (video "Clases y Objetos"):
//
//      El video explica la POO con dos ejemplos:
//        · "Plano de Casa" (clase) → cada "Casa" construida (objeto).
//        · Clase "Animal" (molde)  → objetos "Perro", "Gato", "Elefante".
//
//      Acá el mismo patrón se repite tres veces:
//        · class Ataque    (molde) → objetos Puño, Patada, Barrida.
//        · class Personaje (molde) → objetos Aang, Katara, Sokka, Haru...
//        · class Juego     (molde) → el objeto "juego" que arranca al final.
//
//      Así como una Casa tiene ATRIBUTOS (color, cant. de ventanas) y
//      MÉTODOS (abrirPuerta, pintar), y un Animal tiene ATRIBUTOS (tamaño,
//      peso) y MÉTODOS (hacerSonido, comer, dormir) — acá un Personaje
//      tiene ATRIBUTOS (nombre, emoji, vidas) y MÉTODOS (recibirGolpe,
//      curarse, crearTarjeta). Ver el detalle en cada clase más abajo.
// ============================================================

'use strict';


/* ============================================================
   0) DATOS DE LOS ELEMENTOS Y EFECTOS (sonido + animación)
   ------------------------------------------------------------
   Cada elemento (aire, agua, fuego, tierra, guerrero) tiene sus
   colores, su partícula y los NOMBRES de sus movimientos de Avatar.
   Puño / Patada / Barrida siguen siendo las 3 mecánicas, pero se
   "visten" según el elemento del personaje que las usa.
   ============================================================ */
const ELEMENTOS = {
    aire:     { nombre: 'Aire',     emoji: '🌪️', particula: '💨', color: '#fde68a', tinte: 'rgba(252, 211, 77, 0.14)', titulo: 'Maestro/a Aire',
                habilidades: { puno: 'Palma de Aire',    patada: 'Ráfaga Giratoria', barrida: 'Tornado de Aire' } },
    agua:     { nombre: 'Agua',     emoji: '💧', particula: '💧', color: '#38bdf8', tinte: 'rgba(56, 189, 248, 0.14)', titulo: 'Maestro/a Agua',
                habilidades: { puno: 'Látigo de Agua',   patada: 'Ola Cortante',     barrida: 'Marea Envolvente' } },
    fuego:    { nombre: 'Fuego',    emoji: '🔥', particula: '🔥', color: '#f97316', tinte: 'rgba(239, 68, 68, 0.14)',  titulo: 'Maestro/a Fuego',
                habilidades: { puno: 'Puño de Fuego',    patada: 'Patada Llameante', barrida: 'Barrido de Fuego' } },
    tierra:   { nombre: 'Tierra',   emoji: '🌱', particula: '🪨', color: '#84cc16', tinte: 'rgba(34, 197, 94, 0.14)',  titulo: 'Maestro/a Tierra',
                habilidades: { puno: 'Roca Lanzada',     patada: 'Patada Sísmica',   barrida: 'Avalancha' } },
    guerrero: { nombre: 'Guerrero', emoji: '⚔️', particula: '🪃', color: '#d6b28c', tinte: 'rgba(214, 178, 140, 0.14)', titulo: 'Guerrero/a',
                habilidades: { puno: 'Estocada Certera', patada: 'Patada Guerrera',  barrida: 'Corte de Bumerán' } }
};

// Retratos que se pueden elegir al crear un personaje (están en /img)
const RETRATOS = [
    { id: 'aang', nombre: 'Aang' }, { id: 'katara', nombre: 'Katara' },
    { id: 'sokka', nombre: 'Sokka' }, { id: 'haru', nombre: 'Haru' },
    { id: 'zuko', nombre: 'Zuko' }, { id: 'toph', nombre: 'Toph' }
];

class Efectos {
    constructor(arena) {
        this.arena = arena;
        this.ctx   = null;   // el AudioContext se crea con el primer click (regla del navegador)
        this.volumen = 0.8;  // 0 a 1 (lo controla el deslizador "Efectos")

        // Sonidos reales (carpeta audio/). Si alguno no existe, se usa el
        // sonido sintetizado de abajo como respaldo.
        this.cache = {};
        // Usa los sonidos incluidos al final de este archivo; si faltaran, busca en audio/
        const incluidos = (typeof SONIDOS_INCLUIDOS !== 'undefined') ? SONIDOS_INCLUIDOS
                       : (typeof SONIDOS !== 'undefined') ? SONIDOS : {};
        const rutas = {};
        ['puno', 'patada', 'barrida', 'victoria', 'derrota'].forEach(id => {
            rutas[id] = incluidos[id] || `./audio/${id}.mp3`;
        });
        Object.entries(rutas).forEach(([id, ruta]) => {
            const audio = new Audio(ruta);
            audio.preload = 'auto';
            this.cache[id] = audio;
        });
    }

    // Reproduce un sonido de archivo. Devuelve false si el archivo no cargó.
    reproducir(id) {
        const base = this.cache[id];
        if (!base || base.error) {
            console.warn(`No cargó el sonido "${id}": uso el sonido sintetizado de respaldo.`);
            return false;
        }
        const copia = base.cloneNode();   // copia para que dos sonidos puedan superponerse
        copia.volume = this.volumen;
        copia.play().catch(() => {});
        return true;
    }

    audio() {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        if (!this.ctx) this.ctx = new AC();
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return this.ctx;
    }

    // Sonidos sintetizados (no hacen falta archivos): cada movimiento tiene su
    // sonido base y cada elemento le suma su "timbre".
    sonar(ataqueId, elemento) {
        if (this.reproducir(ataqueId)) return;   // sonido real; si no hay, sigue el sintetizado

        const ctx = this.audio();
        if (!ctx) return;
        const t0 = ctx.currentTime;
        const destino = ctx.createGain();
        destino.gain.value = this.volumen;
        destino.connect(ctx.destination);

        const tono = (tipo, f0, f1, dur, vol, retraso = 0) => {
            const osc = ctx.createOscillator();
            const gan = ctx.createGain();
            osc.type = tipo;
            osc.frequency.setValueAtTime(f0, t0 + retraso);
            osc.frequency.exponentialRampToValueAtTime(f1, t0 + retraso + dur);
            gan.gain.setValueAtTime(vol, t0 + retraso);
            gan.gain.exponentialRampToValueAtTime(0.001, t0 + retraso + dur);
            osc.connect(gan).connect(destino);
            osc.start(t0 + retraso);
            osc.stop(t0 + retraso + dur);
        };
        const soplo = (filtro, f0, f1, dur, vol, q = 1, retraso = 0) => {
            const largo = Math.ceil(ctx.sampleRate * dur);
            const buffer = ctx.createBuffer(1, largo, ctx.sampleRate);
            const datos = buffer.getChannelData(0);
            for (let i = 0; i < largo; i++) datos[i] = Math.random() * 2 - 1;
            const fuente = ctx.createBufferSource();
            fuente.buffer = buffer;
            const fil = ctx.createBiquadFilter();
            fil.type = filtro;
            fil.Q.value = q;
            fil.frequency.setValueAtTime(f0, t0 + retraso);
            fil.frequency.exponentialRampToValueAtTime(f1, t0 + retraso + dur);
            const gan = ctx.createGain();
            gan.gain.setValueAtTime(vol, t0 + retraso);
            gan.gain.exponentialRampToValueAtTime(0.001, t0 + retraso + dur);
            fuente.connect(fil).connect(gan).connect(destino);
            fuente.start(t0 + retraso);
        };

        // Sonido base según el movimiento
        if (ataqueId === 'puno') {            // golpe grave y seco
            tono('sine', 170, 45, 0.22, 0.9);
            soplo('lowpass', 900, 200, 0.12, 0.5);
        } else if (ataqueId === 'patada') {   // corte rápido + chasquido
            soplo('bandpass', 2400, 500, 0.22, 0.8, 2);
            tono('square', 420, 120, 0.1, 0.18);
        } else {                              // barrida: soplido largo que sube
            soplo('bandpass', 250, 3200, 0.55, 0.7, 1.5);
        }

        // Timbre según el elemento
        if (elemento === 'fuego')         soplo('highpass', 3500, 3500, 0.4, 0.3);        // crepitar
        else if (elemento === 'agua')     tono('sine', 500, 1000, 0.3, 0.2, 0.05);        // burbuja
        else if (elemento === 'aire')     soplo('highpass', 1500, 5000, 0.45, 0.25);      // viento
        else if (elemento === 'tierra')   tono('sawtooth', 75, 40, 0.4, 0.4);             // retumbar
        else                              tono('triangle', 1300, 900, 0.25, 0.25);        // metal
    }

    // Lanza el efecto visual desde la tarjeta que ataca hacia la que recibe
    lanzar(ataqueId, elemento, origen, destino, lado, nombreHabilidad) {
        if (!origen || !destino) return;
        const info = ELEMENTOS[elemento] ?? ELEMENTOS.guerrero;
        this.sonar(ataqueId, elemento);

        // El que ataca "embiste": se lanza hacia el rival y vuelve
        const sentido = lado === 'izquierda' ? 1 : -1;
        origen.animate?.([
            { translate: '0 0', scale: 1 },
            { translate: `${70 * sentido}px 0`, scale: 1.1, offset: 0.35 },
            { translate: '0 0', scale: 1 }
        ], { duration: 520, easing: 'ease-out' });

        const base = this.arena.getBoundingClientRect();
        const centro = el => {
            const r = el.getBoundingClientRect();
            return { x: r.left + r.width / 2 - base.left, y: r.top + r.height / 2 - base.top, h: r.height };
        };
        const o = centro(origen);
        const d = centro(destino);
        const cantidad = { puno: 6, patada: 5, barrida: 8 }[ataqueId] ?? 5;
        const azar = (min, max) => min + Math.random() * (max - min);

        for (let i = 0; i < cantidad; i++) {
            let dx = d.x - o.x;
            let dy = d.y - o.y;
            if (ataqueId === 'puno')    { dx += azar(-18, 18); dy += azar(-18, 18); }              // ráfaga concentrada
            if (ataqueId === 'patada')  { dy += (i - cantidad / 2) * 14; }                        // estela diagonal
            if (ataqueId === 'barrida') { dy += (i - cantidad / 2) * (d.h / cantidad); }          // abanico ancho

            const particula = document.createElement('span');
            particula.className = `efecto-particula efecto-${ataqueId}`;
            particula.textContent = info.particula;
            particula.style.cssText = `left:${o.x}px;top:${o.y}px;--dx:${dx}px;--dy:${dy}px;--delay:${i * 45}ms;--glow:${info.color}`;
            particula.addEventListener('animationend', () => particula.remove());
            this.arena.append(particula);
        }

        const impacto = document.createElement('div');
        impacto.className = 'efecto-impacto';
        impacto.style.cssText = `left:${d.x}px;top:${d.y}px;--glow:${info.color}`;
        impacto.addEventListener('animationend', () => impacto.remove());
        this.arena.append(impacto);

        const cartel = document.createElement('div');
        cartel.className = `cartel-habilidad ${lado}`;
        cartel.style.setProperty('--glow', info.color);
        cartel.textContent = `${info.emoji} ${nombreHabilidad}`;
        cartel.addEventListener('animationend', () => cartel.remove());
        this.arena.append(cartel);
    }

    // La tarjeta recibe el golpe: tiembla, sale "-1" y tiembla toda la pantalla.
    // La fuerza del temblor depende del movimiento (barrida > patada > puño).
    golpear(tarjeta, ataqueId = 'puno', elemento = 'guerrero', recibioJugador = false) {
        if (!tarjeta) return;
        const info = ELEMENTOS[elemento] ?? ELEMENTOS.guerrero;
        tarjeta.classList.add('golpeado');
        setTimeout(() => tarjeta.classList.remove('golpeado'), 500);

        this.temblarPantalla({ puno: 'medio', patada: 'medio', barrida: 'fuerte' }[ataqueId] ?? 'medio');
        this.destello(info.color, 'flash-pantalla');
        if (recibioJugador) this.destello('#ef4444', 'vineta-dano');

        if (this.arena.contains(tarjeta)) {
            const base = this.arena.getBoundingClientRect();
            const r = tarjeta.getBoundingClientRect();
            const numero = document.createElement('div');
            numero.className = 'numero-danio';
            numero.textContent = '-1 💔';
            numero.style.cssText = `left:${r.left + r.width / 2 - base.left}px;top:${r.top - base.top + 20}px`;
            numero.addEventListener('animationend', () => numero.remove());
            this.arena.append(numero);
        }
    }

    // Choque de movimientos iguales (empate): temblor suave y destello blanco
    choque() {
        this.temblarPantalla('leve');
        this.destello('#ffffff', 'flash-pantalla');
    }

    // Hace temblar todas las secciones de la página (y el fondo)
    temblarPantalla(intensidad) {
        const clases = ['tiembla-leve', 'tiembla-medio', 'tiembla-fuerte'];
        document.body.classList.remove(...clases);
        void document.body.offsetWidth;   // reinicia la animación si ya estaba temblando
        document.body.classList.add(`tiembla-${intensidad}`);
        clearTimeout(this.temporizadorTemblor);
        this.temporizadorTemblor = setTimeout(() => document.body.classList.remove(...clases), 650);
    }

    // Capa de color que aparece y se desvanece sobre toda la pantalla
    destello(color, clase) {
        const capa = document.createElement('div');
        capa.className = `capa-pantalla ${clase}`;
        capa.style.setProperty('--glow', color);
        capa.addEventListener('animationend', () => capa.remove());
        document.body.append(capa);
    }

    // Fin del combate: victoria (rayos + confeti + cartel) o derrota (pantalla roja y gris)
    celebrar(resultado, tarjetaJugador, tarjetaEnemigo) {
        const gano = resultado === 'victoria';
        document.body.classList.add(gano ? 'pantalla-victoria' : 'pantalla-derrota');
        tarjetaJugador?.classList.add(gano ? 'ganador' : 'derrotado');
        tarjetaEnemigo?.classList.add(gano ? 'derrotado' : 'ganador');

        this.temblarPantalla(gano ? 'medio' : 'fuerte');
        this.destello(gano ? '#fcd34d' : '#7f1d1d', 'flash-pantalla');

        const banner = document.createElement('div');
        banner.className = `banner-final ${gano ? 'victoria' : 'derrota'}`;
        banner.textContent = gano ? '¡VICTORIA!' : 'DERROTA';
        document.body.append(banner);
        setTimeout(() => banner.remove(), 3800);

        if (gano) {
            const rayos = document.createElement('div');
            rayos.className = 'rayos-victoria';
            const confeti = document.createElement('div');
            confeti.className = 'confeti';
            const colores = ['#fcd34d', '#f59e0b', '#38bdf8', '#22c55e', '#ef4444', '#ffffff'];
            for (let i = 0; i < 70; i++) {
                const pieza = document.createElement('span');
                pieza.style.cssText =
                    `left:${Math.random() * 100}%;--c:${colores[i % colores.length]};` +
                    `--dur:${2.2 + Math.random() * 2}s;--delay:${Math.random() * 0.9}s;--giro:${Math.random() * 720 - 360}deg`;
                confeti.append(pieza);
            }
            document.body.append(rayos, confeti);
            setTimeout(() => { rayos.remove(); confeti.remove(); }, 5200);
        }
    }

    // Saca todos los efectos de pantalla (al reiniciar)
    limpiar() {
        document.body.classList.remove('pantalla-victoria', 'pantalla-derrota', 'tiembla-leve', 'tiembla-medio', 'tiembla-fuerte');
        document.querySelectorAll('.capa-pantalla, .banner-final, .rayos-victoria, .confeti').forEach(el => el.remove());
    }
}


/* ============================================================
   MOVIMIENTO CINEMÁTICO (el personaje se mueve por el mapa)
   ------------------------------------------------------------
   Clase aparte: maneja las entradas (teclado, botones y click en el
   mapa), la física suave y todos los efectos del canvas.
   Se mueve con: flechas o W A S D · botones de pantalla · click/toque
   en el mapa (va hasta ahí). Shift o Espacio = impulso (dash).
   ============================================================ */
const TECLAS_MAPA = {
    ArrowUp: 'arriba',    KeyW: 'arriba',
    ArrowDown: 'abajo',   KeyS: 'abajo',
    ArrowLeft: 'izquierda', KeyA: 'izquierda',
    ArrowRight: 'derecha',  KeyD: 'derecha'
};

// Dónde queda la nación de cada elemento en el mapa (proporción del ancho y del alto).
// El jugador arranca en su nación y el enemigo en la suya.
const PUNTOS_MAPA = {
    fuego:    { x: 0.20, y: 0.50 },   // Nación del Fuego
    agua:     { x: 0.60, y: 0.14 },   // Tribus Agua (norte)
    aire:     { x: 0.70, y: 0.33 },   // Nómadas del Aire
    tierra:   { x: 0.70, y: 0.60 },   // Reino Tierra
    guerrero: { x: 0.50, y: 0.84 }    // Tribus Agua (sur)
};

// Partículas que deja cada elemento al moverse
const PARTICULAS_MAPA = {
    fuego:    { colores: ['#f97316', '#fbbf24', '#ef4444'], gravedad: -90, forma: 'circulo' },
    agua:     { colores: ['#38bdf8', '#7dd3fc', '#e0f2fe'], gravedad: 160, forma: 'circulo' },
    aire:     { colores: ['#ffffff', '#fde68a', '#e5e7eb'], gravedad: -30, forma: 'circulo' },
    tierra:   { colores: ['#84cc16', '#a16207', '#78350f'], gravedad: 220, forma: 'cuadrado' },
    guerrero: { colores: ['#d6b28c', '#ffffff', '#a8a29e'], gravedad: 80,  forma: 'cuadrado' }
};

class MovimientoCinematico {
    constructor(mapa, efectos) {
        this.mapa    = mapa;
        this.lienzo  = mapa.getContext('2d');
        this.efectos = efectos;
        this.alConfirmar = null;          // lo que pasa al apretar Enter (ir al combate)
        this.enemigo   = null;            // la ficha del enemigo que espera en el mapa

        // Imagen de fondo del mapa (img/mapa.jpg). Prueba varias rutas hasta encontrarla.
        this.fondo = new Image();
        const rutasFondo = ['./img/mapa.jpg', './assets/mapa.jpg', './mapa.jpg', './MAPA.jpg'];
        let intentoFondo = 0;
        this.fondo.addEventListener('error', () => {
            intentoFondo++;
            if (intentoFondo < rutasFondo.length) this.fondo.src = rutasFondo[intentoFondo];
        });
        this.fondo.src = rutasFondo[0];

        this.personaje = null;
        this.activo    = false;
        this.cuadro    = null;            // id del requestAnimationFrame
        this.ultimo    = 0;
        this.tiempo    = 0;

        this.teclas  = new Set();         // entradas del teclado
        this.botones = new Set();         // entradas de los botones de pantalla / táctiles
        this.destino = null;              // punto donde se hizo click en el mapa

        this.mirandoIzquierda = false;
        this.ultimaDireccion  = { x: 1, y: 0 };
        this.impulsoRestante  = 0;        // segundos que dura el dash
        this.enfriamiento     = 0;        // espera antes de otro dash

        this.estela     = [];             // posiciones anteriores (imagen "fantasma")
        this.particulas = [];
        this.ondas      = [];             // círculos del click

        window.addEventListener('keydown', e => this.alPresionar(e));
        window.addEventListener('keyup',   e => this.alSoltar(e));
        window.addEventListener('blur',    () => this.teclas.clear());
        mapa.addEventListener('pointerdown', e => this.alTocarMapa(e));
    }

    // ---------- ENTRADAS ----------

    hayModalAbierto() {
        return !!document.querySelector('#modal-crear-personaje:not(.oculto), #modal-reglas:not(.oculto)');
    }

    escribiendo(evento) {
        return !!evento.target.closest?.('input, textarea, select');
    }

    alPresionar(e) {
        if (!this.activo || this.hayModalAbierto() || this.escribiendo(e)) return;
        if (TECLAS_MAPA[e.code]) {
            this.teclas.add(TECLAS_MAPA[e.code]);
            e.preventDefault();               // que las flechas no muevan la página
        } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'Space') {
            e.preventDefault();
            if (!e.repeat) this.impulso();
        } else if (e.code === 'Enter' && e.target.tagName !== 'BUTTON' && this.alConfirmar) {
            this.alConfirmar();
        }
    }

    alSoltar(e) {
        if (TECLAS_MAPA[e.code]) this.teclas.delete(TECLAS_MAPA[e.code]);
    }

    // Click o toque en el mapa: el personaje se desliza hasta ese punto
    alTocarMapa(e) {
        if (!this.activo) return;
        const caja = this.mapa.getBoundingClientRect();
        this.destino = {
            x: (e.clientX - caja.left) * (this.mapa.width  / caja.width),
            y: (e.clientY - caja.top)  * (this.mapa.height / caja.height)
        };
        this.ondas.push({ x: this.destino.x, y: this.destino.y, t: 0 });
    }

    // Impulso: durante un instante va al doble de velocidad y deja estela
    impulso() {
        if (this.enfriamiento > 0 || !this.personaje) return;
        this.impulsoRestante = 0.25;
        this.enfriamiento    = 0.8;
        this.efectos.reproducir('patada');
        this.efectos.temblarPantalla('leve');
        this.emitir(14, 1.6);
    }

    // ---------- CICLO ----------

    iniciar(personaje, enemigo = null) {
        this.detener();
        this.personaje  = personaje;
        this.enemigo    = enemigo;

        // Cada uno arranca en su nación; si son del mismo elemento, el enemigo queda al lado
        const punto = p => PUNTOS_MAPA[p.elemento] ?? PUNTOS_MAPA.guerrero;
        personaje.x = punto(personaje).x * this.mapa.width  - personaje.ancho / 2;
        personaje.y = punto(personaje).y * this.mapa.height - personaje.alto  / 2;
        if (enemigo) {
            const mismo = enemigo.elemento === personaje.elemento;
            enemigo.x = punto(enemigo).x * this.mapa.width  - enemigo.ancho / 2 + (mismo ? 150 : 0);
            enemigo.y = punto(enemigo).y * this.mapa.height - enemigo.alto  / 2 + (mismo ? 70 : 0);
        }
        this.estela     = [];
        this.particulas = [];
        this.ondas      = [];
        this.activo     = true;
        this.ultimo     = performance.now();

        const bucle = ahora => {
            if (!this.activo) return;
            const dt = Math.min((ahora - this.ultimo) / 1000, 0.05);
            this.ultimo = ahora;
            this.actualizar(dt);
            this.pintar();
            this.cuadro = requestAnimationFrame(bucle);
        };
        this.cuadro = requestAnimationFrame(bucle);
        this.pintar();
    }

    detener() {
        this.activo = false;
        cancelAnimationFrame(this.cuadro);
        this.teclas.clear();
        this.botones.clear();
        this.destino = null;
        if (this.personaje) {
            this.personaje.velocidadX = 0;
            this.personaje.velocidadY = 0;
        }
    }

    // ---------- FÍSICA ----------

    actualizar(dt) {
        const p = this.personaje;
        if (!p) return;
        this.tiempo += dt;
        this.enfriamiento    = Math.max(0, this.enfriamiento - dt);
        this.impulsoRestante = Math.max(0, this.impulsoRestante - dt);

        // 1) ¿hacia dónde quiere ir? (teclado + botones, o el punto del click)
        const entradas = new Set([...this.teclas, ...this.botones]);
        let dx = (entradas.has('derecha') ? 1 : 0) - (entradas.has('izquierda') ? 1 : 0);
        let dy = (entradas.has('abajo')   ? 1 : 0) - (entradas.has('arriba')    ? 1 : 0);

        let frenado = 1;                              // 1 = velocidad plena; baja al acercarse al destino
        if (dx || dy) {
            this.destino = null;                      // el teclado manda sobre el click
        } else if (this.destino) {
            const vx = this.destino.x - (p.x + p.ancho / 2);
            const vy = this.destino.y - (p.y + p.alto  / 2);
            const distancia = Math.hypot(vx, vy);
            if (distancia > 6) {
                dx = vx / distancia; dy = vy / distancia;
                frenado = Math.max(0.15, Math.min(1, distancia / 90));   // llega frenando, sin pasarse
            }
            else this.destino = null;
        }

        const largo = Math.hypot(dx, dy);
        if (largo) {                                  // la diagonal no es más rápida
            dx /= largo; dy /= largo;
            this.ultimaDireccion = { x: dx, y: dy };
        } else if (this.impulsoRestante > 0) {        // dash sin dirección: sigue hacia donde miraba
            dx = this.ultimaDireccion.x; dy = this.ultimaDireccion.y;
        }

        // 2) velocidad con inercia: acelera y frena suave (en vez de cortarse de golpe)
        const maxima = this.impulsoRestante > 0 ? 560 : 260;       // píxeles por segundo
        const suavizado = 1 - Math.exp(-dt * (largo || this.impulsoRestante > 0 ? 9 : 6));
        p.velocidadX += (dx * maxima * frenado - p.velocidadX) * suavizado;
        p.velocidadY += (dy * maxima * frenado - p.velocidadY) * suavizado;

        // 3) mover y no salirse del mapa
        p.x += p.velocidadX * dt;
        p.y += p.velocidadY * dt;
        const maxX = this.mapa.width  - p.ancho;
        const maxY = this.mapa.height - p.alto;
        if (p.x < 0 || p.x > maxX) { p.x = Math.max(0, Math.min(p.x, maxX)); p.velocidadX = 0; }
        if (p.y < 0 || p.y > maxY) { p.y = Math.max(0, Math.min(p.y, maxY)); p.velocidadY = 0; }

        if (Math.abs(p.velocidadX) > 30) this.mirandoIzquierda = p.velocidadX < 0;

        // 4) efectos que dependen de la velocidad
        const velocidad = Math.hypot(p.velocidadX, p.velocidadY);
        if (velocidad > 40) this.emitir(velocidad > 400 ? 2 : 1, 1);
        if (velocidad > 120) {
            this.estela.push({ x: p.x, y: p.y, espejo: this.mirandoIzquierda });
            if (this.estela.length > 9) this.estela.shift();
        } else if (this.estela.length) {
            this.estela.shift();
        }

        const info = PARTICULAS_MAPA[p.elemento] ?? PARTICULAS_MAPA.guerrero;
        this.particulas.forEach(q => {
            q.vida -= dt;
            q.vy += info.gravedad * dt;
            q.x += q.vx * dt;
            q.y += q.vy * dt;
        });
        this.particulas = this.particulas.filter(q => q.vida > 0);
        this.ondas.forEach(o => { o.t += dt; });
        this.ondas = this.ondas.filter(o => o.t < 0.6);
    }

    // Suelta partículas del elemento desde los pies
    emitir(cantidad, fuerza) {
        const p = this.personaje;
        const info = PARTICULAS_MAPA[p.elemento] ?? PARTICULAS_MAPA.guerrero;
        for (let i = 0; i < cantidad; i++) {
            this.particulas.push({
                x: p.x + p.ancho / 2 + (Math.random() - 0.5) * p.ancho * 0.6,
                y: p.y + p.alto - 6,
                vx: -p.velocidadX * 0.25 + (Math.random() - 0.5) * 80 * fuerza,
                vy: -p.velocidadY * 0.25 + (Math.random() - 0.7) * 70 * fuerza,
                vida: 0.45 + Math.random() * 0.4,
                total: 0.85,
                tam: 2 + Math.random() * 4 * fuerza,
                color: info.colores[Math.floor(Math.random() * info.colores.length)],
                forma: info.forma
            });
        }
    }

    // ---------- DIBUJO ----------

    // El enemigo espera en su nación: ficha con aro que late, su nombre y, si estás cerca, el aviso
    pintarEnemigo(ctx) {
        const e = this.enemigo;
        const p = this.personaje;
        if (!e) return;
        const info = ELEMENTOS[e.elemento] ?? ELEMENTOS.guerrero;
        const ecx = e.x + e.ancho / 2;
        const pulso = (Math.sin(this.tiempo * 4) + 1) / 2;

        ctx.beginPath();
        ctx.ellipse(ecx, e.y + e.alto - 3, e.ancho / 2 + 10 + pulso * 8, 12 + pulso * 4, 0, 0, Math.PI * 2);
        ctx.lineWidth = 3;
        ctx.strokeStyle = info.color;
        ctx.globalAlpha = 0.85 - pulso * 0.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
        e.pintarEnMapa(ctx, e.x, e.y, !!p && (p.x + p.ancho / 2) < ecx);   // el enemigo te mira

        const cerca = p && Math.hypot(ecx - (p.x + p.ancho / 2), (e.y + e.alto / 2) - (p.y + p.alto / 2)) < 110;
        ctx.font = '600 14px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
        const rotulo = `⚔️ ${e.nombre}`;
        ctx.strokeText(rotulo, ecx, Math.max(16, e.y - 10));
        ctx.fillStyle = '#fff';
        ctx.fillText(rotulo, ecx, Math.max(16, e.y - 10));
        if (cerca) {
            ctx.font = '700 15px Outfit, sans-serif';
            ctx.strokeText('¡Enter para pelear!', ecx, e.y + e.alto + 22);
            ctx.fillStyle = '#fcd34d';
            ctx.fillText('¡Enter para pelear!', ecx, e.y + e.alto + 22);
        }
        ctx.textAlign = 'start';
    }

    pintar() {
        const p = this.personaje;
        if (!p) return;
        const ctx = this.lienzo;
        const info = ELEMENTOS[p.elemento] ?? ELEMENTOS.guerrero;
        const cx = p.x + p.ancho / 2;

        ctx.clearRect(0, 0, this.mapa.width, this.mapa.height);

        // Fondo: el mapa de las Cuatro Naciones (como en la clase: drawImage de 0,0 a todo el canvas)
        if (this.fondo.complete && this.fondo.naturalWidth > 0) {
            ctx.drawImage(this.fondo, 0, 0, this.mapa.width, this.mapa.height);
        } else {
            ctx.fillStyle = '#1b3550';
            ctx.fillRect(0, 0, this.mapa.width, this.mapa.height);
        }

        this.pintarEnemigo(ctx);

        // Círculos del click
        this.ondas.forEach(o => {
            ctx.globalAlpha = 1 - o.t / 0.6;
            ctx.strokeStyle = info.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(o.x, o.y, 6 + o.t * 60, 0, Math.PI * 2);
            ctx.stroke();
        });
        ctx.globalAlpha = 1;

        // Resplandor y sombra en el suelo
        const flotar = p.elemento === 'aire' ? 10 : 0;                       // Aang levita
        const respira = Math.sin(this.tiempo * 3) * (p.elemento === 'aire' ? 5 : 2);
        const suelo = p.y + p.alto - 2;
        const brillo = ctx.createRadialGradient(cx, suelo, 2, cx, suelo, p.ancho * 0.8);
        brillo.addColorStop(0, info.color + '66');
        brillo.addColorStop(1, info.color + '00');
        ctx.fillStyle = brillo;
        ctx.fillRect(cx - p.ancho, suelo - p.ancho * 0.5, p.ancho * 2, p.ancho);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
        ctx.beginPath();
        ctx.ellipse(cx, suelo, p.ancho * 0.36 * (1 - (flotar + respira) / 80), 7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Partículas
        this.particulas.forEach(q => {
            ctx.globalAlpha = Math.max(0, q.vida / q.total);
            ctx.fillStyle = q.color;
            if (q.forma === 'cuadrado') ctx.fillRect(q.x, q.y, q.tam, q.tam);
            else { ctx.beginPath(); ctx.arc(q.x, q.y, q.tam, 0, Math.PI * 2); ctx.fill(); }
        });
        ctx.globalAlpha = 1;

        // Estela: copias "fantasma" cada vez más transparentes
        this.estela.forEach((f, i) => {
            ctx.save();
            ctx.globalAlpha = (i / this.estela.length) * (this.impulsoRestante > 0 ? 0.5 : 0.28);
            ctx.translate(f.x + p.ancho / 2, f.y + p.alto / 2 - flotar);
            p.pintarEnMapa(ctx, -p.ancho / 2, -p.alto / 2, f.espejo);
            ctx.restore();
        });

        // Personaje: se inclina y se estira según la velocidad, y se da vuelta al ir a la izquierda
        const velocidad = Math.hypot(p.velocidadX, p.velocidadY);
        const estira = Math.min(velocidad / 560, 1);
        ctx.save();
        ctx.translate(cx, p.y + p.alto / 2 + respira - flotar);
        ctx.rotate(Math.max(-1, Math.min(1, p.velocidadX / 260)) * 0.09);
        ctx.scale(1 + estira * 0.12, 1 - estira * 0.08);
        p.pintarEnMapa(ctx, -p.ancho / 2, -p.alto / 2, this.mirandoIzquierda);   // se da vuelta al ir a la izquierda
        ctx.restore();

        // Nombre sobre la cabeza
        ctx.font = '600 14px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillStyle = '#fff';
        const rotulo = `${info.emoji} ${p.nombre}`;
        const yRotulo = Math.max(16, p.y - 8 - flotar + respira);
        ctx.strokeText(rotulo, cx, yRotulo);
        ctx.fillText(rotulo, cx, yRotulo);
        ctx.textAlign = 'start';
    }
}


/* ============================================================
   MODO PELEA 2D (segundo juego dentro de la misma página)
   ------------------------------------------------------------
   Pelea en tiempo real, de costado, al mejor de 3 rondas.
   Clase aparte: PeleaArcade. Se juega contra la CPU o de a dos.
   ============================================================ */
const CONTROLES_PELEA = [
    { izq: ['KeyA'],      der: ['KeyD'],       salto: ['KeyW'],    bloq: ['KeyS'],      puno: ['KeyF'], patada: ['KeyG'], especial: ['KeyH'] },
    { izq: ['ArrowLeft'], der: ['ArrowRight'], salto: ['ArrowUp'], bloq: ['ArrowDown'], puno: ['KeyK'], patada: ['KeyL'], especial: ['Semicolon'] }
];

const GOLPES = {
    puno:     { danio: 8,  alcance: 82,  inicio: 0.07, fin: 0.17, total: 0.30, retroceso: 150, emoji: '👊' },
    patada:   { danio: 12, alcance: 115, inicio: 0.12, fin: 0.26, total: 0.46, retroceso: 270, emoji: '🦵' },
    especial: { danio: 14, total: 0.55, lanzar: 0.25 }
};

// Hacia dónde mira la foto original (las demás miran a la derecha). Si un personaje
// se ve "al revés", cambiá 'izquierda' por 'derecha' acá.
const MIRADA_FOTO = {};

class PeleaArcade {
    constructor(canvas, efectos) {
        this.canvas  = canvas;
        this.ctx     = canvas.getContext('2d');
        this.efectos = efectos;
        this.ancho   = canvas.width;
        this.alto    = canvas.height;
        this.suelo   = this.alto - 52;           // altura (y) donde "pisan" los peleadores

        this.activo = false;
        this.cuadro = null;
        this.teclas = new Set();                 // teclas mantenidas
        this.pulsadas = new Set();               // teclas recién apretadas (para golpes y salto)
        this.peleadores = [];

        window.addEventListener('keydown', e => this.alPresionar(e));
        window.addEventListener('keyup',   e => this.teclas.delete(e.code));
        window.addEventListener('blur',    () => this.teclas.clear());
    }

    // ---------- ENTRADAS ----------

    alPresionar(e) {
        if (!this.activo) return;
        if (document.querySelector('#modal-crear-personaje:not(.oculto), #modal-reglas:not(.oculto)')) return;
        if (e.target.closest?.('input, textarea, select')) return;

        if (this.fase === 'fin' && (e.code === 'Enter' || e.code === 'KeyR')) { this.revancha(); return; }

        const usada = CONTROLES_PELEA.some(c => Object.values(c).some(lista => lista.includes(e.code)));
        if (!usada) return;
        e.preventDefault();                      // que las flechas no muevan la página
        if (!this.teclas.has(e.code)) this.pulsadas.add(e.code);
        this.teclas.add(e.code);
    }

    entrada(f, i, rival, dt) {
        if (f.cpu) return this.ia(f, rival, dt);
        // En "1 jugador" el jugador 1 puede usar WASD+FGH o las flechas+KL;
        const mapas = (this.modo === '1p' && i === 0) ? CONTROLES_PELEA : [CONTROLES_PELEA[i]];
        const mantiene = accion => mapas.some(m => m[accion].some(c => this.teclas.has(c)));
        const apreto   = accion => mapas.some(m => m[accion].some(c => this.pulsadas.has(c)));
        return {
            izq: mantiene('izq'), der: mantiene('der'), bloq: mantiene('bloq'), salto: mantiene('salto'),
            puno: apreto('puno'), patada: apreto('patada'), especial: apreto('especial')
        };
    }

    // Inteligencia de la CPU: decide cada ~0.2-0.5 segundos según la distancia
    ia(f, rival, dt) {
        const ia = f.ia;
        ia.t -= dt;
        const distancia = Math.abs(rival.x - f.x);
        const hacia = rival.x > f.x ? 1 : -1;
        if (ia.t <= 0) {
            ia.t = 0.18 + Math.random() * 0.3;
            ia.mov = 0;
            ia.bloq = false;
            const r = Math.random();
            if (rival.ataque && distancia < 150 && r < 0.5)  { ia.bloq = true; ia.t = 0.45; }
            else if (distancia > 230) {
                if (f.cooldown <= 0 && r < 0.3) ia.accion = 'especial';
                else if (r < 0.08) ia.accion = 'salto';
                else ia.mov = hacia;
            } else if (distancia > 118) {
                ia.mov = r < 0.7 ? hacia : 0;
                if (r > 0.9) ia.accion = 'patada';
            } else {
                if (r < 0.38) ia.accion = 'puno';
                else if (r < 0.72) ia.accion = 'patada';
                else if (r < 0.85) ia.mov = -hacia;
                else if (r < 0.93) ia.bloq = true;
                else ia.accion = 'salto';
            }
        }
        const salida = { izq: ia.mov < 0, der: ia.mov > 0, bloq: ia.bloq, salto: false, puno: false, patada: false, especial: false };
        if (ia.accion) { salida[ia.accion] = true; ia.accion = null; }
        return salida;
    }

    // ---------- PARTIDA ----------

    comenzar(modo, personaje1, personaje2) {
        this.detener();
        this.efectos.limpiar();
        this.modo = modo;                        // '1p' (vs CPU) o '2p'
        this.peleadores = [this.crearPeleador(personaje1, 0), this.crearPeleador(personaje2, 1)];
        this.peleadores[1].cpu = (modo === '1p');
        this.particulas = [];
        this.textos = [];
        this.ronda = 1;
        this.t = 0;
        this.nuevaRonda();

        this.activo = true;
        let ultimo = performance.now();
        const bucle = ahora => {
            if (!this.activo) return;
            this.actualizar(Math.min((ahora - ultimo) / 1000, 0.05));
            ultimo = ahora;
            this.pintar();
            this.cuadro = requestAnimationFrame(bucle);
        };
        this.cuadro = requestAnimationFrame(bucle);
        this.pintar();
    }

    revancha() {
        this.comenzar(this.modo, this.peleadores[0].personaje, this.peleadores[1].personaje);
    }

    detener() {
        this.activo = false;
        cancelAnimationFrame(this.cuadro);
        this.teclas.clear();
        this.pulsadas.clear();
    }

    crearPeleador(personaje, lado) {
        personaje.prepararMapa();
        return { personaje, lado, rondas: 0, cpu: false, ultimoGolpe: -9 };
    }

    nuevaRonda() {
        this.peleadores.forEach((f, i) => {
            Object.assign(f, {
                x: i ? this.ancho - 220 : 220, y: this.suelo, vx: 0, vy: 0,
                vida: 100, vidaVisible: 100, cara: i ? -1 : 1, estado: 'quieto',
                ataque: null, aturdido: 0, cooldown: 0, flash: 0, combo: 0, tko: 0,
                ia: { t: 0.6, mov: 0, bloq: false, accion: null }
            });
        });
        this.proyectiles = [];
        this.fase = 'intro';      // intro → lucha → ko → (nueva ronda | fin)
        this.faseT = 0;
        this.tiempo = 60;
        this.escala = 1;          // 1 = velocidad normal; bajo = cámara lenta (KO)
        this.hitstop = 0;         // pausa cortita al golpear para que "pese"
    }

    // ---------- ACTUALIZACIÓN ----------

    actualizar(dtReal) {
        this.t += dtReal;
        this.faseT += dtReal;
        if (this.hitstop > 0) { this.hitstop -= dtReal; this.actualizarEfectos(dtReal); return; }

        const dt = dtReal * this.escala;
        if (this.fase === 'intro' && this.faseT > 1.7) { this.fase = 'lucha'; this.faseT = 0; }
        const lucha = this.fase === 'lucha';

        this.peleadores.forEach((f, i) => {
            const rival = this.peleadores[1 - i];
            this.mover(f, rival, lucha ? this.entrada(f, i, rival, dt) : {}, dt);
        });
        this.pulsadas.clear();

        // Que no se atraviesen
        const [a, b] = this.peleadores;
        const separacion = b.x - a.x;
        if (Math.abs(separacion) < 62 && Math.abs(a.y - b.y) < 110) {
            const empuje = (62 - Math.abs(separacion)) / 2 * (separacion >= 0 ? 1 : -1);
            a.x = Math.max(50, Math.min(this.ancho - 50, a.x - empuje));
            b.x = Math.max(50, Math.min(this.ancho - 50, b.x + empuje));
        }

        this.actualizarProyectiles(dt);

        if (lucha) {
            this.tiempo -= dtReal;
            if (this.tiempo <= 0) {
                const diferencia = a.vida - b.vida;
                this.finRonda(diferencia > 0 ? a : diferencia < 0 ? b : null, 'TIEMPO');
            }
        }
        if (this.fase === 'ko') {
            if (this.escala < 1 && this.faseT > 0.9) this.escala = 1;
            if (this.faseT > 2.3) this.cerrarRonda();
        }
        this.peleadores.forEach(f => { f.vidaVisible = Math.max(f.vida, f.vidaVisible - 35 * dtReal); });
        this.actualizarEfectos(dtReal);
    }

    mover(f, rival, e, dt) {
        f.cooldown = Math.max(0, f.cooldown - dt);
        f.flash    = Math.max(0, f.flash - dt);
        f.aturdido = Math.max(0, f.aturdido - dt);
        const enSuelo = f.y >= this.suelo;

        if (f.estado === 'ko') {
            f.tko += dt;
        } else if (f.aturdido > 0) {
            f.estado = 'golpeado';
        } else if (f.ataque) {
            f.ataque.t += dt;
            this.avanzarAtaque(f, rival);
            if (f.ataque && f.ataque.t >= f.ataque.total) { f.ataque = null; f.estado = 'quieto'; }
        } else {
            f.estado = 'quieto';
            const direccion = (e.der ? 1 : 0) - (e.izq ? 1 : 0);
            if (e.bloq && enSuelo) {
                f.estado = 'bloqueo';
                f.vx = 0;
            } else {
                if (enSuelo) f.vx = direccion * 230;
                else f.vx = Math.max(-260, Math.min(260, f.vx + direccion * 700 * dt));   // poco control en el aire
                if (direccion && enSuelo) f.estado = 'caminar';
                if (e.salto && enSuelo) f.vy = -780;
                if (e.puno) this.atacar(f, 'puno');
                else if (e.patada) this.atacar(f, 'patada');
                else if (e.especial && f.cooldown <= 0) this.atacar(f, 'especial');
            }
        }

        // Física: gravedad, desplazamiento y fricción
        if (f.y < this.suelo || f.vy < 0) {
            f.vy += 2100 * dt;
            f.y += f.vy * dt;
            if (f.y >= this.suelo) { f.y = this.suelo; f.vy = 0; }
        }
        f.x += f.vx * dt;
        if (enSuelo && (f.aturdido > 0 || f.ataque || f.estado === 'ko')) f.vx *= Math.max(0, 1 - 9 * dt);
        f.x = Math.max(50, Math.min(this.ancho - 50, f.x));
        if (f.estado !== 'ko' && !f.ataque && f.aturdido <= 0 && rival.estado !== 'ko') f.cara = rival.x >= f.x ? 1 : -1;
    }

    atacar(f, tipo) {
        f.ataque = { tipo, t: 0, total: GOLPES[tipo].total, golpeo: false, lanzado: false };
        f.estado = 'ataque';
        if (f.y >= this.suelo) f.vx = 0;
    }

    avanzarAtaque(f, rival) {
        const a = f.ataque;
        const g = GOLPES[a.tipo];
        if (a.tipo === 'especial') {
            if (!a.lanzado && a.t >= g.lanzar) {          // el poder del elemento sale disparado
                a.lanzado = true;
                f.cooldown = 1.6;
                this.proyectiles.push({ x: f.x + f.cara * 50, y: f.y - 80, vx: f.cara * 540, duenio: f, vida: 2 });
                this.efectos.sonar('barrida', f.personaje.elemento);
                this.efectos.temblarPantalla('leve');
            }
            return;
        }
        if (!a.golpeo && a.t >= g.inicio && a.t <= g.fin) {
            const adelante = (rival.x - f.x) * f.cara;   // distancia hacia donde mira
            if (adelante > -20 && adelante <= g.alcance && Math.abs(rival.y - f.y) < 90 && rival.estado !== 'ko') {
                a.golpeo = true;
                this.impactar(f, rival, a.tipo, g.danio, g.retroceso);
            }
        }
    }

    actualizarProyectiles(dt) {
        const info = f => ELEMENTOS[f.personaje.elemento] ?? ELEMENTOS.guerrero;
        this.proyectiles = this.proyectiles.filter(p => {
            p.x += p.vx * dt;
            p.vida -= dt;
            this.chispa(p.x, p.y + (Math.random() - 0.5) * 24, info(p.duenio).color, 1, 40);
            const rival = this.peleadores.find(f => f !== p.duenio);
            if (rival.estado !== 'ko' && Math.abs(p.x - rival.x) < 44 && Math.abs(p.y - (rival.y - 75)) < 85) {
                this.impactar(p.duenio, rival, 'especial', GOLPES.especial.danio, 320);
                return false;
            }
            return p.vida > 0 && p.x > -40 && p.x < this.ancho + 40;
        });
    }

    // Un golpe (o poder) le da al rival
    impactar(f, rival, tipo, danio, retroceso) {
        if (this.fase !== 'lucha') return;
        const info = ELEMENTOS[f.personaje.elemento] ?? ELEMENTOS.guerrero;
        const bloqueado = rival.estado === 'bloqueo';
        const centro = { x: rival.x - f.cara * 12, y: rival.y - 95 };

        if (bloqueado) {
            danio *= 0.15;
            retroceso *= 0.35;
            this.chispa(centro.x, centro.y, '#bae6fd', 8, 220);
            this.textos.push({ x: rival.x, y: rival.y - 170, txt: 'BLOQUEO', color: '#bae6fd', t: 0 });
        } else {
            rival.aturdido = tipo === 'puno' ? 0.26 : 0.4;
            rival.estado = 'golpeado';
            rival.ataque = null;
            if (tipo !== 'puno') rival.vy = -300;      // la patada y los poderes lo levantan
            this.chispa(centro.x, centro.y, info.color, tipo === 'puno' ? 10 : 18, 380);
            this.textos.push({ x: rival.x, y: rival.y - 170, txt: `-${Math.round(danio)}`, color: '#fecaca', t: 0 });
            this.efectos.temblarPantalla(tipo === 'puno' ? 'leve' : tipo === 'patada' ? 'medio' : 'fuerte');
            if (tipo !== 'puno') this.efectos.destello(info.color, 'flash-pantalla');

            f.combo = (this.t - f.ultimoGolpe < 1.3) ? f.combo + 1 : 1;
            f.ultimoGolpe = this.t;
            if (f.combo >= 2) this.textos.push({ x: f.x, y: f.y - 190, txt: `${f.combo} HITS`, color: '#fcd34d', t: 0 });
        }

        rival.vida = Math.max(0, rival.vida - danio);
        rival.vx = f.cara * retroceso;
        rival.flash = 0.18;
        this.hitstop = tipo === 'puno' ? 0.06 : 0.11;
        this.efectos.sonar(tipo === 'especial' ? 'barrida' : tipo, f.personaje.elemento);
        if (rival.vida <= 0) this.finRonda(f, 'KO');
    }

    finRonda(ganador, motivo) {
        if (this.fase !== 'lucha') return;
        this.fase = 'ko';
        this.faseT = 0;
        this.motivo = motivo;
        if (ganador) ganador.rondas++;
        else this.peleadores.forEach(f => { f.rondas++; });         // empate: punto para los dos
        if (motivo === 'KO') {
            const perdedor = this.peleadores.find(f => f !== ganador);
            perdedor.estado = 'ko';
            perdedor.tko = 0;
            perdedor.ataque = null;
            perdedor.vy = -420;
            perdedor.vx = ganador.cara * 320;
            this.escala = 0.3;                                       // cámara lenta
            this.efectos.temblarPantalla('fuerte');
            this.efectos.destello('#ffffff', 'flash-pantalla');
        }
    }

    cerrarRonda() {
        const [a, b] = this.peleadores;
        if (a.rondas < 2 && b.rondas < 2) { this.ronda++; this.nuevaRonda(); return; }

        this.fase = 'fin';
        this.faseT = 0;
        this.ganador = a.rondas > b.rondas ? a : b.rondas > a.rondas ? b : null;
        const festeja = this.ganador && (this.modo === '2p' || this.ganador === a);
        this.efectos.reproducir(festeja ? 'victoria' : 'derrota');
        this.efectos.celebrar(festeja ? 'victoria' : 'derrota', null, null);
    }

    chispa(x, y, color, cantidad, fuerza) {
        for (let i = 0; i < cantidad; i++) {
            const angulo = Math.random() * Math.PI * 2;
            const velocidad = fuerza * (0.3 + Math.random() * 0.7);
            this.particulas.push({
                x, y, vx: Math.cos(angulo) * velocidad, vy: Math.sin(angulo) * velocidad - 60,
                vida: 0.35 + Math.random() * 0.35, total: 0.7, tam: 2 + Math.random() * 4, color
            });
        }
    }

    actualizarEfectos(dt) {
        this.particulas.forEach(p => { p.vida -= dt; p.vy += 600 * dt; p.x += p.vx * dt; p.y += p.vy * dt; });
        this.particulas = this.particulas.filter(p => p.vida > 0);
        this.textos.forEach(t => { t.t += dt; });
        this.textos = this.textos.filter(t => t.t < 0.9);
    }

    // ---------- DIBUJO ----------

    pintar() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.ancho, this.alto);

        // Suelo
        const piso = ctx.createLinearGradient(0, this.suelo - 10, 0, this.alto);
        piso.addColorStop(0, 'rgba(255, 255, 255, 0.10)');
        piso.addColorStop(0.08, 'rgba(10, 5, 2, 0.45)');
        piso.addColorStop(1, 'rgba(10, 5, 2, 0.85)');
        ctx.fillStyle = piso;
        ctx.fillRect(0, this.suelo + 2, this.ancho, this.alto - this.suelo);

        this.peleadores.forEach(f => this.dibujarPeleador(f));
        this.proyectiles.forEach(p => this.dibujarProyectil(p));

        this.particulas.forEach(p => {
            this.ctx.globalAlpha = Math.max(0, p.vida / p.total);
            this.ctx.fillStyle = p.color;
            this.ctx.fillRect(p.x, p.y, p.tam, p.tam);
        });
        this.ctx.globalAlpha = 1;

        this.textos.forEach(t => {
            ctx.globalAlpha = 1 - t.t / 0.9;
            ctx.font = '700 26px Cinzel, serif';
            ctx.textAlign = 'center';
            ctx.lineWidth = 5;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillStyle = t.color;
            ctx.strokeText(t.txt, t.x, t.y - t.t * 60);
            ctx.fillText(t.txt, t.x, t.y - t.t * 60);
        });
        ctx.globalAlpha = 1;

        this.dibujarHUD();
        this.dibujarCartel();
    }

    dibujarPeleador(f) {
        const ctx = this.ctx;
        const p = f.personaje;
        const info = ELEMENTOS[p.elemento] ?? ELEMENTOS.guerrero;
        const ANCHO = 170, ALTO = 190;
        const altura = this.suelo - f.y;

        // Sombra y resplandor en el suelo
        ctx.fillStyle = `rgba(0, 0, 0, ${0.4 * (1 - Math.min(altura / 320, 0.75))})`;
        ctx.beginPath();
        ctx.ellipse(f.x, this.suelo + 4, 48 * (1 - altura / 700), 9, 0, 0, Math.PI * 2);
        ctx.fill();

        // Animaciones según lo que esté haciendo
        let adelante = 0, giro = 0, estiraX = 1, estiraY = 1;
        const a = f.ataque;
        if (a) {
            const k = Math.sin(Math.min(a.t / a.total, 1) * Math.PI);
            adelante = ({ puno: 24, patada: 36, especial: -10 }[a.tipo]) * k;
            giro = (a.tipo === 'patada' ? -0.28 : 0.1) * k;
            estiraX = 1 + 0.1 * k;
        }
        const respira = Math.sin(this.t * 4 + f.lado) * 3;
        const camina = f.estado === 'caminar' ? Math.sin(this.t * 18) * 5 : 0;
        if (f.estado === 'bloqueo') estiraY = 0.86;
        if (f.estado === 'golpeado') adelante = -14;

        const nativa = MIRADA_FOTO[p.id] ?? 'derecha';
        const espejo = (f.cara === 1) !== (nativa === 'derecha');

        ctx.save();
        ctx.translate(f.x + f.cara * adelante, f.y - 4);
        if (f.estado === 'ko') ctx.rotate(-f.cara * 1.45 * Math.min(f.tko * 3, 1));
        else ctx.rotate(giro * f.cara + (f.vx / 700));
        ctx.scale(estiraX * (espejo ? -1 : 1), estiraY);
        if (f.flash > 0) ctx.filter = 'brightness(2.2) saturate(0.3)';   // destello al recibir un golpe
        p.dibujarSprite(ctx, -ANCHO / 2, -ALTO + camina + respira, ANCHO, ALTO, true);
        ctx.restore();
        ctx.filter = 'none';

        // Efecto del golpe: arco del elemento y el puño o la patada
        if (a && a.tipo !== 'especial' && a.t >= GOLPES[a.tipo].inicio && a.t <= GOLPES[a.tipo].fin + 0.06) {
            const g = GOLPES[a.tipo];
            ctx.save();
            ctx.translate(f.x, f.y - (a.tipo === 'patada' ? 55 : 110));
            ctx.scale(f.cara, 1);
            ctx.globalAlpha = 0.9;
            ctx.strokeStyle = info.color;
            ctx.lineWidth = 7;
            ctx.shadowColor = info.color;
            ctx.shadowBlur = 20;
            ctx.beginPath();
            ctx.arc(g.alcance * 0.15, 0, g.alcance * 0.62, -0.95, 0.95);
            ctx.stroke();
            ctx.font = '40px serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowBlur = 0;
            ctx.fillText(g.emoji, g.alcance * 0.78, 0);
            ctx.restore();
        }
        // Carga del poder especial
        if (a && a.tipo === 'especial' && !a.lanzado) {
            ctx.save();
            ctx.globalAlpha = 0.75;
            ctx.fillStyle = info.color;
            ctx.shadowColor = info.color;
            ctx.shadowBlur = 30;
            ctx.beginPath();
            ctx.arc(f.x + f.cara * 46, f.y - 85, 8 + a.t * 70, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        // Escudo al bloquear
        if (f.estado === 'bloqueo') {
            ctx.save();
            ctx.translate(f.x + f.cara * 30, f.y - 85);
            ctx.scale(f.cara, 1);
            ctx.strokeStyle = 'rgba(186, 230, 253, 0.85)';
            ctx.lineWidth = 6;
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = 16;
            ctx.beginPath();
            ctx.arc(0, 0, 66, -1.15, 1.15);
            ctx.stroke();
            ctx.restore();
        }
    }

    dibujarProyectil(p) {
        const ctx = this.ctx;
        const info = ELEMENTOS[p.duenio.personaje.elemento] ?? ELEMENTOS.guerrero;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(p.vx > 0 ? 1 : -1, 1);
        ctx.shadowColor = info.color;
        ctx.shadowBlur = 28;
        ctx.font = '58px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(info.particula, 0, 0);
        ctx.restore();
    }

    dibujarHUD() {
        const ctx = this.ctx;
        const anchoBarra = 370;
        this.peleadores.forEach((f, i) => {
            const info = ELEMENTOS[f.personaje.elemento] ?? ELEMENTOS.guerrero;
            const x0 = i === 0 ? 24 : this.ancho - 24 - anchoBarra;
            const lleno = w => (i === 0 ? x0 : x0 + anchoBarra - w);   // la barra del jugador 2 se vacía hacia la derecha

            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(x0 - 3, 15, anchoBarra + 6, 30);
            const wEstela = anchoBarra * f.vidaVisible / 100;
            const wVida   = anchoBarra * f.vida / 100;
            ctx.fillStyle = '#facc15';
            ctx.fillRect(lleno(wEstela), 18, wEstela, 24);                   // estela amarilla del daño
            ctx.fillStyle = f.vida > 50 ? '#22c55e' : f.vida > 25 ? '#f59e0b' : '#ef4444';
            ctx.fillRect(lleno(wVida), 18, wVida, 24);

            ctx.font = '700 17px Cinzel, serif';
            ctx.textAlign = i === 0 ? 'left' : 'right';
            ctx.fillStyle = '#fff';
            ctx.fillText(`${info.emoji} ${f.personaje.nombre}${f.cpu ? ' (CPU)' : ''}`, i === 0 ? x0 : x0 + anchoBarra, 68);

            for (let r = 0; r < 2; r++) {                                    // rondas ganadas
                ctx.beginPath();
                ctx.arc(i === 0 ? x0 + 8 + r * 22 : x0 + anchoBarra - 8 - r * 22, 82, 7, 0, Math.PI * 2);
                ctx.fillStyle = r < f.rondas ? '#fcd34d' : 'rgba(255, 255, 255, 0.18)';
                ctx.fill();
            }
            // Barrita del poder especial: se llena sola
            const carga = 1 - Math.min(f.cooldown / 1.6, 1);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.fillRect(i === 0 ? x0 : x0 + anchoBarra - 120, 90, 120, 5);
            ctx.fillStyle = carga >= 1 ? info.color : 'rgba(255, 255, 255, 0.55)';
            ctx.fillRect(i === 0 ? x0 : x0 + anchoBarra - 120 * carga, 90, 120 * carga, 5);
        });

        ctx.textAlign = 'center';
        ctx.font = '700 38px Cinzel, serif';
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillStyle = this.tiempo < 10 ? '#fca5a5' : '#fff';
        ctx.strokeText(Math.max(0, Math.ceil(this.tiempo)), this.ancho / 2, 46);
        ctx.fillText(Math.max(0, Math.ceil(this.tiempo)), this.ancho / 2, 46);
        ctx.font = '600 13px Outfit, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillText(`RONDA ${this.ronda}`, this.ancho / 2, 66);
    }

    dibujarCartel() {
        let texto = '', sub = '', local = this.faseT, color = '#fcd34d';
        if (this.fase === 'intro') {
            if (this.faseT < 0.9) texto = `RONDA ${this.ronda}`;
            else { texto = '¡PELEA!'; local = this.faseT - 0.9; color = '#fb923c'; }
        } else if (this.fase === 'ko' && this.faseT > 0.15) {
            texto = this.motivo === 'KO' ? 'K.O.' : this.motivo === 'TIEMPO' ? '¡TIEMPO!' : '';
            color = '#fca5a5';
        } else if (this.fase === 'fin') {
            texto = this.ganador ? `GANA ${this.ganador.personaje.nombre.toUpperCase()}` : 'EMPATE';
            sub = 'Enter o R: revancha';
        }
        if (!texto) return;

        const ctx = this.ctx;
        const pop = 1 + Math.max(0, 0.45 - local * 1.5);
        ctx.save();
        ctx.translate(this.ancho / 2, this.alto * 0.42);
        ctx.scale(pop, pop);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 72px Cinzel, serif';
        ctx.lineWidth = 8;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.shadowColor = color;
        ctx.shadowBlur = 30;
        ctx.fillStyle = color;
        ctx.strokeText(texto, 0, 0);
        ctx.fillText(texto, 0, 0);
        if (sub) {
            ctx.shadowBlur = 0;
            ctx.font = '600 20px Outfit, sans-serif';
            ctx.fillStyle = '#fff';
            ctx.fillText(sub, 0, 56);
        }
        ctx.restore();
    }
}


/* ============================================================
   1) CLASE Ataque — el molde de los movimientos
   ------------------------------------------------------------
   ATRIBUTOS : id, nombre, emoji, venceA, colorClaro, colorOscuro
   MÉTODOS   : leGanaA(), empataCon(), crearBoton()

   Analogía del video: esta clase es el "plano", igual que "Plano de
   Casa". Puño, Patada y Barrida (más abajo, en el array ATAQUES) son
   las "Casas" ya construidas: mismos atributos, distinto valor cada uno.
   ============================================================ */
class Ataque {

    constructor({ id, nombre, emoji, venceA, colorClaro, colorOscuro }) {
        this.id          = id;            // identificador interno ('puno')
        this.nombre      = nombre;        // lo que se lee en pantalla ('Puño')
        this.emoji       = emoji;         // ícono del movimiento
        this.venceA      = venceA;        // id del ataque al que le gana
        this.colorClaro  = colorClaro;    // arriba del degradado del botón
        this.colorOscuro = colorOscuro;   // abajo del degradado del botón
    }

    // Getter: un atributo calculado a partir de otros dos
    get etiqueta() {
        return `${this.emoji} ${this.nombre}`;
    }

    // MÉTODO: ¿este ataque le gana al otro? (piedra-papel-tijera)
    leGanaA(otroAtaque) {
        return this.venceA === otroAtaque.id;
    }

    // MÉTODO: ¿son el mismo movimiento?
    empataCon(otroAtaque) {
        return this.id === otroAtaque.id;
    }

    // MÉTODO: el ataque construye su propio botón, con su color y su evento.
    // Por eso agregar un movimiento nuevo no obliga a tocar el HTML ni el CSS.
    crearBoton(alHacerClick) {
        const boton = document.createElement('button');
        boton.id = `boton-${this.id}`;
        boton.textContent = `${this.nombre} ${this.emoji}`;
        boton.style.setProperty('--color-claro', this.colorClaro);
        boton.style.setProperty('--color-oscuro', this.colorOscuro);
        boton.addEventListener('click', () => alHacerClick(this));
        return boton;
    }
}


/* ============================================================
   2) CLASE Personaje — el molde de los peleadores
   ------------------------------------------------------------
   ATRIBUTOS : id, nombre, emoji, titulo, descripcion, foto,
               tinte, vidasMax, vidas
   MÉTODOS   : estaVivo(), enPeligro(), recibirGolpe(), curarse(),
               porcentajeVida(), presentarse(), elegirAtaque(),
               coincideCon(), clonar(), crearAvatar(), crearTarjeta(),
               crearTarjetaArena(), refrescarVida()

   Analogía del video: esta clase cumple el mismo rol que la clase
   "Animal" del ejemplo (molde para Perro, Gato, Elefante...). Cada
   Personaje (Aang, Katara, Sokka, Haru) es un objeto distinto hecho
   con el mismo molde: mismos ATRIBUTOS (nombre, emoji, vidas...),
   valores propios; mismos MÉTODOS (recibirGolpe, curarse...), pero
   cada uno los ejecuta sobre SUS PROPIOS datos.
   ============================================================ */
class Personaje {

    // Todo lo que se guarda acá adentro con "this." es un ATRIBUTO: un
    // dato propio de CADA objeto (como el color o el peso del Animal del
    // video). Las funciones definidas más abajo en la clase son los
    // MÉTODOS: las acciones que ese objeto puede hacer.
    constructor({ id, nombre, emoji, elemento = 'guerrero', titulo = '', descripcion = '', foto, tinte = 'rgba(255, 255, 255, 0.03)', vidas = 3 }) {
        this.id          = id;           // 'aang'  → también el nombre del .webp
        this.nombre      = nombre;       // 'Aang'
        this.emoji       = emoji;        // respaldo si la foto no carga
        this.elemento    = elemento;     // 'aire' | 'agua' | 'fuego' | 'tierra' | 'guerrero'
        this.titulo      = titulo;       // 'Maestro Aire'
        this.descripcion = descripcion;  // tooltip de la tarjeta
        this.tinte       = tinte;        // color de fondo de su tarjeta
        this.vidasMax    = vidas;        // vidas con las que arranca
        this.vidas       = vidas;        // vidas actuales

        // Si no le pasamos foto, la busca sola en /img. Si le pasamos
        // foto: null, el personaje se dibuja directamente con su emoji.
        this.foto = (foto === undefined) ? `./img/${id}.webp` : foto;

        // ---- Para el MAPA (canvas) ----
        // Guardamos x e y porque necesitamos el valor para después actualizarlo
        this.x = 20;           // posición por defecto
        this.y = 30;
        this.ancho = 60;       // caja del personaje en el mapa: ahora se dibuja de CUERPO ENTERO,
        this.alto  = 88;       // con los pies apoyados en el borde de abajo de la caja
        this.velocidadX = 0;   // cuánto se mueve por cada "cuadro" (0 = quieto)
        this.velocidadY = 0;
        this.mapaFoto   = new Image();   // FICHA REDONDA que se mueve por el mapa (img/mapa/<id>.png)
        this.cuerpoFoto = new Image();   // CUERPO ENTERO (tarjetas y Modo Pelea)
        this.rutaFicha  = (foto === undefined || this.foto === `./img/${id}.webp`) ? `./img/mapa/${id}.png` : null;
        // (los .src se asignan en prepararMapa(): así no se piden 1000 fotos de golpe
        //  cuando se fabrican muchos personajes, solo las de los que van a jugar)

        // El personaje se guarda las referencias de SU tarjeta en la arena,
        // así después sabe actualizar su propia barra de vida.
        this.barraVida  = null;
        this.textoVidas = null;
    }

    // ---------- MÉTODOS DE COMBATE ----------

    estaVivo() {
        return this.vidas > 0;
    }

    enPeligro() {
        return this.vidas === 1;
    }

    // Pierde vida y actualiza su barra en pantalla. Nunca baja de 0.
    recibirGolpe(dano = 1) {
        this.vidas = Math.max(this.vidas - dano, 0);
        this.refrescarVida();
        return this.vidas;
    }

    curarse() {
        this.vidas = this.vidasMax;
        this.refrescarVida();
    }

    porcentajeVida() {
        return (this.vidas / this.vidasMax) * 100;
    }

    presentarse() {
        return `${this.nombre} ${this.emoji}`;
    }

    // La "inteligencia" del personaje: elige un movimiento al azar
    elegirAtaque(ataques) {
        return ataques[Math.floor(Math.random() * ataques.length)];
    }

    // Para el buscador del catálogo
    coincideCon(texto) {
        const buscado = texto.toLowerCase();
        return this.nombre.toLowerCase().includes(buscado)
            || this.titulo.toLowerCase().includes(buscado);
    }

    // Devuelve una COPIA nueva del personaje. Es clave: si el jugador y el
    // enemigo eligen el mismo personaje del catálogo, sin clonar estarían
    // compartiendo el mismo objeto (y las mismas vidas).
    // Es como construir DOS casas con el mismo plano: se parecen, pero
    // si a una le rompés una ventana, la otra sigue intacta porque son
    // objetos distintos, aunque vengan del mismo molde (misma clase).
    // Carga la foto del personaje para dibujarla en el canvas
    prepararMapa() {
        if (this.rutaFicha && !this.mapaFoto.src) this.mapaFoto.src = this.rutaFicha;
        if (this.foto && !this.cuerpoFoto.src) this.cuerpoFoto.src = this.foto;
    }

    // Dibuja la foto (o el emoji) dentro de un cuadro, sin deformarla.
    // anclaAbajo = true apoya la imagen en la base del cuadro (para que "pise" el suelo).
    dibujarSprite(lienzo, x, y, ancho, alto, anclaAbajo = false) {
        const foto = this.cuerpoFoto;
        if (foto.complete && foto.naturalWidth > 0) {
            const escala = Math.min(ancho / foto.naturalWidth, alto / foto.naturalHeight);
            const w = foto.naturalWidth * escala;
            const h = foto.naturalHeight * escala;
            lienzo.drawImage(foto, x + (ancho - w) / 2, anclaAbajo ? y + alto - h : y + (alto - h) / 2, w, h);
        } else {
            // Sin foto (o todavía cargando): se dibuja su emoji
            lienzo.font = `${Math.round(alto * 0.75)}px serif`;
            lienzo.textAlign = 'center';
            lienzo.textBaseline = anclaAbajo ? 'bottom' : 'middle';
            lienzo.fillText(this.emoji, x + ancho / 2, anclaAbajo ? y + alto : y + alto / 2);
            lienzo.textAlign = 'start';
        }
    }

    // Dibuja al personaje en el mapa, en su x e y actuales
    // Cuerpo entero (img/<id>.webp) con los pies en el borde de abajo de la caja ancho x alto.
    // `espejo` lo da vuelta para que mire hacia donde camina. Si la foto no cargó, usa la ficha redonda.
    pintarEnMapa(lienzo, x = this.x, y = this.y, espejo = false) {
        const c = this.cuerpoFoto;
        if (c.complete && c.naturalWidth > 0) {
            const h = this.alto;
            const w = c.naturalWidth * (h / c.naturalHeight);
            lienzo.save();
            lienzo.imageSmoothingQuality = 'high';
            lienzo.translate(x + this.ancho / 2, 0);
            lienzo.scale(espejo ? -1 : 1, 1);
            lienzo.drawImage(c, -w / 2, y, w, h);
            lienzo.restore();
        } else {
            this.dibujarFicha(lienzo, x + (this.ancho - 64) / 2, y + this.alto - 64, 64);
        }
    }

    // Ficha redonda para el mapa: la cara del personaje con un aro del color de su elemento.
    // Si no hay ficha armada, recorta la parte de arriba de su foto; y si tampoco, usa el emoji.
    dibujarFicha(lienzo, x, y, tam) {
        const info = ELEMENTOS[this.elemento] ?? ELEMENTOS.guerrero;
        const listo = img => img.complete && img.naturalWidth > 0;
        const cx = x + tam / 2, cy = y + tam / 2, radio = tam / 2;

        lienzo.save();
        lienzo.beginPath();
        lienzo.arc(cx, cy, radio, 0, Math.PI * 2);
        lienzo.closePath();
        lienzo.clip();
        if (listo(this.mapaFoto)) {
            lienzo.drawImage(this.mapaFoto, x, y, tam, tam);
        } else {
            lienzo.fillStyle = info.color;
            lienzo.fillRect(x, y, tam, tam);
            if (listo(this.cuerpoFoto)) {
                const c = this.cuerpoFoto;
                const lado = Math.min(c.naturalWidth, c.naturalHeight * 0.6);
                lienzo.drawImage(c, (c.naturalWidth - lado) / 2, 0, lado, lado, x, y, tam, tam);
            } else {
                lienzo.font = `${Math.round(tam * 0.65)}px serif`;
                lienzo.textAlign = 'center';
                lienzo.textBaseline = 'middle';
                lienzo.fillText(this.emoji, cx, cy + 2);
                lienzo.textAlign = 'start';
            }
        }
        lienzo.restore();

        lienzo.beginPath();
        lienzo.arc(cx, cy, radio - 1.5, 0, Math.PI * 2);
        lienzo.lineWidth = 3.5;
        lienzo.strokeStyle = info.color;
        lienzo.shadowColor = 'rgba(0, 0, 0, 0.6)';
        lienzo.shadowBlur = 8;
        lienzo.stroke();
        lienzo.shadowBlur = 0;
    }

    // Nombre del movimiento según SU elemento (ej: Aang + Puño = "Palma de Aire")
    habilidad(ataque) {
        return ELEMENTOS[this.elemento]?.habilidades[ataque.id] ?? ataque.nombre;
    }

    clonar() {
        return new Personaje({
            id: this.id,
            nombre: this.nombre,
            emoji: this.emoji,
            elemento: this.elemento,
            titulo: this.titulo,
            descripcion: this.descripcion,
            foto: this.foto,
            tinte: this.tinte,
            vidas: this.vidasMax
        });
    }

    // ---------- MÉTODOS DE DIBUJO (el objeto se dibuja a sí mismo) ----------

    // Foto del personaje con el emoji de respaldo detrás
    crearAvatar(grande = false) {
        const contenedor = document.createElement('span');
        contenedor.classList.add('avatar-img');
        if (grande) contenedor.classList.add('avatar-img-arena');

        const emoji = document.createElement('span');
        emoji.classList.add('emoji-fallback');
        emoji.textContent = this.emoji;

        if (this.foto) {
            const img = document.createElement('img');
            img.alt = this.nombre;
            emoji.classList.add('oculto');

            // Si falta el archivo en /img, se oculta la foto y aparece el emoji
            img.addEventListener('error', () => {
                img.classList.add('oculto');
                emoji.classList.remove('oculto');
            });

            img.src = this.foto;
            contenedor.append(img, emoji);
        } else {
            contenedor.append(emoji);
        }

        return contenedor;
    }

    // Tarjeta de la pantalla de selección
    crearTarjeta() {
        const tarjeta = document.createElement('label');
        tarjeta.classList.add('personaje-card');
        tarjeta.style.setProperty('--tinte', this.tinte);
        tarjeta.title = this.descripcion;
        tarjeta.htmlFor = `pj-${this.id}`;

        const radio = document.createElement('input');
        radio.type  = 'radio';
        radio.name  = 'personaje';
        radio.id    = `pj-${this.id}`;
        radio.value = this.id;

        const nombre = document.createElement('span');
        nombre.classList.add('nombre');
        nombre.textContent = this.nombre;

        const titulo = document.createElement('span');
        titulo.classList.add('subtitulo');
        titulo.textContent = this.titulo;

        tarjeta.append(this.crearAvatar(), radio, nombre, titulo);
        return tarjeta;
    }

    // <option> para el selector alternativo. Es la misma idea que
    // crearTarjeta(): el objeto se dibuja a sí mismo, solo que en otro
    // formato de HTML. Ambos leen los mismos atributos (id, nombre, emoji).
    crearOpcion() {
        const opcion = document.createElement('option');
        opcion.value = this.id;
        opcion.textContent = `${this.emoji} ${this.nombre} — ${this.titulo}`;
        return opcion;
    }

    // Tarjeta de la arena (foto grande + barra de vida)
    crearTarjetaArena() {
        const tarjeta = document.createElement('div');
        tarjeta.classList.add('arena-card');

        const nombre = document.createElement('span');
        nombre.classList.add('nombre');
        nombre.textContent = this.nombre;

        const barra = document.createElement('div');
        barra.classList.add('barra-vida');
        this.barraVida = document.createElement('div');
        this.barraVida.classList.add('barra-vida-fill');
        barra.append(this.barraVida);

        const texto = document.createElement('div');
        texto.classList.add('vidas-texto');
        this.textoVidas = document.createElement('span');
        texto.append('Vidas: ', this.textoVidas, `/${this.vidasMax}`);

        tarjeta.append(this.crearAvatar(true), nombre, barra, texto);
        this.refrescarVida();
        return tarjeta;
    }

    // Sincroniza la barra y el número de vidas con el estado real del objeto
    refrescarVida() {
        if (!this.barraVida) return;
        this.barraVida.style.width = `${this.porcentajeVida()}%`;
        this.barraVida.classList.toggle('critica', this.enPeligro());
        this.textoVidas.textContent = this.vidas;
    }
}


/* ============================================================
   3) LOS OBJETOS — acá se fabrican los ataques y los personajes
   ------------------------------------------------------------
   Cada "new" crea un objeto a partir del molde.
   Para sumar un personaje: copiás una línea, cambiás los datos, listo.
   ============================================================ */

const ATAQUES = [
    new Ataque({ id: 'puno',    nombre: 'Puño',    emoji: '👊', venceA: 'barrida', colorClaro: '#f16565', colorOscuro: '#dc2626' }),
    new Ataque({ id: 'patada',  nombre: 'Patada',  emoji: '🦵', venceA: 'puno',    colorClaro: '#3b9bf0', colorOscuro: '#2563eb' }),
    new Ataque({ id: 'barrida', nombre: 'Barrida', emoji: '🌀', venceA: 'patada',  colorClaro: '#34d67f', colorOscuro: '#16a34a' })
];

const PERSONAJES = [
    new Personaje({
        id: 'aang', elemento: 'aire', nombre: 'Aang', emoji: '🌪️', titulo: 'Maestro Aire',
        descripcion: 'Usa su bastón y el elemento aire para ataques rápidos y movilidad.',
        tinte: 'rgba(252, 211, 77, 0.14)'
    }),
    new Personaje({
        id: 'katara', elemento: 'agua', nombre: 'Katara', emoji: '💧', titulo: 'Maestra Agua',
        descripcion: 'Utiliza un frasco de agua y artes marciales con control de agua.',
        tinte: 'rgba(56, 189, 248, 0.14)'
    }),
    new Personaje({
        id: 'sokka', elemento: 'guerrero', nombre: 'Sokka', emoji: '🪃', titulo: 'Guerrero',
        descripcion: 'Pelea cuerpo a cuerpo con su bumerán y espada de hueso/meteorito.',
        tinte: 'rgba(214, 178, 140, 0.14)'
    }),
    new Personaje({
        id: 'haru', elemento: 'tierra', nombre: 'Haru', emoji: '🪨', titulo: 'Maestro Tierra',
        descripcion: 'Usa el dominio de la tierra para arrojar rocas a los enemigos.',
        tinte: 'rgba(34, 197, 94, 0.14)'
    }),
    // Zuko y Toph: mismo molde Personaje; sus fotos son img/zuko.webp e img/toph.webp
    // (si faltara el archivo, la tarjeta muestra el emoji).
    new Personaje({
        id: 'zuko', elemento: 'fuego', nombre: 'Zuko', emoji: '🔥', titulo: 'Maestro Fuego',
        descripcion: 'Príncipe desterrado de la Nación del Fuego, domina las llamas con precisión.',
        tinte: 'rgba(239, 68, 68, 0.14)'
    }),
    new Personaje({
        id: 'toph', elemento: 'tierra', nombre: 'Toph', emoji: '🪨', titulo: 'Maestra Tierra',
        descripcion: 'Maestra Tierra ciega que "ve" con vibraciones; inventora del metalcontrol.',
        tinte: 'rgba(34, 197, 94, 0.14)'
    })
];


/* ============================================================
   4) CLASE Juego — el molde de la partida
   ------------------------------------------------------------
   ATRIBUTOS : catalogo, ataques, jugador, enemigo, terminado + DOM
   MÉTODOS   : iniciar(), dibujarCatalogo(), comenzarCombate(),
               atacar(), revisarFinDelJuego(), reiniciar(), etc.

   Esta clase no representa una "cosa" del mundo real como Casa o Animal,
   sino la PARTIDA en sí: agrupa todo lo que antes (clases 1 a 3) eran
   variables sueltas (jugador, enemigo, terminado) en un solo objeto,
   el que se crea al final del archivo con "new Juego(...)".
   ============================================================ */
class Juego {

    constructor({ catalogo, ataques }) {
        this.catalogo  = catalogo;   // todos los personajes disponibles
        this.ataques   = ataques;    // todos los movimientos posibles
        this.jugador   = null;       // se llena al empezar el combate
        this.enemigo   = null;
        this.terminado = false;

        // Referencias al DOM: se buscan una sola vez al arrancar (DRY)
        this.seccionPersonaje   = document.getElementById('seleccionar-personaje');
        this.seccionAtaque      = document.getElementById('seleccionar-ataque');
        this.seccionMapa        = document.getElementById('ver-mapa');
        this.mapa               = document.getElementById('mapa');
        this.seccionMensajes    = document.getElementById('mensajes');
        this.seccionReiniciar   = document.getElementById('reiniciar');
        this.seccionDespedida   = document.getElementById('despedida');
        this.listaPersonajes    = document.getElementById('lista-personajes');
        this.listaAtaques       = document.getElementById('lista-ataques');
        this.listaMovimientos   = document.getElementById('lista-movimientos');
        this.contadorPersonajes = document.getElementById('contador-personajes');
        this.buscador           = document.getElementById('buscador-personajes');
        this.selectorPersonaje  = document.getElementById('selector-personaje');
        this.arena              = document.getElementById('arena');
        this.contenedorMensajes = document.getElementById('contenedor-mensajes');
        this.modalReglas        = document.getElementById('modal-reglas');
        this.modalCrear         = document.getElementById('modal-crear-personaje');
        this.formNuevoPersonaje = document.getElementById('form-nuevo-personaje');
        this.musica             = document.getElementById('musica-fondo');
        this.botonMusica        = document.getElementById('boton-musica');
        this.efectos            = new Efectos(this.arena);
        this.cinematica         = new MovimientoCinematico(this.mapa, this.efectos);
        this.seccionPelea       = document.getElementById('pelea-2d');
        this.pelea              = new PeleaArcade(document.getElementById('canvas-pelea'), this.efectos);
        this.cinematica.alConfirmar = () => this.irAlCombate();   // Enter = ir al combate
        this.retratoSubido      = null;   // imagen subida al crear un personaje
        this.musicaSilenciada   = false;   // true si la persona la apagó a propósito
    }

    // ---------- ARRANQUE ----------

    iniciar() {
        this.dibujarCatalogo();
        this.dibujarAtaques();
        this.dibujarReglas();
        this.dibujarHabilidades();
        this.dibujarFormularioCrear();
        this.conectarEventos();
        this.configurarMusica();
    }

    // ---------- MÚSICA DE FONDO ----------

    // Los navegadores bloquean el audio automático: solo dejan sonar después
    // de que la persona interactúa con la página. Por eso se intenta sonar al
    // cargar (por si el navegador lo permite) y, si no, en el primer click.
    configurarMusica() {
        // Deslizadores de volumen (se recuerdan entre visitas)
        const leer    = clave => { try { return localStorage.getItem(clave); } catch { return null; } };
        const guardar = (clave, valor) => { try { localStorage.setItem(clave, valor); } catch { /* sin almacenamiento */ } };
        const barraMusica  = document.getElementById('volumen-musica');
        const barraEfectos = document.getElementById('volumen-efectos');
        barraMusica.value  = leer('avatar-vol-musica')  ?? barraMusica.value;
        barraEfectos.value = leer('avatar-vol-efectos') ?? barraEfectos.value;
        this.musica.volume   = barraMusica.value  / 100;
        this.efectos.volumen = barraEfectos.value / 100;
        barraMusica.addEventListener('input', () => {
            this.musica.volume = barraMusica.value / 100;
            guardar('avatar-vol-musica', barraMusica.value);
        });
        barraEfectos.addEventListener('input', () => {
            this.efectos.volumen = barraEfectos.value / 100;
            guardar('avatar-vol-efectos', barraEfectos.value);
        });
        barraEfectos.addEventListener('change', () => this.efectos.reproducir('puno'));   // muestra el volumen

        // Prueba varias rutas posibles hasta encontrar el archivo de audio.
        // Si ninguna existe, avisa en el botón (⚠️) y en la consola.
        this.fuentesMusica = [
            './audio/aang-overcomes.m4a',
            './audio/Aang_Overcomes.m4a',
            './aang-overcomes.m4a',
            './Aang_Overcomes.m4a'
        ];
        this.indiceFuente = 0;
        this.musica.addEventListener('error', () => this.probarSiguienteFuente());
        this.musica.src = this.fuentesMusica[0];

        this.intentarReproducir();

        const alPrimerToque = () => {
            if (!this.musicaSilenciada) this.intentarReproducir();
        };
        document.addEventListener('pointerdown', alPrimerToque, { once: true });
        document.addEventListener('keydown',     alPrimerToque, { once: true });

        this.botonMusica.addEventListener('click', evento => {
            evento.stopPropagation();
            this.alternarMusica();
        });
    }

    probarSiguienteFuente() {
        this.indiceFuente++;
        if (this.indiceFuente < this.fuentesMusica.length) {
            this.musica.src = this.fuentesMusica[this.indiceFuente];
            if (!this.musicaSilenciada) this.intentarReproducir();
            return;
        }
        this.botonMusica.textContent = '⚠️';
        this.botonMusica.title = 'No se encontró el audio (carpeta audio/)';
        console.warn('No se pudo cargar la música. Rutas probadas:', this.fuentesMusica);
    }

    intentarReproducir() {
        // play() devuelve una promesa que falla si el navegador no lo permite
        this.musica.play()
            .then(()  => this.actualizarBotonMusica())
            .catch(() => { /* esperando el primer click o probando otra ruta */ });
    }

    alternarMusica() {
        if (this.musica.paused) {
            this.musicaSilenciada = false;
            this.intentarReproducir();
        } else {
            this.musicaSilenciada = true;
            this.musica.pause();
            this.actualizarBotonMusica();
        }
    }

    actualizarBotonMusica() {
        if (this.indiceFuente >= this.fuentesMusica.length) return;   // ya está en ⚠️
        this.botonMusica.textContent = this.musica.paused ? '🔇' : '🔊';
    }

    // Dibuja TODAS las tarjetas de personaje a partir de los objetos.
    // Con 4 o con 1000 el código es exactamente el mismo.
    dibujarCatalogo(filtro = '') {
        const texto    = filtro.trim();
        const visibles = texto ? this.catalogo.filter(p => p.coincideCon(texto)) : this.catalogo;

        // Un fragmento arma todo en memoria y lo inserta de una sola vez:
        // así el navegador no se traba aunque haya miles de tarjetas.
        const fragmento = document.createDocumentFragment();
        visibles.forEach(personaje => fragmento.append(personaje.crearTarjeta()));
        this.listaPersonajes.replaceChildren(fragmento);

        this.contadorPersonajes.textContent = (visibles.length === this.catalogo.length)
            ? `${this.catalogo.length} personajes disponibles`
            : `${visibles.length} de ${this.catalogo.length} personajes`;

        // El buscador aparece solo cuando el catálogo se hace grande
        this.buscador.classList.toggle('oculto', this.catalogo.length <= 8);

        this.dibujarSelector(visibles);
    }

    // El <select> es una segunda forma de elegir personaje, además de las
    // tarjetas. Se arma con el mismo catálogo (crearOpcion() en vez de
    // crearTarjeta()), y queda sincronizado con la tarjeta seleccionada.
    dibujarSelector(visibles = this.catalogo) {
        const elegidoActual = this.selectorPersonaje.value;

        const fragmento = document.createDocumentFragment();
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = '— Elegí un personaje —';
        fragmento.append(placeholder);
        visibles.forEach(personaje => fragmento.append(personaje.crearOpcion()));

        this.selectorPersonaje.replaceChildren(fragmento);

        // Si el personaje que estaba elegido sigue en la lista filtrada,
        // se lo dejamos marcado en el selector.
        if (visibles.some(p => p.id === elegidoActual)) {
            this.selectorPersonaje.value = elegidoActual;
        }
    }

    // Los botones de ataque también salen de los objetos
    dibujarAtaques() {
        const fragmento = document.createDocumentFragment();
        this.ataques.forEach(ataque => {
            fragmento.append(ataque.crearBoton(elegido => this.atacar(elegido)));
        });
        this.listaAtaques.replaceChildren(fragmento);
    }

    // Y el reglamento del modal se escribe solo leyendo los ataques
    dibujarReglas() {
        const fragmento = document.createDocumentFragment();

        this.ataques.forEach(ataque => {
            const vence  = this.ataques.find(otro => otro.id === ataque.venceA);
            const pierde = this.ataques.find(otro => otro.venceA === ataque.id);

            const destacado = document.createElement('strong');
            destacado.textContent = ataque.nombre;

            const item = document.createElement('li');
            item.append(
                destacado,
                ` ${ataque.emoji} vence a ${vence ? vence.nombre : '—'}`,
                ` y pierde contra ${pierde ? pierde.nombre : '—'}.`
            );
            fragmento.append(item);
        });

        this.listaMovimientos.replaceChildren(fragmento);
    }

    conectarEventos() {
        document.getElementById('boton-personaje').addEventListener('click', () => this.comenzarCombate());
        document.getElementById('boton-reiniciar').addEventListener('click', () => this.reiniciarCombate());
        document.getElementById('boton-reiniciar-arena').addEventListener('click', () => this.reiniciarCombate());
        document.getElementById('boton-reiniciar-pelea').addEventListener('click', () => this.comenzarPelea(this.pelea.modo ?? '1p'));
        ['boton-salir-arena', 'boton-salir-final', 'boton-salir-mapa'].forEach(id =>
            document.getElementById(id).addEventListener('click', () => this.salirAlMenu()));
        document.getElementById('boton-reglas-personaje').addEventListener('click', () => this.mostrarReglas(true));
        document.getElementById('boton-reglas-arena').addEventListener('click', () => this.mostrarReglas(true));
        document.getElementById('boton-cerrar-reglas').addEventListener('click', () => this.mostrarReglas(false));
        document.getElementById('modal-reglas-fondo').addEventListener('click', () => this.mostrarReglas(false));

        this.buscador.addEventListener('input', () => this.dibujarCatalogo(this.buscador.value));
        document.addEventListener('keydown', evento => {
            if (evento.key === 'Escape') {
                this.mostrarReglas(false);
                this.mostrarCrearPersonaje(false);
            }
        });

        // ---- Selector <-> tarjetas: son dos vistas del MISMO estado ----
        // Elegir del <select> marca el radio de la tarjeta correspondiente.
        this.selectorPersonaje.addEventListener('change', () => {
            const radio = this.selectorPersonaje.value
                ? document.getElementById(`pj-${this.selectorPersonaje.value}`)
                : null;
            if (radio) radio.checked = true;
        });

        // Clickear una tarjeta actualiza el <select> (delegación de eventos:
        // un solo listener sirve para 4 o para 1000 tarjetas).
        this.listaPersonajes.addEventListener('change', evento => {
            if (evento.target.name === 'personaje') {
                this.selectorPersonaje.value = evento.target.value;
            }
        });

        // ---- Crear personaje (instanciar un objeto nuevo en vivo) ----
        document.getElementById('boton-crear-personaje').addEventListener('click', () => this.mostrarCrearPersonaje(true));
        document.getElementById('boton-cerrar-crear').addEventListener('click', () => this.mostrarCrearPersonaje(false));
        document.getElementById('modal-crear-fondo').addEventListener('click', () => this.mostrarCrearPersonaje(false));
        this.formNuevoPersonaje.addEventListener('submit', evento => {
            evento.preventDefault();
            this.crearPersonajePersonalizado();
        });

        // ---- Terminar el juego ----
        document.getElementById('boton-ir-combate').addEventListener('click', () => this.irAlCombate());
        document.getElementById('boton-modo-pelea').addEventListener('click', () => this.abrirPelea());
        document.getElementById('boton-salir-pelea').addEventListener('click', () => this.cerrarPelea());
        document.getElementById('boton-pelea-1p').addEventListener('click', () => this.comenzarPelea('1p'));
        document.getElementById('boton-pelea-2p').addEventListener('click', () => this.comenzarPelea('2p'));
        ['pelea-p1', 'pelea-p2'].forEach(id => {
            const selector = document.getElementById(id);
            selector.addEventListener('change', () => { selector.blur(); this.comenzarPelea(this.pelea.modo ?? '1p'); });
        });
        document.getElementById('boton-terminar-juego').addEventListener('click', () => this.terminarJuego());
        document.getElementById('boton-volver-inicio').addEventListener('click', () => location.reload());
    }

    // ---------- COMBATE ----------

    comenzarCombate() {
        const elegido = document.querySelector('input[name="personaje"]:checked');

        if (!elegido) {
            this.seccionMensajes.classList.remove('oculto');
            this.mostrarMensaje('⚠️ Por favor, elegí un personaje primero.', 'tie');
            return;
        }

        // clonar() para que el catálogo quede intacto: peleamos con copias
        this.jugador = this.buscarPersonaje(elegido.value).clonar();
        this.enemigo = this.personajeAleatorio().clonar();

        // La arena se arma pidiéndole a cada personaje que se dibuje
        this.arena.replaceChildren(
            this.jugador.crearTarjetaArena(),
            this.crearSeparadorVS(),
            this.enemigo.crearTarjetaArena()
        );

        this.rotularBotones();
        this.terminado = false;
        this.iniciarMapa();   // primero se explora el mapa; el combate empieza con "Ir al combate"
    }

    // ---------- MODO PELEA 2D ----------

    abrirPelea() {
        this.detenerMapa();
        [this.seccionPersonaje, this.seccionAtaque, this.seccionMensajes, this.seccionMapa].forEach(s => s.classList.add('oculto'));
        this.seccionPelea.classList.remove('oculto');

        // Selectores de peleadores (se llenan desde el catálogo)
        const selectores = [document.getElementById('pelea-p1'), document.getElementById('pelea-p2')];
        if (selectores[0].options.length !== this.catalogo.length) {
            selectores.forEach(selector => {
                selector.replaceChildren(...this.catalogo.map(p => {
                    const opcion = document.createElement('option');
                    opcion.value = p.id;
                    opcion.textContent = `${p.emoji} ${p.nombre}`;
                    return opcion;
                }));
            });
        }
        const elegido = document.querySelector('input[name="personaje"]:checked')?.value;
        const idJugador = this.catalogo.some(p => p.id === elegido) ? elegido : this.catalogo[0].id;
        const rivales = this.catalogo.filter(p => p.id !== idJugador);
        selectores[0].value = idJugador;
        selectores[1].value = (rivales[Math.floor(Math.random() * rivales.length)] ?? this.catalogo[0]).id;
        this.comenzarPelea('1p');
    }

    comenzarPelea(modo) {
        const buscar = id => this.catalogo.find(p => p.id === id)?.clonar();
        const p1 = buscar(document.getElementById('pelea-p1').value);
        const p2 = buscar(document.getElementById('pelea-p2').value);
        if (!p1 || !p2) return;
        this.pelea.comenzar(modo, p1, p2);
    }

    cerrarPelea() {
        this.pelea.detener();
        this.efectos.limpiar();
        this.seccionPelea.classList.add('oculto');
        this.seccionPersonaje.classList.remove('oculto');
    }

    // ---------- MAPA (canvas) ----------

    iniciarMapa() {
        this.jugador.prepararMapa();
        this.enemigo.prepararMapa();
        // Tamaño del mapa (la clase usa 800 x 600; acá 800 x 447 para que no se deforme la imagen)
        this.mapa.width  = 800;
        this.mapa.height = 447;
        // Teclado, como en la clase: keydown mueve y keyup detiene
        window.addEventListener('keydown', sePresionoUnaTecla);
        window.addEventListener('keyup', detenerMovimiento);
        this.seccionPersonaje.classList.add('oculto');
        this.seccionMensajes.classList.add('oculto');
        this.seccionMapa.classList.remove('oculto');

        // El bucle de animación (requestAnimationFrame) repinta el mapa ~60 veces por segundo
        this.cinematica.iniciar(this.jugador, this.enemigo);
    }

    // Un cuadro del mapa: calcula el movimiento y dibuja (el bucle lo hace solo)
    pintarPersonaje() {
        this.cinematica.actualizar(1 / 60);
        this.cinematica.pintar();
    }

    // Los botones solo avisan "quiero ir hacia acá"; la clase MovimientoCinematico mueve
    moverArriba()    { this.cinematica.botones.add('arriba'); }
    moverAbajo()     { this.cinematica.botones.add('abajo'); }
    moverIzquierda() { this.cinematica.botones.add('izquierda'); }
    moverDerecha()   { this.cinematica.botones.add('derecha'); }

    // Al soltar el botón el personaje frena suave (no se corta de golpe)
    detenerMovimiento() {
        this.cinematica.botones.clear();
    }

    detenerMapa() {
        window.removeEventListener('keydown', sePresionoUnaTecla);
        window.removeEventListener('keyup', detenerMovimiento);
        this.cinematica.detener();
    }

    irAlCombate() {
        if (!this.jugador) return;
        this.detenerMapa();
        this.seccionMapa.classList.add('oculto');
        this.seccionAtaque.classList.remove('oculto');
        this.seccionMensajes.classList.remove('oculto');

        this.mostrarMensaje(
            `Sos ${this.jugador.presentarse()} — el enemigo es ${this.enemigo.presentarse()}. ¡Que empiece el combate!`
        );
    }

    buscarPersonaje(id) {
        return this.catalogo.find(personaje => personaje.id === id);
    }

    personajeAleatorio() {
        return this.catalogo[Math.floor(Math.random() * this.catalogo.length)];
    }

    // Resuelve una ronda: mi movimiento contra uno aleatorio del enemigo
    atacar(ataqueJugador) {
        if (this.terminado || !this.jugador) return;

        const ataqueEnemigo = this.enemigo.elegirAtaque(this.ataques);
        let resultado;
        let claseMensaje;

        if (ataqueJugador.empataCon(ataqueEnemigo)) {
            resultado    = 'EMPATE';
            claseMensaje = 'tie';
        } else if (ataqueJugador.leGanaA(ataqueEnemigo)) {
            resultado    = 'GANASTE';
            claseMensaje = 'win';
            this.enemigo.recibirGolpe();
        } else {
            resultado    = 'PERDISTE';
            claseMensaje = 'lose';
            this.jugador.recibirGolpe();
        }

        const habJugador = this.jugador.habilidad(ataqueJugador);
        const habEnemigo = this.enemigo.habilidad(ataqueEnemigo);
        const iconoJ = (ELEMENTOS[this.jugador.elemento] ?? ELEMENTOS.guerrero).emoji;
        const iconoE = (ELEMENTOS[this.enemigo.elemento] ?? ELEMENTOS.guerrero).emoji;

        // Efectos: primero ataca el jugador, un instante después el enemigo
        const [tarjetaJugador, , tarjetaEnemigo] = this.arena.children;
        const elementoJugador = this.jugador.elemento;     // se guardan ahora: si se reinicia o se sale
        const elementoEnemigo = this.enemigo.elemento;     // antes de que terminen los efectos, no se rompe nada
        const peleaActual = this.jugador;
        const luego = (ms, accion) => setTimeout(() => { if (this.jugador === peleaActual) accion(); }, ms);

        this.efectos.lanzar(ataqueJugador.id, elementoJugador, tarjetaJugador, tarjetaEnemigo, 'izquierda', habJugador);
        luego(650, () => this.efectos.lanzar(ataqueEnemigo.id, elementoEnemigo, tarjetaEnemigo, tarjetaJugador, 'derecha', habEnemigo));
        if (claseMensaje === 'win')  luego(500,  () => this.efectos.golpear(tarjetaEnemigo, ataqueJugador.id, elementoJugador, false));
        if (claseMensaje === 'lose') luego(1150, () => this.efectos.golpear(tarjetaJugador, ataqueEnemigo.id, elementoEnemigo, true));
        if (claseMensaje === 'tie')  luego(520,  () => this.efectos.choque());

        // Al tocar el botón, hace un pequeño "pulso"
        const botonTocado = document.getElementById(`boton-${ataqueJugador.id}`);
        if (botonTocado) {
            botonTocado.classList.remove('pulsado');
            void botonTocado.offsetWidth;
            botonTocado.classList.add('pulsado');
        }

        this.mostrarMensaje(
            `${iconoJ} ${this.jugador.nombre} usó ${habJugador} (${ataqueJugador.nombre}) ` +
            `vs ${iconoE} ${this.enemigo.nombre} con ${habEnemigo} (${ataqueEnemigo.nombre}) — ${resultado}`,
            claseMensaje
        );

        this.revisarFinDelJuego();
    }

    revisarFinDelJuego() {
        if (this.jugador.estaVivo() && this.enemigo.estaVivo()) return;

        if (!this.jugador.estaVivo() && !this.enemigo.estaVivo()) {
            this.finalizar('🤝 Empate final: ambos cayeron al mismo tiempo.');
        } else if (!this.jugador.estaVivo()) {
            this.finalizar(`💀 ${this.enemigo.nombre} te derrotó. ¡Perdiste!`, 'derrota');
        } else {
            this.finalizar(`🏆 ¡Venciste a ${this.enemigo.nombre}! Sos el Avatar.`, 'victoria');
        }
    }

    finalizar(mensaje, sonido) {
        this.terminado = true;
        // Jingle de victoria o derrota, un instante después de los últimos golpes
        if (sonido) {
            const [tarjetaJugador, , tarjetaEnemigo] = this.arena.children;
            const peleaActual = this.jugador;
            setTimeout(() => {
                if (this.jugador !== peleaActual || !this.terminado) return;   // se reinició o salió antes
                this.efectos.reproducir(sonido);
                this.efectos.celebrar(sonido, tarjetaJugador, tarjetaEnemigo);
            }, 1500);
        }
        this.mostrarMensaje(mensaje, 'final');
        this.listaAtaques.querySelectorAll('button').forEach(boton => boton.disabled = true);
        this.seccionReiniciar.classList.remove('oculto');
    }

    mostrarMensaje(texto, clase) {
        const parrafo = document.createElement('p');
        parrafo.textContent = texto;
        if (clase) parrafo.classList.add(clase);
        this.contenedorMensajes.prepend(parrafo);
    }

    // Vuelve a empezar la MISMA pelea: mismos personajes, vidas al máximo, mensajes limpios
    reiniciarCombate() {
        if (!this.jugador || !this.enemigo) return;
        this.efectos.limpiar();
        this.jugador = this.jugador.clonar();
        this.enemigo = this.enemigo.clonar();
        this.arena.replaceChildren(
            this.jugador.crearTarjetaArena(),
            this.crearSeparadorVS(),
            this.enemigo.crearTarjetaArena()
        );
        this.rotularBotones();
        this.terminado = false;
        this.contenedorMensajes.replaceChildren();
        this.listaAtaques.querySelectorAll('button').forEach(boton => boton.disabled = false);
        this.seccionReiniciar.classList.add('oculto');
        this.irAlCombate();
    }

    // Salir: vuelve al menú de selección de personajes
    salirAlMenu() {
        this.reiniciar();
    }

    reiniciar() {
        this.efectos.limpiar();
        this.detenerMapa();
        this.seccionMapa.classList.add('oculto');
        this.jugador   = null;
        this.enemigo   = null;
        this.terminado = false;

        this.contenedorMensajes.replaceChildren();
        this.arena.replaceChildren();
        this.listaAtaques.querySelectorAll('button').forEach(boton => boton.disabled = false);
        document.querySelectorAll('input[name="personaje"]').forEach(radio => radio.checked = false);

        this.seccionPersonaje.classList.remove('oculto');
        this.seccionAtaque.classList.add('oculto');
        this.seccionMensajes.classList.add('oculto');
        this.seccionReiniciar.classList.add('oculto');
    }

    mostrarReglas(mostrar) {
        this.modalReglas.classList.toggle('oculto', !mostrar);
    }

    mostrarCrearPersonaje(mostrar) {
        this.modalCrear.classList.toggle('oculto', !mostrar);
        if (!mostrar) this.formNuevoPersonaje.reset();
    }

    // Los botones muestran el nombre del movimiento según el elemento del jugador
    rotularBotones() {
        this.ataques.forEach(ataque => {
            const boton = document.getElementById(`boton-${ataque.id}`);
            if (!boton) return;
            boton.textContent = `${ataque.emoji} ${this.jugador.habilidad(ataque)}`;
            boton.title = ataque.nombre;
        });
    }

    // Reglas: lista de habilidades de cada elemento (se arma sola desde ELEMENTOS)
    dibujarHabilidades() {
        const columna = this.listaMovimientos.parentElement;
        const titulo = document.createElement('h3');
        titulo.textContent = 'Habilidades por elemento';
        const lista = document.createElement('ul');
        Object.values(ELEMENTOS).forEach(info => {
            const item = document.createElement('li');
            const fuerte = document.createElement('strong');
            fuerte.textContent = `${info.emoji} ${info.nombre}: `;
            const h = info.habilidades;
            item.append(fuerte, `${h.puno} · ${h.patada} · ${h.barrida}`);
            lista.append(item);
        });
        columna.append(titulo, lista);
    }

    // ---------- FORMULARIO "CREAR PERSONAJE" ----------

    dibujarFormularioCrear() {
        const crearChip = (name, value, contenido, color, marcado) => {
            const label = document.createElement('label');
            label.className = 'chip';
            label.style.setProperty('--chip-color', color);
            const input = document.createElement('input');
            input.type = 'radio';
            input.name = name;
            input.value = value;
            input.defaultChecked = marcado;
            const cuerpo = document.createElement('span');
            cuerpo.append(...contenido);
            label.append(input, cuerpo);
            return label;
        };

        const chipsElemento = Object.entries(ELEMENTOS).map(([id, info], i) =>
            crearChip('elemento', id, [`${info.emoji} ${info.nombre}`], info.color, i === 0));
        document.getElementById('chips-elemento').replaceChildren(...chipsElemento);

        const chipsRetrato = RETRATOS.map(r => {
            const img = document.createElement('img');
            img.src = `./img/${r.id}.webp`;
            img.alt = r.nombre;
            const nombre = document.createElement('small');
            nombre.textContent = r.nombre;
            return crearChip('retrato', r.id, [img, nombre], '#f59e0b', false);
        });
        // Chip "Subir": abre el selector de archivos del dispositivo
        const subir = document.createElement('label');
        subir.className = 'chip subir';
        subir.style.setProperty('--chip-color', '#38bdf8');
        const archivo = document.createElement('input');
        archivo.type = 'file';
        archivo.accept = 'image/*';
        archivo.addEventListener('change', () => this.cargarImagenSubida(archivo.files[0]));
        const iconoSubir = document.createElement('b');
        iconoSubir.textContent = '📁';
        const textoSubir = document.createElement('small');
        textoSubir.textContent = 'Subir';
        const cuerpoSubir = document.createElement('span');
        cuerpoSubir.append(iconoSubir, textoSubir);
        subir.append(archivo, cuerpoSubir);
        chipsRetrato.unshift(subir);

        const emoji = document.createElement('b');
        emoji.textContent = '✨';
        const etiqueta = document.createElement('small');
        etiqueta.textContent = 'Emoji';
        chipsRetrato.push(crearChip('retrato', 'emoji', [emoji, etiqueta], '#f59e0b', true));
        document.getElementById('retratos-nuevo').replaceChildren(...chipsRetrato);

        this.formNuevoPersonaje.addEventListener('input',  () => this.actualizarVistaPrevia());
        this.formNuevoPersonaje.addEventListener('change', () => this.actualizarVistaPrevia());
        this.actualizarVistaPrevia();
    }

    // Lee la imagen elegida, la achica (máx. 256 px) y la usa como retrato
    cargarImagenSubida(archivo) {
        if (!archivo || !archivo.type.startsWith('image/')) return;
        const lector = new FileReader();
        lector.onload = () => {
            const imagen = new Image();
            imagen.onload = () => {
                const escala = Math.min(1, 256 / Math.max(imagen.width, imagen.height));
                const lienzo = document.createElement('canvas');
                lienzo.width  = Math.round(imagen.width  * escala);
                lienzo.height = Math.round(imagen.height * escala);
                lienzo.getContext('2d').drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
                this.usarRetratoSubido(lienzo.toDataURL('image/webp', 0.88));
            };
            imagen.onerror = () => this.mostrarMensajeTemporal('⚠️ No se pudo leer esa imagen.');
            imagen.src = lector.result;
        };
        lector.readAsDataURL(archivo);
    }

    // Agrega la miniatura subida como una opción más de retrato y la deja elegida
    usarRetratoSubido(urlImagen) {
        this.retratoSubido = urlImagen;
        const grupo = document.getElementById('retratos-nuevo');
        grupo.querySelector('.chip.subida')?.remove();

        const label = document.createElement('label');
        label.className = 'chip subida';
        label.style.setProperty('--chip-color', '#38bdf8');
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'retrato';
        input.value = 'subida';
        input.checked = true;
        const img = document.createElement('img');
        img.src = urlImagen;
        img.alt = 'Imagen subida';
        const nombre = document.createElement('small');
        nombre.textContent = 'Tu imagen';
        const cuerpo = document.createElement('span');
        cuerpo.append(img, nombre);
        label.append(input, cuerpo);
        grupo.querySelector('.chip.subir').after(label);
        this.actualizarVistaPrevia();
    }

    // Devuelve la ruta de foto según el retrato elegido en el formulario
    fotoElegida(retrato) {
        if (retrato === 'subida' && this.retratoSubido) return this.retratoSubido;
        if (!retrato || retrato === 'emoji' || retrato === 'subida') return null;
        return `./img/${retrato}.webp`;
    }

    // La vista previa es un Personaje temporal (new Personaje) que se dibuja solo
    actualizarVistaPrevia() {
        const datos    = new FormData(this.formNuevoPersonaje);
        const elemento = datos.get('elemento') || 'aire';
        const retrato  = datos.get('retrato') || 'emoji';
        const info     = ELEMENTOS[elemento];
        const nombre   = (datos.get('nombre') || '').trim() || 'Tu personaje';

        const previa = new Personaje({
            id: 'vista-previa', nombre, elemento, emoji: info.emoji, titulo: info.titulo, tinte: info.tinte,
            foto: this.fotoElegida(retrato)
        });

        const caja = document.getElementById('vista-previa-personaje');
        caja.style.setProperty('--tinte', info.tinte);
        caja.style.setProperty('--chip-color', info.color);
        const n = document.createElement('span');
        n.className = 'nombre';
        n.textContent = nombre;
        const t = document.createElement('span');
        t.className = 'subtitulo';
        t.textContent = info.titulo;
        caja.replaceChildren(previa.crearAvatar(true), n, t);

        const movimientos = this.ataques.map(ataque => {
            const li = document.createElement('li');
            li.append(`${ataque.emoji} ${previa.habilidad(ataque)} `);
            const chico = document.createElement('small');
            chico.textContent = `(${ataque.nombre})`;
            li.append(chico);
            return li;
        });
        document.getElementById('vista-previa-movimientos').replaceChildren(...movimientos);
    }

    // Traduce el elemento elegido en el formulario a los atributos visuales
    // del Personaje (emoji, tinte, título). Es solo un mapa de datos, no
    // cambia nada de la clase Personaje en sí.
    datosDelElemento(elemento) {
        return ELEMENTOS[elemento] ?? ELEMENTOS.guerrero;
    }

    // Lee el formulario y hace exactamente lo que explica la teoría de
    // "instanciar": new Personaje({...}) crea el objeto, agregarPersonajes()
    // lo suma al catálogo, y el propio objeto se dibuja solo (crearTarjeta()).
    crearPersonajePersonalizado() {
        const datosForm = new FormData(this.formNuevoPersonaje);
        const nombre     = datosForm.get('nombre').trim();
        const elemento   = datosForm.get('elemento');
        const retrato    = datosForm.get('retrato');

        if (!nombre) return;

        const { emoji, tinte, titulo } = this.datosDelElemento(elemento);
        const id = `${nombre.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

        const nuevoPersonaje = new Personaje({
            id, nombre, emoji, titulo, elemento,
            descripcion: `Personaje creado por el jugador. Elemento: ${elemento}.`,
            foto: this.fotoElegida(retrato),   // retrato elegido, imagen subida o su emoji
            tinte
        });

        this.agregarPersonajes(nuevoPersonaje);
        this.mostrarCrearPersonaje(false);
        this.formNuevoPersonaje.reset();
        this.retratoSubido = null;
        document.querySelector('#retratos-nuevo .chip.subida')?.remove();
        this.actualizarVistaPrevia();
        this.mostrarMensajeTemporal(`✨ Se creó a ${nuevoPersonaje.presentarse()} y ya está en el catálogo.`);
    }

    // Mensaje corto que no depende de que el combate haya arrancado
    // (a diferencia de mostrarMensaje(), que escribe en la sección de combate).
    mostrarMensajeTemporal(texto) {
        this.contadorPersonajes.textContent = texto;
        setTimeout(() => this.dibujarCatalogo(this.buscador.value), 2200);
    }

    // "Terminar el juego": oculta todo lo demás y muestra la despedida.
    // No borra el catálogo ni el progreso, solo saca la interfaz de juego.
    terminarJuego() {
        this.pelea.detener();
        this.seccionPelea.classList.add('oculto');
        this.detenerMapa();
        this.seccionMapa.classList.add('oculto');
        this.seccionPersonaje.classList.add('oculto');
        this.seccionAtaque.classList.add('oculto');
        this.seccionMensajes.classList.add('oculto');
        this.seccionReiniciar.classList.add('oculto');
        this.seccionDespedida.classList.remove('oculto');
    }

    crearSeparadorVS() {
        const separador = document.createElement('div');
        separador.classList.add('vs');
        separador.textContent = 'VS';
        return separador;
    }

    // Suma personajes al catálogo en caliente y redibuja la selección
    agregarPersonajes(...nuevos) {
        this.catalogo.push(...nuevos.flat());
        this.dibujarCatalogo(this.buscador.value);
        return this.catalogo.length;
    }
}


/* ============================================================
   5) FABRICAR 100, 1000 O LOS PERSONAJES QUE SEAN
   ------------------------------------------------------------
   Esto es lo que la POO nos regala: un for y el molde hacen el resto.
   Es la consigna final del video: "generar 100, 1000 o los personajes
   que sean" a partir de UNA clase, sin escribir cada objeto a mano.
   Probalo en la consola del navegador (F12):

        juego.agregarPersonajes(fabricarPersonajes(100));
        juego.agregarPersonajes(fabricarPersonajes(1000, { nombre: 'Clon' }));
   ============================================================ */
function fabricarPersonajes(cantidad, molde = {}) {
    const {
        nombre = 'Guerrero',
        emoji  = '🥷',
        titulo = 'Nación del Fuego',
        tinte  = 'rgba(239, 68, 68, 0.14)',
        vidas  = 3
    } = molde;

    const lote = [];
    const base = nombre.toLowerCase().replace(/\s+/g, '-');

    for (let i = 1; i <= cantidad; i++) {
        lote.push(new Personaje({
            id:          `${base}-${i}`,
            nombre:      `${nombre} ${i}`,
            emoji,
            titulo,
            descripcion: `${nombre} número ${i}, salido del mismo molde.`,
            foto:        null,   // no tiene .webp: se dibuja con su emoji
            tinte,
            vidas
        }));
    }

    return lote;
}


/* ============================================================
   SONIDOS DE COMBATE (incluidos dentro de este mismo archivo)
   ------------------------------------------------------------
   Cada sonido está guardado como texto (base64), así que NO dependen
   de ninguna carpeta ni de otro archivo: si avatar.js carga, suenan.
   Los .mp3 originales están en audio/ por si querés cambiarlos.
   ============================================================ */
const SONIDOS_INCLUIDOS = {
    puno: 'data:audio/mpeg;base64,SUQzBAAAAAAtTVRTU0UAAAAPAAADTGF2ZjYwLjE2LjEwMABHRU9CAAAtKgAAA2FwcGxpY2F0aW9uL2MycGEAYzJwYQBjMnBhIG1hbmlmZXN0IHN0b3JlAAAAFn9qdW1iAAAAHmp1bWRjMnBhABEAEIAAAKoAOJtxA2MycGEAAAAWWWp1bWIAAABHanVtZGMybWEAEQAQgAAAqgA4m3EDdXJuOmMycGE6MDBjNmUxOGUtMThjMS00MDA0LWI1YzItYjdhMjM1NTBjMzljAAAAA5RqdW1iAAAAKWp1bWRjMmFzABEAEIAAAKoAOJtxA2MycGEuYXNzZXJ0aW9ucwAAAAC5anVtYgAAAERqdW1kY2JvcgARABCAAACqADibcRNjMnBhLmluZ3JlZGllbnQudjMAAAAAGGMyc2inHCqptN5JIU2iN3z3ptu7AAAAbWNib3KjaWRjOmZvcm1hdGphdWRpby9tcGVnamluc3RhbmNlSUR4LHhtcDppaWQ6ZWU4N2JlNmYtZDFmYy00NGI0LTlhNDUtMzlkZThjZjNhMzRjbHJlbGF0aW9uc2hpcGhwYXJlbnRPZgAAAeJqdW1iAAAAQWp1bWRjYm9yABEAEIAAAKoAOJtxE2MycGEuYWN0aW9ucy52MgAAAAAYYzJzaFZ634rMrmaFLPTF1Kc7DogAAAGZY2JvcqJnYWN0aW9uc4KiZmFjdGlvbmtjMnBhLm9wZW5lZGpwYXJhbWV0ZXJzoWtpbmdyZWRpZW50c4GiY3VybHgtc2VsZiNqdW1iZj1jMnBhLmFzc2VydGlvbnMvYzJwYS5pbmdyZWRpZW50LnYzZGhhc2hYIMb+ENfZGoavwo5F3fjocT4DkANevQ2vBC3c8/D4oXkapGZhY3Rpb254HWNvbS5hbnRocm9waWMuY2xhdWRlLnByb3ZpZGVkanBhcmFtZXRlcnOheB9jb20uYW50aHJvcGljLm9yaWdpbi1jb25maWRlbmNlZ3Vua25vd25rZGVzY3JpcHRpb254ZkNsYXVkZSBwcm92aWRlZCB0aGlzIGZpbGUgYXQgdGhlIHJlcXVlc3Qgb2YgYSB1c2VyIGFuZCBtYXkgaGF2ZSBjcmVhdGVkIG9yIG1vZGlmaWVkIHRoZSBmaWxlIGNvbnRlbnRzLm1zb2Z0d2FyZUFnZW50oWRuYW1lZkNsYXVkZXJhbGxBY3Rpb25zSW5jbHVkZWT1AAAAyGp1bWIAAABAanVtZGNib3IAEQAQgAAAqgA4m3ETYzJwYS5oYXNoLmRhdGEAAAAAGGMyc2grxvv9Lf5RFE1JGFhkIz5GAAAAgGNib3KlY2FsZ2ZzaGEyNTZjcGFkTQAAAAAAAAAAAAAAAABkaGFzaFgglN21lCy4yzQltTd+YSkF16ZIOIsaxusqmtSamO66AVJkbmFtZW5qdW1iZiBtYW5pZmVzdGpleGNsdXNpb25zgaJlc3RhcnQYWGZsZW5ndGgZFn8AAAI+anVtYgAAACdqdW1kYzJjbAARABCAAACqADibcQNjMnBhLmNsYWltLnYyAAAAAg9jYm9ypWNhbGdmc2hhMjU2aXNpZ25hdHVyZXhNc2VsZiNqdW1iZj0vYzJwYS91cm46YzJwYTowMGM2ZTE4ZS0xOGMxLTQwMDQtYjVjMi1iN2EyMzU1MGMzOWMvYzJwYS5zaWduYXR1cmVqaW5zdGFuY2VJRHgseG1wOmlpZDo1MzJlMWNiZC04MmNiLTQxNWQtYjAxOC0yNDM3YTk2MDcxOTlyY3JlYXRlZF9hc3NlcnRpb25zg6JjdXJseC1zZWxmI2p1bWJmPWMycGEuYXNzZXJ0aW9ucy9jMnBhLmluZ3JlZGllbnQudjNkaGFzaFggxv4Q19kahq/CjkXd+OhxPgOQA169Da8ELdzz8PiheRqiY3VybHgqc2VsZiNqdW1iZj1jMnBhLmFzc2VydGlvbnMvYzJwYS5hY3Rpb25zLnYyZGhhc2hYIAeJIsNfgbyYdAruR/9NA98NLlFCbrO+VTQNYoKUvyrmomN1cmx4KXNlbGYjanVtYmY9YzJwYS5hc3NlcnRpb25zL2MycGEuaGFzaC5kYXRhZGhhc2hYIOWGBvrRr4FNSxmchc3K1d8lLfUeBNrtjvg0d1cbOXoidGNsYWltX2dlbmVyYXRvcl9pbmZvo2RuYW1lb0FudGhyb3BpYyBGaWxlc2d2ZXJzaW9uZTEuMC4wa3NwZWNWZXJzaW9uZTIuNC4wAAAQOGp1bWIAAAAoanVtZGMyY3MAEQAQgAAAqgA4m3EDYzJwYS5zaWduYXR1cmUAAAAQCGNib3LShFkCEqIBJhghWQIKMIICBjCCAY2gAwIBAgIUQOWgCu7COdC+uIP6BkIFPWdVEwAwCgYIKoZIzj0EAwMwSTEXMBUGA1UEChMOQW50aHJvcGljLCBQQkMxLjAsBgNVBAMTJUFudGhyb3BpYyBDb250ZW50IENyZWRlbnRpYWxzIFJvb3QgQ0EwHhcNMjYwODA3MTg0MzU2WhcNMjgwODA2MTk0MzU2WjBEMRcwFQYDVQQKEw5BbnRocm9waWMsIFBCQzEpMCcGA1UEAxMgQW50aHJvcGljIENsYXVkZSBDb250ZW50IFNpZ25pbmcwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAASYegpry1AYBRTVNL1CpTlbROnY3dey+UrsF9C3phYrATN3ZHf93Mo8RQN0KOUuOn19P4oWNFWe5n2/She9N7eTo1gwVjAOBgNVHQ8BAf8EBAMCB4AwFQYDVR0lBA4wDAYKKwYBBAGD6F4CATAMBgNVHRMBAf8EAjAAMB8GA1UdIwQYMBaAFM5R4gSBTmRbI/jjxM+aPpzB11zCMAoGCCqGSM49BAMDA2cAMGQCMDFzHRSeAXrSy1WOzkbhPZ6Km2wGTmZ/2gK18k8BQGXyqz88Rdrz6CTX9flAnYNVxgIwcF9c3fVhqmJKpi+UhasNUMko69cyX6STPfta3Q8EjyzDjzoyrol46FP6VFHhvUcJoWNwYWRZDZ4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA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qqqqqqqqqqpMQU1FMy4xMDCqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//sUZOoP8IQAxzAAAAAAAA/wAAABAAAB/gAAACAAAD/AAAAEqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqpMQU1FMy4xMDCqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//sUROGP8AAAf4AAAAgAAA/wAAABAAAB/gAAACAAAD/AAAAEqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqpMQU1FMy4xMDCqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//sUZOGP8AAAf4AAAAgAAA/wAAABAAAB/gAAACAAAD/AAAAEqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqpMQU1FMy4xMDCqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//sUZOGP8AAAf4AAAAgAAA/wAAABAAAB/gAAACAAAD/AAAAEqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqpMQU1FMy4xMDCqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//sUZOGP8AAAf4AAAAgAAA/wAAABAAABpAAAACAAADSAAAAEqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqpMQU1FMy4xMDCqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//sUZOGP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//sUZOGP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//sUZOGP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//sUZOGP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//sUZOGP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//sUZOGP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//sUZOGP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//sUZOGP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
    patada: 'data:audio/mpeg;base64,SUQzBAAAAAAtTVRTU0UAAAAPAAADTGF2ZjYwLjE2LjEwMABHRU9CAAAtKgAAA2FwcGxpY2F0aW9uL2MycGEAYzJwYQBjMnBhIG1hbmlmZXN0IHN0b3JlAAAAFn9qdW1iAAAAHmp1bWRjMnBhABEAEIAAAKoAOJtxA2MycGEAAAAWWWp1bWIAAABHanVtZGMybWEAEQAQgAAAqgA4m3EDdXJuOmMycGE6MmQ1NmVhODktMDY2MC00NDg1LWIwZWUtZjBjMDJhNTUzYTFhAAAAA5RqdW1iAAAAKWp1bWRjMmFzABEAEIAAAKoAOJtxA2MycGEuYXNzZXJ0aW9ucwAAAAC5anVtYgAAAERqdW1kY2JvcgARABCAAACqADibcRNjMnBhLmluZ3JlZGllbnQudjMAAAAAGGMyc2ilKXnW15/53tbIPHU/e8eqAAAAbWNib3KjaWRjOmZvcm1hdGphdWRpby9tcGVnamluc3RhbmNlSUR4LHhtcDppaWQ6ZGNhNWYwMWEtM2JiYS00NDExLWE1YTctNzRmOTU0OTUzMTlhbHJlbGF0aW9uc2hpcGhwYXJlbnRPZgAAAeJqdW1iAAAAQWp1bWRjYm9yABEAEIAAAKoAOJtxE2MycGEuYWN0aW9ucy52MgAAAAAYYzJzaHVRwPosFSmtLGc/H8Qa28sAAAGZY2JvcqJnYWN0aW9uc4KiZmFjdGlvbmtjMnBhLm9wZW5lZGpwYXJhbWV0ZXJzoWtpbmdyZWRpZW50c4GiY3VybHgtc2VsZiNqdW1iZj1jMnBhLmFzc2VydGlvbnMvYzJwYS5pbmdyZWRpZW50LnYzZGhhc2hYIGxK1Mz865P0zJ4O6ZsxE3n95O7O89BN0jPvYwljOIjPpGZhY3Rpb254HWNvbS5hbnRocm9waWMuY2xhdWRlLnByb3ZpZGVkanBhcmFtZXRlcnOheB9jb20uYW50aHJvcGljLm9yaWdpbi1jb25maWRlbmNlZ3Vua25vd25rZGVzY3JpcHRpb254ZkNsYXVkZSBwcm92aWRlZCB0aGlzIGZpbGUgYXQgdGhlIHJlcXVlc3Qgb2YgYSB1c2VyIGFuZCBtYXkgaGF2ZSBjcmVhdGVkIG9yIG1vZGlmaWVkIHRoZSBmaWxlIGNvbnRlbnRzLm1zb2Z0d2FyZUFnZW50oWRuYW1lZkNsYXVkZXJhbGxBY3Rpb25zSW5jbHVkZWT1AAAAyGp1bWIAAABAanVtZGNib3IAEQAQgAAAqgA4m3ETYzJwYS5oYXNoLmRhdGEAAAAAGGMyc2hAtRs2kPTlAlZm2Xp/39JlAAAAgGNib3KlY2FsZ2ZzaGEyNTZjcGFkTQAAAAAAAAAAAAAAAABkaGFzaFggu7jD91wegEECkAb7GbCkcDnAJDDuGtsElYaQ/IxwttFkbmFtZW5qdW1iZiBtYW5pZmVzdGpleGNsdXNpb25zgaJlc3RhcnQYWGZsZW5ndGgZFn8AAAI+anVtYgAAACdqdW1kYzJjbAARABCAAACqADibcQNjMnBhLmNsYWltLnYyAAAAAg9jYm9ypWNhbGdmc2hhMjU2aXNpZ25hdHVyZXhNc2VsZiNqdW1iZj0vYzJwYS91cm46YzJwYToyZDU2ZWE4OS0wNjYwLTQ0ODUtYjBlZS1mMGMwMmE1NTNhMWEvYzJwYS5zaWduYXR1cmVqaW5zdGFuY2VJRHgseG1wOmlpZDo4OTA0NWRmZS0wYzZjLTQyZmQtODMxYS0zNzQyN2E2NzBhYzRyY3JlYXRlZF9hc3NlcnRpb25zg6JjdXJseC1zZWxmI2p1bWJmPWMycGEuYXNzZXJ0aW9ucy9jMnBhLmluZ3JlZGllbnQudjNkaGFzaFggbErUzPzrk/TMng7pmzETef3k7s7z0E3SM+9jCWM4iM+iY3VybHgqc2VsZiNqdW1iZj1jMnBhLmFzc2VydGlvbnMvYzJwYS5hY3Rpb25zLnYyZGhhc2hYIPtAJgeYsxXpC6GV5N0szYF+pbml+PUrOQTvkwgO6QscomN1cmx4KXNlbGYjanVtYmY9YzJwYS5hc3NlcnRpb25zL2MycGEuaGFzaC5kYXRhZGhhc2hYIKHR100/UpcxQzJpLrMoc9YwZQ5ASvDTvRrp8h9NzY9TdGNsYWltX2dlbmVyYXRvcl9pbmZvo2RuYW1lb0FudGhyb3BpYyBGaWxlc2d2ZXJzaW9uZTEuMC4wa3NwZWNWZXJzaW9uZTIuNC4wAAAQOGp1bWIAAAAoanVtZGMyY3MAEQAQgAAAqgA4m3EDYzJwYS5zaWduYXR1cmUAAAAQCGNib3LShFkCEqIBJhghWQIKMIICBjCCAY2gAwIBAgIUQOWgCu7COdC+uIP6BkIFPWdVEwAwCgYIKoZIzj0EAwMwSTEXMBUGA1UEChMOQW50aHJvcGljLCBQQkMxLjAsBgNVBAMTJUFudGhyb3BpYyBDb250ZW50IENyZWRlbnRpYWxzIFJvb3QgQ0EwHhcNMjYwODA3MTg0MzU2WhcNMjgwODA2MTk0MzU2WjBEMRcwFQYDVQQKEw5BbnRocm9waWMsIFBCQzEpMCcGA1UEAxMgQW50aHJvcGljIENsYXVkZSBDb250ZW50IFNpZ25pbmcwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAASYegpry1AYBRTVNL1CpTlbROnY3dey+UrsF9C3phYrATN3ZHf93Mo8RQN0KOUuOn19P4oWNFWe5n2/She9N7eTo1gwVjAOBgNVHQ8BAf8EBAMCB4AwFQYDVR0lBA4wDAYKKwYBBAGD6F4CATAMBgNVHRMBAf8EAjAAMB8GA1UdIwQYMBaAFM5R4gSBTmRbI/jjxM+aPpzB11zCMAoGCCqGSM49BAMDA2cAMGQCMDFzHRSeAXrSy1WOzkbhPZ6Km2wGTmZ/2gK18k8BQGXyqz88Rdrz6CTX9flAnYNVxgIwcF9c3fVhqmJKpi+UhasNUMko69cyX6STPfta3Q8EjyzDjzoyrol46FP6VFHhvUcJoWNwYWRZDZ4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA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SGnpQkAnQRjpMGIiCFRnIaekyMA1BGQgMA0EVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//skZPqBMaoMRskvMDAOQQkZCAIZAoAXI4SMAqAcgWPgEYAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sUZOoP8E8AyEAgAAgGQFjVBGEBQAAB/gAAACAAAD/AAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sUZOIP8AMAx4AgAAgAAA/wAAABAAAB/gAAACAAAD/AAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sUZOIP8AMAyAAgAAgAAA/wAAABAAAB/gAAACAAAD/AAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sUZOGP8AAAf4AAAAgAAA/wAAABAAAB/gAAACAAAD/AAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
    barrida: 'data:audio/mpeg;base64,SUQzBAAAAAAtTVRTU0UAAAAPAAADTGF2ZjYwLjE2LjEwMABHRU9CAAAtKgAAA2FwcGxpY2F0aW9uL2MycGEAYzJwYQBjMnBhIG1hbmlmZXN0IHN0b3JlAAAAFn9qdW1iAAAAHmp1bWRjMnBhABEAEIAAAKoAOJtxA2MycGEAAAAWWWp1bWIAAABHanVtZGMybWEAEQAQgAAAqgA4m3EDdXJuOmMycGE6OTA4NDRiYzAtZDAyYy00MGRkLWEyNzEtNTg3YTg2YWZmMjRjAAAAA5RqdW1iAAAAKWp1bWRjMmFzABEAEIAAAKoAOJtxA2MycGEuYXNzZXJ0aW9ucwAAAAC5anVtYgAAAERqdW1kY2JvcgARABCAAACqADibcRNjMnBhLmluZ3JlZGllbnQudjMAAAAAGGMyc2germtXQnuxQQ5Yp8XAGU+oAAAAbWNib3KjaWRjOmZvcm1hdGphdWRpby9tcGVnamluc3RhbmNlSUR4LHhtcDppaWQ6ZDI2ODY3YWUtYzg2Zi00ZmIyLTkyM2MtOTA5MzdlMDEyMjRjbHJlbGF0aW9uc2hpcGhwYXJlbnRPZgAAAeJqdW1iAAAAQWp1bWRjYm9yABEAEIAAAKoAOJtxE2MycGEuYWN0aW9ucy52MgAAAAAYYzJzaKrHt81V+g031UzDhg/7vq8AAAGZY2JvcqJnYWN0aW9uc4KiZmFjdGlvbmtjMnBhLm9wZW5lZGpwYXJhbWV0ZXJzoWtpbmdyZWRpZW50c4GiY3VybHgtc2VsZiNqdW1iZj1jMnBhLmFzc2VydGlvbnMvYzJwYS5pbmdyZWRpZW50LnYzZGhhc2hYIPfzvL2benNn0Y8odU68ffRKfX5zhqQ7uDINH4A45QchpGZhY3Rpb254HWNvbS5hbnRocm9waWMuY2xhdWRlLnByb3ZpZGVkanBhcmFtZXRlcnOheB9jb20uYW50aHJvcGljLm9yaWdpbi1jb25maWRlbmNlZ3Vua25vd25rZGVzY3JpcHRpb254ZkNsYXVkZSBwcm92aWRlZCB0aGlzIGZpbGUgYXQgdGhlIHJlcXVlc3Qgb2YgYSB1c2VyIGFuZCBtYXkgaGF2ZSBjcmVhdGVkIG9yIG1vZGlmaWVkIHRoZSBmaWxlIGNvbnRlbnRzLm1zb2Z0d2FyZUFnZW50oWRuYW1lZkNsYXVkZXJhbGxBY3Rpb25zSW5jbHVkZWT1AAAAyGp1bWIAAABAanVtZGNib3IAEQAQgAAAqgA4m3ETYzJwYS5oYXNoLmRhdGEAAAAAGGMyc2jXPwtsxJ4OfnHlaIMc/ZWrAAAAgGNib3KlY2FsZ2ZzaGEyNTZjcGFkTQAAAAAAAAAAAAAAAABkaGFzaFggxWs/lO64QXftA8NLctzlwU1XRITtGZtbVT3JnvvFmmNkbmFtZW5qdW1iZiBtYW5pZmVzdGpleGNsdXNpb25zgaJlc3RhcnQYWGZsZW5ndGgZFn8AAAI+anVtYgAAACdqdW1kYzJjbAARABCAAACqADibcQNjMnBhLmNsYWltLnYyAAAAAg9jYm9ypWNhbGdmc2hhMjU2aXNpZ25hdHVyZXhNc2VsZiNqdW1iZj0vYzJwYS91cm46YzJwYTo5MDg0NGJjMC1kMDJjLTQwZGQtYTI3MS01ODdhODZhZmYyNGMvYzJwYS5zaWduYXR1cmVqaW5zdGFuY2VJRHgseG1wOmlpZDo3ODgwNTcwNC1hYzA1LTQ2MjAtOWJjNy05ZjkwM2ZjYzQxODJyY3JlYXRlZF9hc3NlcnRpb25zg6JjdXJseC1zZWxmI2p1bWJmPWMycGEuYXNzZXJ0aW9ucy9jMnBhLmluZ3JlZGllbnQudjNkaGFzaFgg9/O8vZt6c2fRjyh1Trx99Ep9fnOGpDu4Mg0fgDjlByGiY3VybHgqc2VsZiNqdW1iZj1jMnBhLmFzc2VydGlvbnMvYzJwYS5hY3Rpb25zLnYyZGhhc2hYIAGNAbiS+V3mtzl8lIsInAU/AqVN2w+hiiG+GHacc9bhomN1cmx4KXNlbGYjanVtYmY9YzJwYS5hc3NlcnRpb25zL2MycGEuaGFzaC5kYXRhZGhhc2hYIBYcD9PChuhNfkiN88V+2Kozvn2HnSoNnPceUtNswYyKdGNsYWltX2dlbmVyYXRvcl9pbmZvo2RuYW1lb0FudGhyb3BpYyBGaWxlc2d2ZXJzaW9uZTEuMC4wa3NwZWNWZXJzaW9uZTIuNC4wAAAQOGp1bWIAAAAoanVtZGMyY3MAEQAQgAAAqgA4m3EDYzJwYS5zaWduYXR1cmUAAAAQCGNib3LShFkCEqIBJhghWQIKMIICBjCCAY2gAwIBAgIUQOWgCu7COdC+uIP6BkIFPWdVEwAwCgYIKoZIzj0EAwMwSTEXMBUGA1UEChMOQW50aHJvcGljLCBQQkMxLjAsBgNVBAMTJUFudGhyb3BpYyBDb250ZW50IENyZWRlbnRpYWxzIFJvb3QgQ0EwHhcNMjYwODA3MTg0MzU2WhcNMjgwODA2MTk0MzU2WjBEMRcwFQYDVQQKEw5BbnRocm9waWMsIFBCQzEpMCcGA1UEAxMgQW50aHJvcGljIENsYXVkZSBDb250ZW50IFNpZ25pbmcwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAASYegpry1AYBRTVNL1CpTlbROnY3dey+UrsF9C3phYrATN3ZHf93Mo8RQN0KOUuOn19P4oWNFWe5n2/She9N7eTo1gwVjAOBgNVHQ8BAf8EBAMCB4AwFQYDVR0lBA4wDAYKKwYBBAGD6F4CATAMBgNVHRMBAf8EAjAAMB8GA1UdIwQYMBaAFM5R4gSBTmRbI/jjxM+aPpzB11zCMAoGCCqGSM49BAMDA2cAMGQCMDFzHRSeAXrSy1WOzkbhPZ6Km2wGTmZ/2gK18k8BQGXyqz88Rdrz6CTX9flAnYNVxgIwcF9c3fVhqmJKpi+UhasNUMko69cyX6STPfta3Q8EjyzDjzoyrol46FP6VFHhvUcJoWNwYWRZDZ4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA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',
    victoria: 'data:audio/mpeg;base64,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qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqv/70GQAD/AAAGkAAAAIAAANIAAAAQAAAaQAAAAgAAA0gAAABExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqkxBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqo=',
    derrota: 'data:audio/mpeg;base64,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4TpE5ww3R+I+OS8U0NI3S+bR4yOU0LSUrEEhCohlQ/URxfEtXLVxiSg5B4NQtGhumwQsN375+tmYIG6f1q2ZWpmWmToqkITyCJxfOG0iGkO3+UxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+9JkAA/wAABpAAAACAAADSAAAAEAAAGkAAAAIAAANIAAAARMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/70mQAD/AAAGkAAAAIAAANIAAAAQAAAaQAAAAgAAA0gAAABExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//vSZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=',
};


/* ============================================================
   FUNCIONES DE MOVIMIENTO (las de la clase)
   ------------------------------------------------------------
   Son las funciones sueltas que llaman los botones del HTML con
   onmousedown / onmouseup. Por dentro avisan al objeto `juego`.
   ============================================================ */
function moverArriba()       { juego.moverArriba(); }
function moverAbajo()        { juego.moverAbajo(); }
function moverIzquierda()    { juego.moverIzquierda(); }
function moverDerecha()      { juego.moverDerecha(); }
function detenerMovimiento() { juego.detenerMovimiento(); }
function pintarPersonaje()   { juego.pintarPersonaje(); }
function pintarCanvas()      { juego.pintarPersonaje(); }          // en la clase se llama así: ya no pinta solo al personaje, sino todo el canvas
function iniciarMapa()       { juego.iniciarMapa(); }
function obtenerObjetoPersonaje() { return juego.jugador; }        // devuelve el objeto completo del personaje elegido
Object.defineProperty(window, 'personajeJugadorObjeto', { get: () => juego.jugador });

// Cuando se presiona una tecla: según cuál sea, llama a la función de movimiento
function sePresionoUnaTecla(event) {
    switch (event.key) {
        case 'ArrowUp':
            moverArriba();
            break;
        case 'ArrowDown':
            moverAbajo();
            break;
        case 'ArrowLeft':
            moverIzquierda();
            break;
        case 'ArrowRight':
            moverDerecha();
            break;
        default:
            break;
    }
}

/* ============================================================
   CONTROL DE VERSIÓN: avatar.html y avatar.js tienen que ser del mismo juego.
   Si el HTML es una versión vieja, en vez de fallar en silencio se avisa.
   ============================================================ */
const IDS_NECESARIOS = [
    'lista-personajes', 'ver-mapa', 'mapa', 'boton-ir-combate', 'pelea-2d', 'canvas-pelea',
    'boton-modo-pelea', 'boton-salir-pelea', 'pelea-p1', 'pelea-p2', 'boton-pelea-1p', 'boton-pelea-2p',
    'boton-reiniciar-arena', 'boton-salir-arena', 'boton-reiniciar-pelea', 'boton-salir-mapa', 'boton-salir-final',
    'volumen-musica', 'volumen-efectos', 'boton-musica', 'musica-fondo', 'chips-elemento', 'retratos-nuevo'
];
const IDS_FALTANTES = IDS_NECESARIOS.filter(id => !document.getElementById(id));
if (IDS_FALTANTES.length) {
    const aviso = document.createElement('div');
    aviso.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:999;padding:.8rem 1rem;background:#7f1d1d;color:#fff;font:600 15px sans-serif;text-align:center';
    aviso.textContent = `⚠️ avatar.html está desactualizado (falta: ${IDS_FALTANTES.join(', ')}). Reemplazá avatar.html por el nuevo y recargá con Ctrl + F5.`;
    document.body.prepend(aviso);
    throw new Error('avatar.html no coincide con avatar.js. Falta: ' + IDS_FALTANTES.join(', '));
}


/* ============================================================
   6) ARRANQUE DEL JUEGO
   ============================================================ */
const juego = new Juego({ catalogo: PERSONAJES, ataques: ATAQUES });
juego.iniciar();

// Los dejamos a mano para poder jugar desde la consola del navegador
window.juego              = juego;
window.Personaje          = Personaje;
window.Ataque             = Ataque;
window.fabricarPersonajes = fabricarPersonajes;
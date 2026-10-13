
/* ---------------------------------------------------------------------
   Piezas de interfaz. Nada acá lleva sombra: la jerarquía se resuelve
   con línea y valor, como en una carta impresa.
   ------------------------------------------------------------------ */

export function Panel({ children, className = '', oscuro = false }) {
  return (
    <div className={`rounded-carta border backdrop-blur-md transition-[transform,border-color,background-color] duration-200 ${oscuro
      ? 'border-columna/60 bg-hondo/90 text-carta'
      : 'border-trazo/50 bg-papel/85'} ${className}`}>
      {children}
    </div>
  );
}

export function TituloPanel({ children, accion }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-trazo px-5 py-3">
      <h2 className="font-display text-base font-600">{children}</h2>
      {accion}
    </div>
  );
}

/**
 * Sonda: el número grande con su unidad. Se llama así porque en una carta
 * náutica la sonda es la cifra de profundidad impresa sobre el agua.
 */
export function Sonda({ valor, unidad, rotulo, color, className = '' }) {
  return (
    <div className={className}>
      <div className="flex items-baseline gap-1">
        <span className="cifra font-display text-3xl font-600 leading-none"
              style={color ? { color } : undefined}>{valor}</span>
        {unidad && <span className="text-sm text-tinta/70">{unidad}</span>}
      </div>
      <p className="mt-1.5 text-sm text-tinta/80">{rotulo}</p>
    </div>
  );
}

export function SonarPing({ size = 16, color = 'var(--color-kelp)', opaco = false }) {
  return (
    <span className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ backgroundColor: color }}></span>
      <span className="relative inline-flex rounded-full" style={{ width: size * 0.4, height: size * 0.4, backgroundColor: opaco ? color : 'var(--color-carta)' }}></span>
    </span>
  );
}

export function Boton({ children, variante = 'principal', className = '', cargando, ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-carta px-4 py-2.5 text-sm font-500 transition-all duration-300 hover:-translate-y-px active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0';
  const variantes = {
    // Sobre agua el primario se invierte: relleno claro, tinta profunda.
    // Con bg-abismo desaparecía contra el fondo de la página.
    principal: 'bg-carta text-abismo hover:bg-sonda hover:shadow-[0_0_15px_rgb(127_181_176_/_0.3)]',
    kelp:      'bg-kelp text-abismo hover:bg-kelp-alto hover:shadow-[0_0_20px_rgb(200_135_47_/_0.4)]',
    linea:     'border border-trazo bg-transparent hover:bg-columna/25',
    lineaClara:'border border-columna text-carta hover:bg-columna/40 hover:shadow-[0_0_15px_rgb(127_181_176_/_0.2)]',
    texto:     'px-1 underline underline-offset-4 hover:text-kelp',
  };
  return (
    <button className={`${base} ${variantes[variante]} ${className}`} disabled={cargando || props.disabled} {...props}>
      {cargando && <SonarPing size={14} color="var(--color-abismo)" opaco />}
      {children}
    </button>
  );
}

export function Etiqueta({ children, color, tenue = false }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-carta border px-2 py-0.5 text-xs font-500"
          style={{
            borderColor: color ?? 'var(--color-trazo)',
            color: tenue ? 'var(--color-tinta)' : (color ?? 'var(--color-tinta)'),
            backgroundColor: color ? `${color}14` : 'transparent',
          }}>
      {children}
    </span>
  );
}

export function Campo({ etiqueta, ayuda, children, requerido }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-500">
        {etiqueta}{requerido && <span className="text-alerta"> *</span>}
      </span>
      {children}
      {ayuda && <span className="mt-1 block text-xs text-tinta/70">{ayuda}</span>}
    </label>
  );
}

const claseControl = 'w-full rounded-carta border border-trazo bg-papel px-3 py-2.5 text-sm outline-none focus:border-kelp';

// className se suma a la clase base. Si viajara dentro de ...props la
// reemplazaría entera y el control quedaría sin borde ni fondo.
export const Entrada = ({ className = '', ...props }) => (
  <input className={`${claseControl} ${className}`} {...props} />
);
export const Area = ({ className = '', ...props }) => (
  <textarea rows={3} className={`${claseControl} ${className}`} {...props} />
);
export const Selector = ({ children, className = '', ...props }) => (
  <select className={`${claseControl} ${className}`} {...props}>{children}</select>
);

export function Cargando({ texto = 'Cargando' }) {
  return (
    <div className="flex items-center gap-3 py-10 text-sm text-tinta/70">
      <SonarPing size={18} color="var(--color-sonda)" /> {texto}…
    </div>
  );
}

/** Los errores explican qué pasó y ofrecen la salida. No piden disculpas. */
export function CajaError({ error, onReintentar }) {
  return (
    <div className="rounded-carta border border-alerta/40 bg-alerta/5 px-4 py-3">
      <p className="text-sm text-alerta">{error?.message ?? 'No pudimos cargar esto'}</p>
      {onReintentar && (
        <button onClick={onReintentar} className="mt-2 text-sm underline underline-offset-4">
          Reintentar
        </button>
      )}
    </div>
  );
}

/** Una pantalla vacía es una invitación a actuar, no un cartel de error. */
export function Vacio({ titulo, detalle, accion }) {
  return (
    <div className="px-5 py-12 text-center">
      <p className="font-display text-lg">{titulo}</p>
      {detalle && <p className="mx-auto mt-1.5 max-w-sm text-sm text-tinta/80">{detalle}</p>}
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  );
}

/** Barra de avance. El ámbar solo aparece cuando hay progreso real. */
export function Barra({ valor, max = 100, color = 'var(--color-kelp)', alto = 6 }) {
  const pct = Math.max(0, Math.min(100, (valor / max) * 100));
  return (
    <div className="w-full rounded-full bg-trazo/60" style={{ height: alto }}>
      <div className="rounded-full transition-[width] duration-500"
           style={{ width: `${pct}%`, height: alto, backgroundColor: color }} />
    </div>
  );
}

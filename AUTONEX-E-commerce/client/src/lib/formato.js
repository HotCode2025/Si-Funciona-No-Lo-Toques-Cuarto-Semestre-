const pesos = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const fechaCorta = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fechaHora = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const precio = (valor) => (valor === null || valor === undefined ? '—' : pesos.format(Number(valor)));
export const fecha = (valor) => (valor ? fechaCorta.format(new Date(valor)) : '—');
export const fechaYHora = (valor) => (valor ? fechaHora.format(new Date(valor)) : '—');

/** Ruta de una imagen local (guardada en la base como /img/...) respetando la subruta de la app. */
export function imagen(ruta) {
  if (!ruta) return `${import.meta.env.BASE_URL}img/sin-imagen.svg`;
  if (/^https?:\/\//.test(ruta)) return ruta;
  return `${import.meta.env.BASE_URL}${ruta.replace(/^\//, '')}`;
}

export const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/** Texto comparable: minúsculas y sin tildes ("Citroën" -> "citroen"). */
export const normalizar = (texto) => String(texto ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

// Presentación de estados propios de la app (texto y color). Las listas de datos (provincias, transportistas,
// combustibles, tipos de vehículo...) vienen de la API: ver useReferencias en hooks.js.

export const ESTADOS_PEDIDO = {
  pendiente_pago: { texto: 'Esperando pago', tono: 'gris' },
  pagado: { texto: 'Pagado', tono: 'azul' },
  en_preparacion: { texto: 'En preparación', tono: 'ambar' },
  enviado: { texto: 'Enviado', tono: 'violeta' },
  listo_para_retirar: { texto: 'Listo para retirar', tono: 'violeta' },
  entregado: { texto: 'Entregado', tono: 'verde' },
  cancelado: { texto: 'Cancelado', tono: 'rojo' },
};

export const ESTADOS_COMPRA = {
  pendiente_pago: { texto: 'Pago pendiente', tono: 'ambar' },
  pagada: { texto: 'Pagada', tono: 'verde' },
  pago_rechazado: { texto: 'Pago rechazado', tono: 'rojo' },
  cancelada: { texto: 'Cancelada', tono: 'gris' },
};

// Estado y medio de pago tal como los informa Mercado Pago (payment.status / payment_method_id)
export const ESTADOS_PAGO_MP = {
  approved: 'aprobado',
  authorized: 'autorizado',
  pending: 'pendiente',
  in_process: 'en revisión',
  in_mediation: 'en mediación',
  rejected: 'rechazado',
  cancelled: 'cancelado',
  refunded: 'devuelto',
  charged_back: 'contracargo',
};

export const MEDIOS_PAGO_MP = {
  master: 'Mastercard',
  visa: 'Visa',
  amex: 'American Express',
  naranja: 'Naranja',
  cabal: 'Cabal',
  maestro: 'Maestro',
  debmaster: 'Mastercard Débito',
  debvisa: 'Visa Débito',
  debcabal: 'Cabal Débito',
  account_money: 'dinero en cuenta',
  consumer_credits: 'Cuotas sin tarjeta',
  rapipago: 'Rapipago',
  pagofacil: 'Pago Fácil',
};

// Transportistas que dan número de seguimiento (el envío en moto lo hace el mismo vendedor)
export const TRANSPORTISTAS_CON_SEGUIMIENTO = ['andreani', 'oca', 'correo_argentino'];

export const ACCIONES_PEDIDO = {
  en_preparacion: 'Marcar en preparación',
  enviado: 'Marcar como enviado',
  listo_para_retirar: 'Marcar listo para retirar',
  entregado: 'Marcar como entregado',
};

/** Pasos del pedido según la forma de entrega (para la línea de tiempo). */
export function pasosPedido(metodo) {
  return metodo === 'retiro'
    ? ['pagado', 'en_preparacion', 'listo_para_retirar', 'entregado']
    : ['pagado', 'en_preparacion', 'enviado', 'entregado'];
}

/** Color de cada estado de verificación (el texto viene de /api/referencias). */
export const TONOS_VERIFICACION = {
  VERIFIED: 'verde',
  UNVERIFIED: 'ambar',
  NEEDS_REVIEW: 'ambar',
  DISCONTINUED: 'gris',
};

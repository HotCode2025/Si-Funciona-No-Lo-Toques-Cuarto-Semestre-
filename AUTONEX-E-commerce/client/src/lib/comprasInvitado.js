// Compras hechas sin cuenta: el servidor da un código de acceso secreto por compra. Para no dejar datos del comprador
// en una computadora compartida, el código se guarda solo en esta pestaña (sessionStorage): sirve para pagar, volver de
// Mercado Pago y ver el comprobante, y se borra al cerrarla. Después la compra se busca con su número y el email.

const CLAVE = 'autonex.compras_invitado';

// Versiones anteriores guardaban las compras en localStorage, que queda para siempre en el navegador: se borra.
try {
  localStorage.removeItem(CLAVE);
} catch {
  /* sin localStorage */
}

function leer() {
  try {
    const guardado = JSON.parse(sessionStorage.getItem(CLAVE));
    return guardado && typeof guardado === 'object' ? guardado : {};
  } catch {
    return {};
  }
}

export function guardarCompraInvitado(compraId, codigo) {
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify({ ...leer(), [compraId]: { codigo, guardada_en: new Date().toISOString() } }));
  } catch {
    /* sin sessionStorage: la compra se puede recuperar con número + email */
  }
}

/** Saca de esta pestaña las compras sin cuenta (botón "Cerrar" de Seguí tu compra). */
export function olvidarComprasInvitado() {
  try {
    sessionStorage.removeItem(CLAVE);
  } catch {
    /* sin sessionStorage */
  }
}

/** Header con el código de la compra (vacío si esta pestaña no lo tiene). */
export function cabeceraCompra(compraId) {
  const codigo = leer()[compraId]?.codigo;
  return codigo ? { 'X-Codigo-Compra': codigo } : {};
}

/** Números de las compras sin cuenta abiertas en esta pestaña, de la más nueva a la más vieja. */
export function comprasDelNavegador() {
  return Object.entries(leer())
    .sort(([, a], [, b]) => String(b.guardada_en).localeCompare(String(a.guardada_en)))
    .map(([id]) => Number(id));
}

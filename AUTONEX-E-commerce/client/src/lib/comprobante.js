// Comprobante de una compra: enlace para seguirla y el texto que se comparte (WhatsApp, mail, etc.).
// El texto no lleva datos personales (dirección, teléfono, email): solo números de compra, de pago y de seguimiento.
import { etiquetaDe } from './hooks.js';
import { precio } from './formato.js';
import { ESTADOS_COMPRA, ESTADOS_PAGO_MP } from './constantes.js';

/** Dirección pública de "Seguí tu compra" con el número ya cargado. */
export const urlSeguimiento = (compraId) => `${window.location.origin}${import.meta.env.BASE_URL}seguir-compra?compra=${compraId}`;

/** Cómo va la entrega de un pedido, en una línea. */
export function lineaEntrega(pedido, referencias) {
  const { envio, vendedor } = pedido;
  if (envio.metodo === 'retiro') return `Retiro en el local (${vendedor.direccion}, ${vendedor.ciudad})`;
  const transportista = etiquetaDe(referencias, 'transportistas', envio.transportista);
  if (envio.numero_seguimiento) return `Envío por ${transportista} · N° de seguimiento ${envio.numero_seguimiento}`;
  if (envio.transportista === 'moto') return `Envío en moto del vendedor`;
  if (['enviado', 'entregado'].includes(pedido.estado)) return `Envío por ${transportista} · ya despachado`;
  return `Envío por ${transportista} · el número de seguimiento aparece cuando el vendedor lo despacha`;
}

export function textoComprobante(compra, referencias) {
  const lineas = [
    `Comprobante AUTONEX · Compra #${compra.id}`,
    `Estado: ${ESTADOS_COMPRA[compra.estado]?.texto || compra.estado} · Total ${precio(compra.total)}`,
  ];
  if (compra.ultimo_pago?.mp_pago_id) {
    lineas.push(`Pago Mercado Pago N° ${compra.ultimo_pago.mp_pago_id} (${ESTADOS_PAGO_MP[compra.ultimo_pago.estado] || compra.ultimo_pago.estado})`);
  }
  for (const p of compra.pedidos) {
    lineas.push(`Pedido #${p.id} · ${p.vendedor.nombre_comercial}: ${lineaEntrega(p, referencias)}`);
  }
  lineas.push(`Seguí la compra en ${urlSeguimiento(compra.id)} con el número ${compra.id} y el email de la compra.`);
  return lineas.join('\n');
}

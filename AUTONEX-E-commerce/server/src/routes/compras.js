import { ErrorApi } from '../errores.js';
import {
  codigoPostal, dni, email, id, paramsId, provincia, telefono, texto, textoOpcional, TRANSPORTISTAS,
} from '../esquemas.js';
import {
  buscarCompraInvitado, crearCompra, iniciarPago, listarCompras, obtenerCompra, puedeVerCompra,
} from '../services/compras.js';
import { procesarPago } from '../services/pagos.js';
import { esquemaItems } from './carrito.js';

const esquemaCompra = {
  type: 'object',
  additionalProperties: false,
  required: ['comprador', 'items', 'entregas'],
  properties: {
    comprador: {
      type: 'object',
      additionalProperties: false,
      required: ['nombre', 'apellido', 'email', 'telefono', 'dni'],
      properties: { nombre: texto(60, 2), apellido: texto(60, 2), email, telefono, dni },
    },
    items: esquemaItems,
    entregas: {
      type: 'array',
      minItems: 1,
      maxItems: 30,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['vendedor_id', 'metodo'],
        properties: {
          vendedor_id: id,
          metodo: { type: 'string', enum: ['retiro', 'domicilio'] },
          transportista: { type: 'string', enum: TRANSPORTISTAS },
        },
      },
    },
    direccion: {
      type: 'object',
      additionalProperties: false,
      required: ['calle', 'numero', 'codigo_postal', 'localidad', 'provincia'],
      properties: {
        calle: texto(80, 2),
        numero: texto(10, 1),
        piso_depto: textoOpcional(30),
        codigo_postal: codigoPostal,
        localidad: texto(80, 2),
        provincia,
        observaciones: textoOpcional(300),
      },
    },
  },
};

// Código de acceso de una compra sin cuenta: viaja en un header (no en la URL, para que no quede en los registros)
export const codigoDeCompra = (request) => {
  const codigo = request.headers['x-codigo-compra'];
  return typeof codigo === 'string' && /^[0-9a-f]{32}$/.test(codigo) ? codigo : null;
};

export default async function rutasCompras(app) {
  // La compra es del usuario con sesión, o es una compra sin cuenta y vino su código de acceso
  async function compraPropia(request) {
    const compraId = request.params.id;
    if (!(await puedeVerCompra(compraId, request.user?.id, codigoDeCompra(request)))) {
      throw new ErrorApi(404, 'No encontramos esa compra.');
    }
    return obtenerCompra(compraId);
  }

  // Con sesión, la compra queda en "Mis compras"; sin sesión (invitado) se devuelve el código de acceso
  app.post('/compras', { onRequest: app.autenticarOpcional, schema: { body: esquemaCompra } }, async (request, reply) => {
    const { id: compraId, codigoAcceso } = await crearCompra(request.user?.id ?? null, request.body);
    const compra = await obtenerCompra(compraId);
    let pago = null;
    let errorPago = null;
    try {
      pago = await iniciarPago(app.mp, compra);
    } catch (error) {
      // La compra queda creada y pendiente: se puede reintentar el pago desde "Mis compras".
      request.log.warn({ err: error }, `No se pudo crear la preferencia de la compra ${compraId}`);
      errorPago = error.message;
    }
    return reply.status(201).send({
      compra_id: compraId, compra, pago, error_pago: errorPago, ...(codigoAcceso ? { codigo_acceso: codigoAcceso } : {}),
    });
  });

  app.get('/compras', { onRequest: app.autenticar }, async (request) => listarCompras(request.user.id));

  // Seguir una compra hecha sin cuenta: número de compra + email del comprador
  app.post('/compras/buscar', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['compra_id', 'email'],
        properties: { compra_id: id, email },
      },
    },
  }, async (request) => buscarCompraInvitado(request.body.compra_id, request.body.email));

  app.get('/compras/:id', { onRequest: app.autenticarOpcional, schema: { params: paramsId } }, compraPropia);

  // Reintentar el pago de una compra pendiente o rechazada.
  app.post('/compras/:id/pagar', { onRequest: app.autenticarOpcional, schema: { params: paramsId } }, async (request) => {
    const compra = await compraPropia(request);
    return iniciarPago(app.mp, compra);
  });

  // Consulta a Mercado Pago los pagos de la compra (por external_reference) y actualiza el estado.
  // Sirve si el comprador no volvió a la tienda después de pagar y el webhook no está configurado.
  app.post('/compras/:id/verificar-pago', { onRequest: app.autenticarOpcional, schema: { params: paramsId } }, async (request) => {
    const compra = await compraPropia(request);
    const pagos = await app.mp.buscarPagos(compra.id);
    // Del más viejo al más nuevo, para que el último estado sea el que queda.
    for (const pago of [...pagos].reverse()) await procesarPago(pago, request.log);
    return { pagos_encontrados: pagos.length, compra: await obtenerCompra(compra.id) };
  });
}

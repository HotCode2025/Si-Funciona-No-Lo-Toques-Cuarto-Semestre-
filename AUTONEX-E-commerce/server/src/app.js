import fs from 'node:fs';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { config, mercadoPagoConfigurado } from './config.js';
import { manejadorErrores } from './errores.js';
import autenticacion from './plugins/auth.js';
import { mercadoPagoReal } from './services/mercadopago.js';
import { proveedorMail } from './services/mail.js';
import rutasVehiculos from './routes/vehiculos.js';
import rutasCatalogo from './routes/catalogo.js';
import rutasVendedores from './routes/vendedores.js';
import rutasAuth from './routes/auth.js';
import rutasCarrito from './routes/carrito.js';
import rutasEnvios from './routes/envios.js';
import rutasCompras from './routes/compras.js';
import rutasPagos from './routes/pagos.js';
import rutasPanelVendedor from './routes/panel-vendedor.js';
import rutasReferencias from './routes/referencias.js';
import rutasIdentificacion from './routes/identificacion.js';
import rutasAdmin from './routes/admin.js';
import rutasArrepentimientos from './routes/arrepentimientos.js';
import rutasArchivos from './routes/archivos.js';

/**
 * Recorta los espacios de todos los textos del body (también dentro de objetos y listas) y descarta los
 * campos que quedan vacíos: así un campo obligatorio vacío da "Falta completar el campo..." y uno opcional
 * vacío simplemente no se envía.
 */
function recortarTextos(valor) {
  if (typeof valor === 'string') return valor.trim();
  if (Array.isArray(valor)) return valor.map(recortarTextos);
  if (valor && typeof valor === 'object') {
    for (const clave of Object.keys(valor)) {
      const limpio = recortarTextos(valor[clave]);
      if (limpio === '' || limpio === null) delete valor[clave];
      else valor[clave] = limpio;
    }
  }
  return valor;
}

/**
 * Construye la app de Fastify.
 * @param {object} opciones
 * @param {object|boolean} [opciones.logger]
 * @param {object} [opciones.mercadoPago] implementación alternativa del cliente de Mercado Pago (tests)
 */
export async function construirApp({ logger = true, mercadoPago } = {}) {
  const app = Fastify({
    logger,
    trustProxy: true,
    ajv: { customOptions: { allErrors: true } },
  });

  app.decorate('mp', mercadoPago || mercadoPagoReal);
  app.setErrorHandler(manejadorErrores);
  app.addHook('preValidation', async (request) => {
    if (request.body && typeof request.body === 'object') recortarTextos(request.body);
  });

  await app.register(cors, { origin: true });
  await app.register(autenticacion);

  const base = config.basePath;
  const prefijoApi = `${base}/api`;

  await app.register(async (api) => {
    api.get('/salud', async () => ({
      ok: true,
      app: 'AUTONEX',
      mercado_pago_configurado: mercadoPagoConfigurado() || Boolean(mercadoPago),
      mails: proveedorMail() || 'sin configurar',
    }));
    await api.register(rutasVehiculos);
    await api.register(rutasCatalogo);
    await api.register(rutasVendedores);
    await api.register(rutasAuth);
    await api.register(rutasCarrito);
    await api.register(rutasEnvios);
    await api.register(rutasCompras);
    await api.register(rutasPagos);
    await api.register(rutasPanelVendedor);
    await api.register(rutasReferencias);
    await api.register(rutasIdentificacion);
    await api.register(rutasAdmin);
    await api.register(rutasArrepentimientos);
    await api.register(rutasArchivos);
  }, { prefix: prefijoApi });

  const hayFrontend = config.servirFrontend && fs.existsSync(config.clienteDist);
  if (hayFrontend) {
    await app.register(fastifyStatic, {
      root: config.clienteDist,
      prefix: `${base}/`,
      wildcard: false,
      // index.html sin caché (cambia en cada build); los assets con hash se cachean.
      setHeaders(res, ruta) {
        if (ruta.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
      },
    });
    if (base) app.get(base, (request, reply) => reply.redirect(`${base}/`));
  }

  app.setNotFoundHandler((request, reply) => {
    const url = request.url.split('?')[0];
    if (url.startsWith(prefijoApi) || !hayFrontend || request.method !== 'GET') {
      return reply.status(404).send({ error: 'no_encontrado', mensaje: `No existe la ruta ${request.method} ${url}.` });
    }
    // SPA: cualquier otra ruta del frontend devuelve index.html y la resuelve React Router.
    if (base && !url.startsWith(`${base}/`)) {
      return reply.status(404).send({ error: 'no_encontrado', mensaje: `No existe la ruta ${url}.` });
    }
    return reply.header('Cache-Control', 'no-cache').sendFile('index.html');
  });

  return app;
}

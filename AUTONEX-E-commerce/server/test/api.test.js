// Tests de punta a punta de la API de AUTONEX (node:test + fastify.inject).
//   npm test            (crea y usa la base autonex_test; no toca la base principal)
//
// Mercado Pago se reemplaza por un cliente simulado: así se prueba la preferencia, la confirmación del pago,
// el descuento de stock y el webhook sin credenciales ni conexión.

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CLAVE_DEMO_TESTS, crearMercadoPagoFalso, firmarWebhook, prepararEntorno } from './ayudante.js';

let app;
let pool;
let mp;
let bandejaDePrueba; // mails que se habrían enviado (sin RESEND_API_KEY no salen)
const tokens = {};

/** Último mail enviado a esa dirección con ese asunto, y el token de su link. */
function ultimoMail(para, asunto) {
  const mail = bandejaDePrueba().filter((m) => m.para === para && m.asunto.includes(asunto)).at(-1);
  return { mail, token: mail?.texto.match(/token=([0-9a-f]{64})/)?.[1] };
}

async function pedir(method, url, { body, token, headers } = {}) {
  const res = await app.inject({
    method, url, payload: body,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
  });
  return { status: res.statusCode, datos: res.json() };
}

async function login(email) {
  const { status, datos } = await pedir('POST', '/api/auth/login', { body: { email, password: CLAVE_DEMO_TESTS } });
  assert.equal(status, 200);
  return datos.token;
}

/** Sube archivos al campo "fotos" de una publicación (multipart/form-data armado a mano). */
async function subirFotos(publicacionId, archivos, token) {
  const limite = `----autonex${Date.now()}`;
  const partes = [];
  for (const { nombre, tipo, datos } of archivos) {
    partes.push(Buffer.from(`--${limite}\r\nContent-Disposition: form-data; name="fotos"; filename="${nombre}"\r\nContent-Type: ${tipo}\r\n\r\n`), datos, Buffer.from('\r\n'));
  }
  partes.push(Buffer.from(`--${limite}--\r\n`));
  const res = await app.inject({
    method: 'POST', url: `/api/vendedor/publicaciones/${publicacionId}/fotos`, payload: Buffer.concat(partes),
    headers: { 'content-type': `multipart/form-data; boundary=${limite}`, authorization: `Bearer ${token}` },
  });
  return { status: res.statusCode, datos: res.json() };
}

/** Sube una sola imagen (logo o foto de perfil) por multipart. */
async function subirImagen(method, url, campo, { nombre, tipo, datos }, token) {
  const limite = `----autonex${Date.now()}`;
  const payload = Buffer.concat([
    Buffer.from(`--${limite}\r\nContent-Disposition: form-data; name="${campo}"; filename="${nombre}"\r\nContent-Type: ${tipo}\r\n\r\n`),
    datos, Buffer.from(`\r\n--${limite}--\r\n`),
  ]);
  const res = await app.inject({
    method, url, payload,
    headers: { 'content-type': `multipart/form-data; boundary=${limite}`, ...(token ? { authorization: `Bearer ${token}` } : {}) },
  });
  return { status: res.statusCode, datos: res.json() };
}

async function imagenDePrueba(ancho, alto, formato = 'png') {
  const sharp = (await import('sharp')).default;
  return sharp({ create: { width: ancho, height: alto, channels: 3, background: { r: 220, g: 90, b: 20 } } })[formato]().toBuffer();
}

const verArchivo = (url) => app.inject({ method: 'GET', url: `/${url}` });

async function hojaDeCategoria(slug = 'pastillas-de-freno') {
  return (await pool.query('SELECT id FROM categorias WHERE slug = $1', [slug])).rows[0].id;
}

async function stockDe(publicacionId) {
  return (await pool.query('SELECT stock FROM publicaciones WHERE id = $1', [publicacionId])).rows[0].stock;
}

/** Busca un producto de Gol Trend con ofertas de Frenos del Norte (Tucumán) y Repuestos del Centro (Córdoba). */
async function ofertasParaCompra() {
  const { rows } = await pool.query(`
    SELECT pu.id, pu.precio, pu.stock, ve.id AS vendedor_id, ve.slug
      FROM publicaciones pu JOIN vendedores ve ON ve.id = pu.vendedor_id
     WHERE pu.estado = 'activa' AND pu.stock >= 3 AND pu.condicion = 'nuevo'
       AND ve.slug IN ('frenos-embragues-del-norte', 'repuestos-del-centro')
     ORDER BY pu.id`);
  const norte = rows.find((r) => r.slug === 'frenos-embragues-del-norte');
  const centro = rows.find((r) => r.slug === 'repuestos-del-centro');
  return { norte, centro };
}

const HORARIOS_LOCAL = [
  ...Array.from({ length: 5 }, () => ({ abierto: true, turnos: [{ desde: '16:30', hasta: '20:00' }, { desde: '08:30', hasta: '13:00' }] })),
  { abierto: true, turnos: [{ desde: '09:00', hasta: '13:00' }] },
  { abierto: false, turnos: [{ desde: '10:00', hasta: '12:00' }] },
];

const COMPRADOR = { nombre: 'Martina', apellido: 'López', email: 'comprador@autonex.com.ar', telefono: '11 5555-0101', dni: '30123456' };
const DIRECCION_CABA = { calle: 'Av. Corrientes', numero: '3247', codigo_postal: 'C1193', localidad: 'CABA', provincia: 'Ciudad Autónoma de Buenos Aires' };

before(async () => {
  await prepararEntorno();
  const { construirApp } = await import('../src/app.js');
  ({ pool } = await import('../src/db.js'));
  ({ bandejaDePrueba } = await import('../src/services/mail.js'));
  mp = crearMercadoPagoFalso();
  app = await construirApp({ logger: false, mercadoPago: mp });
  await app.ready();
  tokens.comprador = await login('comprador@autonex.com.ar');
  tokens.vendedor = await login('vendedor@autonex.com.ar');
  tokens.norte = await login('frenos-embragues-del-norte@autonex.com.ar');
});

after(async () => {
  await app?.close();
  await pool?.end();
});

describe('Catálogo y vehículos', () => {
  it('el selector arma marca → modelo → año → versión con datos reales del DNRPA', async () => {
    const marcas = (await pedir('GET', '/api/vehiculos/marcas')).datos;
    assert.ok(marcas.length >= 8);
    const vw = marcas.find((m) => m.nombre === 'Volkswagen');
    const gol = (await pedir('GET', `/api/vehiculos/marcas/${vw.id}/modelos`)).datos.find((m) => m.nombre === 'Gol Trend');
    const anios = (await pedir('GET', `/api/vehiculos/modelos/${gol.id}/anios`)).datos;
    assert.ok(anios.length > 3);
    const versiones = (await pedir('GET', `/api/vehiculos/modelos/${gol.id}/versiones?anio=${anios[0]}`)).datos;
    assert.ok(versiones.length > 0);
    const ficha = (await pedir('GET', `/api/vehiculos/${versiones[0].id}`)).datos;
    assert.equal(ficha.estado_verificacion, 'VERIFIED');
    assert.equal(ficha.fuente.slug, 'dnrpa');
  });

  it('busca vehículos por texto y lista tipos y referencias desde la base', async () => {
    const { anio, resultados } = (await pedir('GET', '/api/vehiculos/buscar?q=hilux%202015')).datos;
    assert.equal(anio, 2015);
    assert.equal(resultados[0].modelo, 'Hilux');
    const ref = (await pedir('GET', '/api/referencias')).datos;
    assert.equal(ref.provincias.length, 24);
    assert.ok(ref.transportistas.some((t) => t.valor === 'andreani'));
    assert.ok(ref.estados_verificacion.some((e) => e.valor === 'NEEDS_REVIEW'));
    assert.ok(ref.tipos_vehiculo.some((t) => t.valor === 'camion'));
  });

  it('con un vehículo elegido solo muestra repuestos compatibles o universales', async () => {
    const { rows: [hilux] } = await pool.query(`
      SELECT v.id FROM vehiculos v JOIN modelos_vehiculo m ON m.id = v.modelo_id
        JOIN compatibilidades co ON co.vehiculo_id = v.id
       WHERE m.nombre = 'Hilux' GROUP BY v.id ORDER BY count(*) DESC LIMIT 1`);
    const { datos } = await pedir('GET', `/api/productos?vehiculo=${hilux.id}&por_pagina=60`);
    assert.ok(datos.total > 10);
    const ids = datos.productos.filter((p) => !p.universal).map((p) => p.id);
    const { rows } = await pool.query(
      'SELECT count(DISTINCT producto_id) AS n FROM compatibilidades WHERE vehiculo_id = $1 AND producto_id = ANY($2::int[])',
      [hilux.id, ids]);
    assert.equal(rows[0].n, ids.length, 'todo producto no universal debe ser compatible con la Hilux');
    const soloVerificados = (await pedir('GET', `/api/productos?vehiculo=${hilux.id}&solo_verificados=true&por_pagina=60`)).datos;
    assert.ok(soloVerificados.productos.every((p) => p.universal), 'los repuestos de demostración no tienen compatibilidades verificadas');
    assert.ok(soloVerificados.productos.length > 0, 'los repuestos universales de autos siguen apareciendo para un auto');
  });

  it('un código de pieza no se lee como vehículo y, si el vehículo detectado no tiene nada, se busca el texto', async () => {
    const { rows: [p] } = await pool.query(`SELECT p.numero_pieza, p.nombre FROM productos p
      JOIN publicaciones pu ON pu.producto_id = p.id AND pu.estado = 'activa' AND pu.stock > 0 LIMIT 1`);
    const porCodigo = (await pedir('GET', `/api/productos?q=${encodeURIComponent(p.numero_pieza)}`)).datos;
    assert.equal(porCodigo.vehiculo_detectado, null);
    assert.equal(porCodigo.productos[0]?.numero_pieza, p.numero_pieza);
    // "filtro de aceite gol": el Gol (otro modelo que el Gol Trend) no tiene filtros cargados → resultados del texto + aviso
    const admin = await login('admin@autonex.com.ar');
    const alta = await pedir('POST', '/api/admin/importaciones/api', {
      token: admin,
      body: {
        entidad: 'vehiculos', fuente: 'autonex', duplicados: 'crear',
        filas: [{ marca: 'Volkswagen', modelo: 'Gol', version: 'Gol 1.6 (prueba)', anio_desde: 2005, anio_hasta: 2012 }],
      },
    });
    assert.equal(alta.datos.error, 0, JSON.stringify(alta.datos.primeros_errores));
    const gol = (await pedir('GET', '/api/productos?q=filtro%20de%20aceite%20gol')).datos;
    assert.ok(gol.total > 0, 'muestra los resultados del texto');
    assert.equal(gol.vehiculo_detectado, null);
    assert.equal(gol.vehiculo_sin_resultados?.modelo, 'Gol');
  });

  it('"pastillas hilux" detecta el vehículo en el texto', async () => {
    const { datos } = await pedir('GET', '/api/productos?q=pastillas%20hilux');
    assert.equal(datos.vehiculo_detectado?.modelo, 'Hilux');
    assert.ok(datos.total > 0);
  });

  it('busca por nombre sin tildes y por número de pieza o SKU en cualquier formato', async () => {
    const porNombre = (await pedir('GET', '/api/productos?q=bujias%20ngk')).datos;
    assert.ok(porNombre.total > 0);
    assert.ok(porNombre.productos.every((p) => p.marca === 'NGK'));
    const { numero_pieza: numero, sku } = porNombre.productos[0];
    const porCodigo = (await pedir('GET', `/api/productos?q=${encodeURIComponent(numero.replace(/-/g, '').toLowerCase())}`)).datos;
    assert.equal(porCodigo.productos[0].numero_pieza, numero);
    const porSku = (await pedir('GET', `/api/buscar/codigo?q=${sku}`)).datos;
    assert.equal(porSku.resultados[0].sku, sku);
  });

  it('filtra por condición, provincia y rango de precio y ordena por precio', async () => {
    const usados = (await pedir('GET', '/api/productos?condicion=usado&por_pagina=60')).datos;
    assert.ok(usados.total > 0);
    assert.deepEqual(usados.facetas.provincias.map((p) => p.provincia), ['Entre Ríos']);
    const rango = (await pedir('GET', '/api/productos?precio_min=20000&precio_max=40000&orden=precio_asc&por_pagina=60')).datos;
    const precios = rango.productos.map((p) => p.precio_desde);
    assert.ok(precios.every((p) => p >= 20000 && p <= 40000));
    assert.deepEqual(precios, [...precios].sort((a, b) => a - b));
    const invalido = await pedir('GET', '/api/productos?precio_min=50&precio_max=10');
    assert.equal(invalido.status, 400);
  });

  it('la ficha compara ofertas y nunca muestra como confirmada una compatibilidad sin verificar', async () => {
    const { rows: [p] } = await pool.query(`
      SELECT co.producto_id, co.vehiculo_id FROM compatibilidades co
        JOIN publicaciones pu ON pu.producto_id = co.producto_id GROUP BY 1, 2 HAVING count(*) > 1 LIMIT 1`);
    const ficha = (await pedir('GET', `/api/productos/${p.producto_id}?vehiculo=${p.vehiculo_id}`)).datos;
    assert.equal(ficha.compatibilidad.estado, 'sin_verificar');
    assert.equal(ficha.compatibilidad.confirmada, false);
    assert.equal(ficha.compatibilidad.verificacion, 'NEEDS_REVIEW');
    assert.equal(ficha.producto.fuente.tipo, 'demo');
    assert.match(ficha.producto.sku, /^[A-Z]{3}-\d{6}$/);
    assert.ok(ficha.ofertas.length > 1);
    assert.ok(ficha.ofertas[0].vendedor.ciudad && ficha.ofertas[0].condicion);
    const { rows: [otro] } = await pool.query(
      'SELECT id FROM vehiculos WHERE id NOT IN (SELECT vehiculo_id FROM compatibilidades WHERE producto_id = $1) LIMIT 1', [p.producto_id]);
    const no = (await pedir('GET', `/api/productos/${p.producto_id}?vehiculo=${otro.id}`)).datos;
    assert.equal(no.compatibilidad.estado, 'no_compatible');
  });

  it('patente y VIN: valida el formato y responde que todavía no hay proveedor autorizado', async () => {
    const patente = await pedir('GET', '/api/identificar/patente/AB123CD');
    assert.equal(patente.status, 501);
    assert.equal(patente.datos.disponible, false);
    assert.equal((await pedir('GET', '/api/identificar/patente/123')).status, 400);
    const vin = await pedir('GET', '/api/identificar/vin/9BWZZZ377VT004251');
    assert.equal(vin.status, 501);
    assert.equal(vin.datos.wmi.wmi, '9BW');
    assert.equal((await pedir('GET', '/api/identificar/vin/IOQ45678901234567')).status, 400);
  });
});

describe('Registro, sesión y validaciones', () => {
  it('valida con mensajes en español', async () => {
    const { status, datos } = await pedir('POST', '/api/auth/registro', { body: { email: 'malo', password: '123', nombre: 'A', rol: 'comprador' } });
    assert.equal(status, 400);
    assert.ok(datos.detalles.some((d) => d.includes('Falta completar el campo "apellido"')));
    assert.ok(datos.detalles.some((d) => d.includes('email no tiene un formato válido')));
  });

  it('registra un comprador, rechaza el email repetido y protege Mis compras', async () => {
    const cuerpo = { email: 'nuevo@test.com', password: 'Clave1234', nombre: 'Nuevo', apellido: 'Comprador', rol: 'comprador' };
    assert.equal((await pedir('POST', '/api/auth/registro', { body: cuerpo })).status, 201);
    assert.equal((await pedir('POST', '/api/auth/registro', { body: cuerpo })).status, 409);
    const sinSesion = await pedir('GET', '/api/compras');
    assert.equal(sinSesion.status, 401);
    assert.match(sinSesion.datos.mensaje, /iniciar sesión/);
  });

  it('rechaza un token que ya no corresponde a la cuenta (por ejemplo, después de recrear la base)', async () => {
    const { rows: [admin] } = await pool.query("SELECT id FROM usuarios WHERE email = 'admin@autonex.com.ar'");
    const viejo = app.jwt.sign({ id: admin.id, rol: 'comprador', vendedor_id: null });
    const r = await pedir('GET', '/api/compras', { token: viejo });
    assert.equal(r.status, 401);
    assert.match(r.datos.mensaje, /ya no es válida/);
  });

  it('registra un vendedor con su local', async () => {
    const { status, datos } = await pedir('POST', '/api/auth/registro', {
      body: {
        email: 'local@test.com', password: 'Clave1234', nombre: 'Ana', apellido: 'Gómez', rol: 'vendedor',
        vendedor: { nombre_comercial: 'Repuestos Test', direccion: 'San Martín 100', ciudad: 'Salta', provincia: 'Salta', telefono: '387 555-0000', horarios: HORARIOS_LOCAL },
      },
    });
    assert.equal(status, 201);
    assert.equal(datos.requiere_confirmacion, true, 'la cuenta queda pendiente hasta confirmar el email');
    assert.equal(datos.token, undefined, 'no inicia la sesión');
    const { rows: [local] } = await pool.query(
      "SELECT ve.slug FROM vendedores ve JOIN usuarios us ON us.id = ve.usuario_id WHERE us.email = 'local@test.com'");
    assert.equal(local.slug, 'repuestos-test');
    // Sin confirmar, el local no se publica y la cuenta no puede ingresar
    assert.ok(!(await pedir('GET', '/api/vendedores')).datos.some((v) => v.slug === 'repuestos-test'));
    assert.equal((await pedir('GET', '/api/vendedores/repuestos-test')).status, 404);
    const login = await pedir('POST', '/api/auth/login', { body: { email: 'local@test.com', password: 'Clave1234' } });
    assert.equal(login.status, 403);
    assert.equal(login.datos.motivo, 'email_sin_confirmar');
    // Al confirmar, la cuenta se activa, inicia la sesión y el local aparece
    const { token } = ultimoMail('local@test.com', 'Confirmá tu email');
    const confirmado = await pedir('POST', '/api/auth/verificar-email', { body: { token } });
    assert.equal(confirmado.datos.usuario.vendedor.slug, 'repuestos-test');
    assert.ok(confirmado.datos.token);
    assert.ok((await pedir('GET', '/api/vendedores')).datos.some((v) => v.slug === 'repuestos-test'));
    assert.equal((await pedir('POST', '/api/auth/login', { body: { email: 'local@test.com', password: 'Clave1234' } })).status, 200);
    const publico = (await pedir('GET', '/api/vendedores/repuestos-test')).datos;
    assert.equal(publico.horario, 'Lunes a viernes de 8:30 a 13 y de 16:30 a 20. Sábados de 9 a 13.', 'el texto se arma con los turnos ordenados');
    assert.deepEqual(publico.horarios[6], { abierto: false, turnos: [] }, 'un día cerrado queda sin turnos');
  });

  it('el local carga su horario por día: se valida y se arma el texto que ven los compradores', async () => {
    const { datos: sesion } = await pedir('POST', '/api/auth/login', { body: { email: 'local@test.com', password: 'Clave1234' } });
    const guardar = (body) => pedir('PUT', '/api/vendedor/perfil', { token: sesion.token, body });
    const dia = (turnos) => ({ abierto: true, turnos });
    const cerrado = { abierto: false };
    const alReves = await guardar({ horarios: [dia([{ desde: '18:00', hasta: '09:00' }]), ...Array(6).fill(cerrado)] });
    assert.equal(alReves.status, 400);
    assert.match(alReves.datos.mensaje, /lunes.*anterior al de cierre/);
    const superpuestos = await guardar({ horarios: [dia([{ desde: '08:00', hasta: '13:00' }, { desde: '12:00', hasta: '18:00' }]), ...Array(6).fill(cerrado)] });
    assert.match(superpuestos.datos.mensaje, /se superponen/);
    assert.equal((await guardar({ horarios: Array(7).fill(cerrado) })).status, 400, 'tiene que abrir algún día');
    assert.equal((await guardar({ horarios: [dia([{ desde: '8:00', hasta: '13:00' }]), ...Array(6).fill(cerrado)] })).status, 400, 'horas con formato HH:MM');
    assert.equal((await guardar({ horarios: Array(6).fill(cerrado) })).status, 400, 'son los 7 días');

    const corrido = [dia([{ desde: '08:00', hasta: '18:00' }]), dia([{ desde: '08:00', hasta: '18:00' }]), cerrado,
      dia([{ desde: '08:00', hasta: '18:00' }]), dia([{ desde: '08:00', hasta: '18:00' }]), dia([{ desde: '09:00', hasta: '13:00' }]), dia([{ desde: '09:00', hasta: '13:00' }])];
    const ok = await guardar({ horarios: corrido });
    assert.equal(ok.status, 200);
    assert.equal(ok.datos.horario, 'Lunes, martes, jueves y viernes de 8 a 18 corrido. Sábados y domingos de 9 a 13.');
    assert.equal((await pedir('GET', '/api/vendedor/perfil', { token: sesion.token })).datos.horarios[2].abierto, false);
    // Con el texto de antes (versión anterior de la API) también se completa el horario por día
    const texto = await guardar({ horario: 'Lunes a viernes de 9 a 18. Sábados de 9 a 12:30.' });
    assert.equal(texto.datos.horarios[5].turnos[0].hasta, '12:30');
    assert.equal((await guardar({ horarios: HORARIOS_LOCAL })).status, 200);
  });

  it('manda el mail de confirmación y el link activa la cuenta una sola vez', async () => {
    const { datos } = await pedir('POST', '/api/auth/registro', {
      body: { email: 'Confirmar@Test.com', password: 'Clave1234', nombre: 'Lucía', apellido: 'Pérez', rol: 'comprador' },
    });
    assert.equal(datos.email, 'confirmar@test.com');
    const { mail, token } = ultimoMail('confirmar@test.com', 'Confirmá tu email');
    assert.ok(mail, 'se mandó el mail de confirmación');
    assert.match(mail.html, /Lucía/);
    assert.ok(token);
    // Pedir otro link sin sesión: misma respuesta exista o no la cuenta
    const reenvio = await pedir('POST', '/api/auth/reenviar-verificacion', { body: { email: 'confirmar@test.com' } });
    const reenvioAjeno = await pedir('POST', '/api/auth/reenviar-verificacion', { body: { email: 'nadie@test.com' } });
    assert.equal(reenvio.status, 200);
    assert.equal(reenvio.datos.mensaje, reenvioAjeno.datos.mensaje);
    const ok = await pedir('POST', '/api/auth/verificar-email', { body: { token } });
    assert.equal(ok.status, 200);
    assert.equal((await pedir('GET', '/api/auth/yo', { token: ok.datos.token })).datos.email_verificado, true);
    assert.equal((await pedir('POST', '/api/auth/verificar-email', { body: { token } })).status, 400, 'el link es de un solo uso');
    const conSesion = await pedir('POST', '/api/auth/reenviar-verificacion', { token: ok.datos.token });
    assert.equal(conSesion.datos.ya_verificado, true);
  });

  it('recupera la contraseña con un link de un solo uso, sin revelar qué emails tienen cuenta', async () => {
    const inexistente = await pedir('POST', '/api/auth/recuperar', { body: { email: 'nadie@test.com' } });
    const existente = await pedir('POST', '/api/auth/recuperar', { body: { email: 'NUEVO@test.com' } });
    assert.equal(inexistente.status, 200);
    assert.equal(inexistente.datos.mensaje, existente.datos.mensaje, 'misma respuesta exista o no la cuenta');
    assert.ok(!ultimoMail('nadie@test.com', 'contraseña').mail);
    const { token } = ultimoMail('nuevo@test.com', 'Restablecé tu contraseña');
    assert.ok(token);
    assert.equal((await pedir('POST', '/api/auth/restablecer', { body: { token, password: 'corta' } })).status, 400);
    const cambio = await pedir('POST', '/api/auth/restablecer', { body: { token, password: 'NuevaClave99' } });
    assert.equal(cambio.status, 200);
    assert.ok(cambio.datos.token, 'queda con la sesión iniciada');
    assert.equal((await pedir('POST', '/api/auth/login', { body: { email: 'nuevo@test.com', password: 'Clave1234' } })).status, 401);
    assert.equal((await pedir('POST', '/api/auth/login', { body: { email: 'nuevo@test.com', password: 'NuevaClave99' } })).status, 200);
    assert.equal((await pedir('POST', '/api/auth/restablecer', { body: { token, password: 'OtraClave77' } })).status, 400, 'un solo uso');
  });

  it('foto de perfil: se recorta cuadrada, es privada (solo con su clave en el link) y se puede cambiar o quitar', async () => {
    const sharp = (await import('sharp')).default;
    const foto = { nombre: 'yo.jpg', tipo: 'image/jpeg', datos: await imagenDePrueba(640, 400, 'jpeg') };
    const subida = await subirImagen('PUT', '/api/auth/yo/avatar', 'avatar', foto, tokens.comprador);
    assert.equal(subida.status, 200);
    assert.match(subida.datos.avatar, /^api\/archivos\/\d+\?k=[0-9a-f]{32}$/);
    const conClave = await verArchivo(subida.datos.avatar);
    assert.equal(conClave.statusCode, 200);
    assert.match(conClave.headers['cache-control'], /^private/);
    const meta = await sharp(conClave.rawPayload).metadata();
    assert.deepEqual([meta.width, meta.height], [400, 400], 'cuadrada de 400 px');
    const [ruta] = subida.datos.avatar.split('?');
    assert.equal((await verArchivo(ruta)).statusCode, 404, 'sin la clave no se ve');
    assert.equal((await verArchivo(`${ruta}?k=${'0'.repeat(32)}`)).statusCode, 404);
    assert.equal((await pedir('GET', '/api/auth/yo', { token: tokens.comprador })).datos.avatar, subida.datos.avatar);

    const otra = await subirImagen('PUT', '/api/auth/yo/avatar', 'avatar', foto, tokens.comprador);
    assert.equal((await verArchivo(subida.datos.avatar)).statusCode, 404, 'al cambiarla se borra la anterior');
    assert.equal((await subirImagen('PUT', '/api/auth/yo/avatar', 'avatar', { nombre: 'nota.png', tipo: 'image/png', datos: Buffer.from('hola') }, tokens.comprador)).status, 400);
    assert.equal((await subirImagen('PUT', '/api/auth/yo/avatar', 'avatar', foto)).status, 401, 'hace falta la sesión');
    const quitada = await pedir('DELETE', '/api/auth/yo/avatar', { token: tokens.comprador });
    assert.equal(quitada.datos.avatar, null);
    assert.equal((await verArchivo(otra.datos.avatar)).statusCode, 404);
    assert.equal((await pedir('DELETE', '/api/auth/yo/avatar', { token: tokens.comprador })).status, 404);
  });

  it('un comprador elimina su cuenta: pide la contraseña, cancela lo que no pagó y la sesión deja de valer', async () => {
    const email = 'borrar@test.com';
    await pedir('POST', '/api/auth/registro', { body: { email, password: 'Clave1234', nombre: 'Bruno', apellido: 'Borrar', rol: 'comprador', dni: '28123456' } });
    const { datos: sesion } = await pedir('POST', '/api/auth/verificar-email', { body: { token: ultimoMail(email, 'Confirmá tu email').token } });
    const conFoto = await subirImagen('PUT', '/api/auth/yo/avatar', 'avatar', { nombre: 'yo.png', tipo: 'image/png', datos: await imagenDePrueba(200, 200) }, sesion.token);
    assert.equal(conFoto.status, 200);
    const { norte } = await ofertasParaCompra();
    const { datos: sinPagar } = await pedir('POST', '/api/compras', {
      token: sesion.token,
      body: { comprador: { ...COMPRADOR, email }, items: [{ publicacion_id: norte.id, cantidad: 1 }], entregas: [{ vendedor_id: norte.vendedor_id, metodo: 'retiro' }] },
    });
    const eliminar = (body, token = sesion.token) => pedir('POST', '/api/auth/eliminar-cuenta', { token, body });
    assert.equal((await eliminar({ password: 'Clave1234', confirmacion: 'borrar' })).status, 400, 'hay que escribir ELIMINAR');
    assert.equal((await eliminar({ password: 'otra', confirmacion: 'ELIMINAR' })).status, 400, 'contraseña incorrecta');
    const ok = await eliminar({ password: 'Clave1234', confirmacion: 'eliminar' });
    assert.equal(ok.status, 200);
    assert.ok(ultimoMail(email, 'Eliminamos tu cuenta').mail, 'avisa por mail');
    assert.equal((await pedir('GET', '/api/auth/yo', { token: sesion.token })).status, 401, 'la sesión deja de valer');
    assert.equal((await pedir('POST', '/api/auth/login', { body: { email, password: 'Clave1234' } })).status, 401);
    const { rows: [usuario] } = await pool.query('SELECT email, nombre, dni, eliminado_en FROM usuarios WHERE id = $1', [sesion.usuario.id]);
    assert.match(usuario.email, /@cuenta-eliminada\.invalid$/);
    assert.equal(usuario.dni, null);
    assert.ok(usuario.eliminado_en);
    const fotoId = Number(conFoto.datos.avatar.match(/archivos\/(\d+)/)[1]);
    assert.equal((await pool.query('SELECT 1 FROM archivos WHERE id = $1', [fotoId])).rowCount, 0, 'la foto de perfil se borra');
    const { rows: [compraCancelada] } = await pool.query('SELECT estado FROM compras WHERE id = $1', [sinPagar.compra_id]);
    assert.equal(compraCancelada.estado, 'cancelada', 'la compra sin pagar se cancela y se conserva');
    assert.equal((await pedir('POST', '/api/auth/registro', { body: { email, password: 'Clave1234', nombre: 'Bruno', apellido: 'Nuevo', rol: 'comprador' } })).status, 201,
      'el email queda libre para una cuenta nueva');
  });

  it('un vendedor elimina su cuenta: el local y sus publicaciones dejan de mostrarse', async () => {
    const { datos: sesion } = await pedir('POST', '/api/auth/login', { body: { email: 'local@test.com', password: 'Clave1234' } });
    const publicada = await pedir('POST', '/api/vendedor/productos', {
      token: sesion.token,
      body: { nombre: 'Juego de pastillas de prueba', marca: 'Marca Test', numero_pieza: 'ELIM-TEST-01', categoria_id: await hojaDeCategoria(), universal: true, precio: 9000, stock: 2, condicion: 'nuevo' },
    });
    assert.equal(publicada.status, 201);
    const ok = await pedir('POST', '/api/auth/eliminar-cuenta', { token: sesion.token, body: { password: 'Clave1234', confirmacion: 'ELIMINAR' } });
    assert.equal(ok.status, 200);
    assert.ok(!(await pedir('GET', '/api/vendedores')).datos.some((v) => v.slug === 'repuestos-test'));
    const { rows: [pub] } = await pool.query('SELECT estado FROM publicaciones WHERE id = $1', [publicada.datos.id]);
    assert.equal(pub.estado, 'pausada');
    const admin = await login('admin@autonex.com.ar');
    assert.equal((await pedir('POST', '/api/auth/eliminar-cuenta', { token: admin, body: { password: CLAVE_DEMO_TESTS, confirmacion: 'ELIMINAR' } })).status, 403,
      'la cuenta de administrador no se elimina desde acá');
  });
});

describe('Compra, Mercado Pago y stock', () => {
  let compra;
  let ofertas;

  it('el backend recalcula precios y envíos ignorando los montos del frontend', async () => {
    ofertas = await ofertasParaCompra();
    const { status, datos } = await pedir('POST', '/api/compras', {
      token: tokens.comprador,
      body: {
        comprador: COMPRADOR,
        items: [
          { publicacion_id: ofertas.norte.id, cantidad: 1, precio: 1 },     // "precio" se descarta
          { publicacion_id: ofertas.centro.id, cantidad: 2 },
        ],
        entregas: [
          { vendedor_id: ofertas.norte.vendedor_id, metodo: 'retiro' },
          { vendedor_id: ofertas.centro.vendedor_id, metodo: 'domicilio', transportista: 'andreani' },
        ],
        direccion: DIRECCION_CABA,
        total: 10,
      },
    });
    assert.equal(status, 201);
    compra = datos.compra;
    const andreaniOtraProvincia = 11500 + 900; // 2 unidades
    const esperado = ofertas.norte.precio + ofertas.centro.precio * 2 + andreaniOtraProvincia;
    assert.equal(compra.total, esperado);
    assert.equal(compra.estado, 'pendiente_pago');
    assert.equal(compra.pedidos.length, 2);
    assert.ok(datos.pago.init_point.startsWith('https://'));
  });

  it('arma la preferencia de Checkout Pro como pide Mercado Pago', () => {
    const pref = mp.preferencias.at(-1);
    assert.equal(pref.external_reference, String(compra.id));
    assert.equal(pref.statement_descriptor, 'AUTONEX');
    assert.equal(pref.auto_return, 'approved');
    assert.deepEqual(Object.keys(pref.back_urls).sort(), ['failure', 'pending', 'success']);
    assert.equal(pref.back_urls.success, 'https://autonex.test/pago/exito');
    assert.equal(pref.notification_url, 'https://autonex.test/api/pagos/webhook?source_news=webhooks');
    const suma = pref.items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
    assert.equal(suma, compra.total, 'productos + envíos = total');
    assert.ok(pref.items.some((i) => i.id.startsWith('envio-') && i.title.includes('Andreani')));
  });

  it('no descuenta stock mientras el pago está pendiente', async () => {
    assert.equal(await stockDe(ofertas.norte.id), ofertas.norte.stock);
  });

  it('valida stock, entregas y transportistas', async () => {
    const base = { comprador: COMPRADOR, entregas: [{ vendedor_id: ofertas.centro.vendedor_id, metodo: 'retiro' }] };
    const sinStock = await pedir('POST', '/api/compras', { token: tokens.comprador, body: { ...base, items: [{ publicacion_id: ofertas.centro.id, cantidad: 999 }] } });
    assert.equal(sinStock.status, 409);
    assert.match(sinStock.datos.mensaje, /Solo quedan/);
    const sinEntrega = await pedir('POST', '/api/compras', { token: tokens.comprador, body: { ...base, entregas: [{ vendedor_id: ofertas.norte.vendedor_id, metodo: 'retiro' }], items: [{ publicacion_id: ofertas.centro.id, cantidad: 1 }] } });
    assert.equal(sinEntrega.status, 400);
    const moto = await pedir('POST', '/api/compras', {
      token: tokens.comprador,
      body: { ...base, items: [{ publicacion_id: ofertas.centro.id, cantidad: 1 }], entregas: [{ vendedor_id: ofertas.centro.vendedor_id, metodo: 'domicilio', transportista: 'moto' }], direccion: DIRECCION_CABA },
    });
    assert.equal(moto.status, 400);
    assert.match(moto.datos.mensaje, /misma ciudad/);
    const propia = await pedir('POST', '/api/compras', {
      token: tokens.vendedor,
      body: { ...base, items: [{ publicacion_id: ofertas.centro.id, cantidad: 1 }] },
    });
    assert.equal(propia.status, 409);
  });

  it('un pago rechazado deja la compra para reintentar', async () => {
    mp.registrarPago({ id: '9001', compraId: compra.id, estado: 'rejected', monto: compra.total, detalle: 'cc_rejected_other_reason' });
    const { status, datos } = await pedir('POST', '/api/pagos/confirmar', { token: tokens.comprador, body: { payment_id: '9001' } });
    assert.equal(status, 200);
    assert.equal(datos.compra.estado, 'pago_rechazado');
    assert.equal(await stockDe(ofertas.norte.id), ofertas.norte.stock);
    const reintento = await pedir('POST', `/api/compras/${compra.id}/pagar`, { token: tokens.comprador });
    assert.equal(reintento.status, 200);
    assert.ok(reintento.datos.init_point);
  });

  it('quien no es dueño de la compra no ve sus datos al volver de Mercado Pago', async () => {
    mp.registrarPago({ id: '9002', compraId: compra.id, estado: 'approved', monto: compra.total });
    const ajeno = await pedir('POST', '/api/pagos/confirmar', { token: tokens.vendedor, body: { payment_id: '9002' } });
    assert.equal(ajeno.status, 200);
    assert.equal(ajeno.datos.compra, null, 'no ve la compra');
    assert.equal(ajeno.datos.compra_id, compra.id);
    assert.equal(ajeno.datos.pago.estado, 'approved');
  });

  it('con el pago aprobado: compra pagada, pedidos pagados y stock descontado (una sola vez)', async () => {
    const r = await pedir('POST', '/api/pagos/confirmar', { token: tokens.comprador, body: { payment_id: '9002' } });
    assert.equal(r.datos.compra.estado, 'pagada');
    assert.ok(r.datos.compra.pedidos.every((p) => p.estado === 'pagado'));
    assert.equal(await stockDe(ofertas.norte.id), ofertas.norte.stock - 1);
    assert.equal(await stockDe(ofertas.centro.id), ofertas.centro.stock - 2);

    // La vuelta repetida y el webhook no vuelven a descontar
    await pedir('POST', '/api/pagos/confirmar', { token: tokens.comprador, body: { payment_id: '9002' } });
    const hook = await pedir('POST', '/api/pagos/webhook?data.id=9002&type=payment', {
      body: { type: 'payment', action: 'payment.updated', data: { id: '9002' } }, headers: firmarWebhook('9002'),
    });
    assert.equal(hook.status, 200);
    assert.equal(await stockDe(ofertas.norte.id), ofertas.norte.stock - 1);
    assert.equal(await stockDe(ofertas.centro.id), ofertas.centro.stock - 2);
  });

  it('con pedidos en curso no se puede eliminar la cuenta (ni la del comprador ni la del vendedor)', async () => {
    const eliminar = (token) => pedir('POST', '/api/auth/eliminar-cuenta', { token, body: { password: CLAVE_DEMO_TESTS, confirmacion: 'ELIMINAR' } });
    const comprador = await eliminar(tokens.comprador);
    assert.equal(comprador.status, 409);
    assert.match(comprador.datos.mensaje, /pedidos en curso/);
    const vendedor = await eliminar(tokens.norte);
    assert.equal(vendedor.status, 409);
    assert.match(vendedor.datos.mensaje, /entregalos/);
  });

  it('manda el comprobante por mail una sola vez, aunque lleguen la vuelta y el webhook', async () => {
    const comprobantes = bandejaDePrueba().filter((m) => m.asunto === `Tu compra #${compra.id} en AUTONEX`);
    assert.equal(comprobantes.length, 1);
    assert.equal(comprobantes[0].para, COMPRADOR.email);
    assert.match(comprobantes[0].html, new RegExp(`#${compra.id}`));
    assert.match(comprobantes[0].texto, /Botón de arrepentimiento/);
  });

  it('el webhook confirma pagos (con firma válida) y rechaza firmas falsas', async () => {
    const { datos: otra } = await pedir('POST', '/api/compras', {
      token: tokens.comprador,
      body: { comprador: COMPRADOR, items: [{ publicacion_id: ofertas.norte.id, cantidad: 1 }], entregas: [{ vendedor_id: ofertas.norte.vendedor_id, metodo: 'retiro' }] },
    });
    mp.registrarPago({ id: '9100', compraId: otra.compra_id, estado: 'approved', monto: otra.compra.total });
    const falso = await pedir('POST', '/api/pagos/webhook?data.id=9100&type=payment', {
      body: { type: 'payment', data: { id: '9100' } }, headers: { 'x-signature': 'ts=1,v1=abc', 'x-request-id': 'x' },
    });
    assert.equal(falso.status, 401);
    const bueno = await pedir('POST', '/api/pagos/webhook?data.id=9100&type=payment', {
      body: { type: 'payment', data: { id: '9100' } }, headers: firmarWebhook('9100'),
    });
    assert.equal(bueno.status, 200);
    assert.equal(bueno.datos.compra_estado, 'pagada');
    // "Simular notificación" del panel de Mercado Pago: un pago que no existe se ignora con 200 (no se reintenta)
    const prueba = await pedir('POST', '/api/pagos/webhook?data.id=123456&type=payment', {
      body: { type: 'payment', data: { id: '123456' } }, headers: firmarWebhook('123456'),
    });
    assert.equal(prueba.status, 200);
    assert.equal(prueba.datos.ignorado, 'pago inexistente');
  });

  it('no confirma una compra si el monto pagado no cubre el total', async () => {
    const { datos: otra } = await pedir('POST', '/api/compras', {
      token: tokens.comprador,
      body: { comprador: COMPRADOR, items: [{ publicacion_id: ofertas.centro.id, cantidad: 1 }], entregas: [{ vendedor_id: ofertas.centro.vendedor_id, metodo: 'retiro' }] },
    });
    mp.registrarPago({ id: '9200', compraId: otra.compra_id, estado: 'approved', monto: 1 });
    const r = await pedir('POST', '/api/pagos/confirmar', { token: tokens.comprador, body: { payment_id: '9200' } });
    assert.equal(r.datos.compra.estado, 'pendiente_pago');
  });

  it('"Ya pagué: verificar" busca los pagos por external_reference', async () => {
    const { datos: otra } = await pedir('POST', '/api/compras', {
      token: tokens.comprador,
      body: { comprador: COMPRADOR, items: [{ publicacion_id: ofertas.centro.id, cantidad: 1 }], entregas: [{ vendedor_id: ofertas.centro.vendedor_id, metodo: 'retiro' }] },
    });
    mp.registrarPago({ id: '9300', compraId: otra.compra_id, estado: 'approved', monto: otra.compra.total });
    const r = await pedir('POST', `/api/compras/${otra.compra_id}/verificar-pago`, { token: tokens.comprador });
    assert.equal(r.datos.compra.estado, 'pagada');
  });

  let invitada;
  it('se puede comprar sin cuenta: la compra se ve y se paga con su código o con número + email', async () => {
    const body = { comprador: { ...COMPRADOR, email: 'Invitado@Test.com' }, items: [{ publicacion_id: ofertas.norte.id, cantidad: 1 }], entregas: [{ vendedor_id: ofertas.norte.vendedor_id, metodo: 'retiro' }] };
    const { status, datos } = await pedir('POST', '/api/compras', { body });
    assert.equal(status, 201);
    assert.match(datos.codigo_acceso, /^[0-9a-f]{32}$/);
    assert.ok(datos.pago.init_point.startsWith('https://'));
    const conCodigo = { 'x-codigo-compra': datos.codigo_acceso };
    const url = `/api/compras/${datos.compra_id}`;
    assert.equal((await pedir('GET', url)).status, 404, 'sin código no se ve');
    assert.equal((await pedir('GET', url, { headers: { 'x-codigo-compra': 'f'.repeat(32) } })).status, 404);
    assert.equal((await pedir('GET', url, { token: tokens.comprador })).status, 404, 'no es de otra cuenta');
    assert.equal((await pedir('GET', url, { headers: conCodigo })).datos.id, datos.compra_id);
    mp.registrarPago({ id: '9400', compraId: datos.compra_id, estado: 'approved', monto: datos.compra.total });
    const pago = await pedir('POST', '/api/pagos/confirmar', { body: { payment_id: '9400' }, headers: conCodigo });
    assert.equal(pago.datos.compra.estado, 'pagada');
    const buscada = await pedir('POST', '/api/compras/buscar', { body: { compra_id: datos.compra_id, email: 'invitado@test.com' } });
    assert.equal(buscada.datos.codigo_acceso, datos.codigo_acceso);
    assert.equal((await pedir('POST', '/api/compras/buscar', { body: { compra_id: datos.compra_id, email: 'otro@test.com' } })).status, 404);
    assert.equal((await pedir('POST', '/api/compras/buscar', { body: { compra_id: compra.id, email: COMPRADOR.email } })).status, 409,
      'una compra con cuenta se ve iniciando sesión');
    invitada = { id: datos.compra_id, cabecera: conCodigo };
  });

  it('botón de arrepentimiento: da un código, no se duplica y lo ven el comprador y el vendedor', async () => {
    const pedirRevocar = (body) => pedir('POST', '/api/arrepentimientos', { body });
    assert.equal((await pedirRevocar({ compra_id: invitada.id, email: 'otro@test.com' })).status, 404, 'el email tiene que coincidir');
    const primero = await pedirRevocar({ compra_id: invitada.id, email: 'INVITADO@test.com', motivo: 'Me equivoqué de modelo' });
    assert.equal(primero.status, 201);
    assert.match(primero.datos.codigo, new RegExp(`^ARR-${invitada.id}-[A-Z0-9]{6}$`));
    const repetido = await pedirRevocar({ compra_id: invitada.id, email: 'invitado@test.com' });
    assert.equal(repetido.datos.codigo, primero.datos.codigo);
    assert.equal(repetido.datos.ya_existia, true);
    const vista = await pedir('GET', `/api/compras/${invitada.id}`, { headers: invitada.cabecera });
    assert.equal(vista.datos.arrepentimiento.codigo, primero.datos.codigo);
    const pedidosNorte = (await pedir('GET', '/api/vendedor/pedidos?estado=todos', { token: tokens.norte })).datos;
    assert.equal(pedidosNorte.find((p) => p.compra.id === invitada.id).arrepentimiento.codigo, primero.datos.codigo);
    // Una compra sin pagar no se revoca
    const { datos: sinPagar } = await pedir('POST', '/api/compras', {
      body: { comprador: { ...COMPRADOR, email: 'sinpagar@test.com' }, items: [{ publicacion_id: ofertas.norte.id, cantidad: 1 }], entregas: [{ vendedor_id: ofertas.norte.vendedor_id, metodo: 'retiro' }] },
    });
    assert.equal((await pedirRevocar({ compra_id: sinPagar.compra_id, email: 'sinpagar@test.com' })).status, 409);
  });

  it('con un arrepentimiento abierto el pedido se frena: el vendedor lo cancela y se reintegra el total', async () => {
    const pedido = (await pedir('GET', '/api/vendedor/pedidos?estado=arrepentimiento', { token: tokens.norte })).datos
      .find((x) => x.compra.id === invitada.id);
    assert.ok(pedido, 'aparece entre los arrepentimientos del local');
    assert.equal(pedido.revocable, true);
    assert.deepEqual(pedido.siguientes_estados, [], 'no se ofrece prepararlo ni despacharlo');
    const avanzar = await pedir('PATCH', `/api/vendedor/pedidos/${pedido.id}/estado`, { token: tokens.norte, body: { estado: 'en_preparacion' } });
    assert.equal(avanzar.status, 409, 'el vendedor no puede seguir procesándolo');
    assert.match(avanzar.datos.mensaje, /Botón de arrepentimiento/);
    assert.ok(Number((await pedir('GET', '/api/vendedor/resumen', { token: tokens.norte })).datos.arrepentimientos) >= 1);
    const revocar = (id, token, body = {}) => pedir('POST', `/api/vendedor/pedidos/${id}/arrepentimiento`, { token, body });
    assert.equal((await revocar(pedido.id, tokens.vendedor)).status, 404, 'otro local no puede cancelarlo');

    const stockAntes = await stockDe(ofertas.norte.id);
    const revocado = await revocar(pedido.id, tokens.norte, { reponer_stock: true });
    assert.equal(revocado.status, 200);
    assert.equal(revocado.datos.estado, 'cancelado');
    assert.equal(revocado.datos.reintegro.estado, 'aprobado');
    assert.equal(revocado.datos.reintegro.monto, Number(pedido.total), 'se reintegra el total del pedido');
    const reembolso = mp.reembolsos.at(-1);
    assert.equal(reembolso.pagoId, '9400');
    assert.equal(reembolso.monto, Number(pedido.total));
    assert.equal(await stockDe(ofertas.norte.id), stockAntes + 1, 'las unidades vuelven al stock');

    const vista = (await pedir('GET', `/api/compras/${invitada.id}`, { headers: invitada.cabecera })).datos;
    assert.equal(vista.estado, 'cancelada', 'sin pedidos activos la compra queda cancelada');
    assert.equal(vista.arrepentimiento.estado, 'resuelto');
    assert.equal(vista.pedidos[0].reintegro.estado, 'aprobado');
    assert.ok(ultimoMail('invitado@test.com', 'Cancelamos tu pedido').mail, 'le avisa al comprador');
    assert.equal((await revocar(pedido.id, tokens.norte)).status, 409, 'no se cancela dos veces');
    assert.equal((await pedir('POST', '/api/arrepentimientos', { body: { compra_id: invitada.id, email: 'invitado@test.com' } })).status, 409);
    // La confirmación repetida del mismo pago no lo trata como un pago nuevo
    const repetido = await pedir('POST', '/api/pagos/confirmar', { body: { payment_id: '9400' }, headers: invitada.cabecera });
    assert.equal(repetido.datos.compra.estado, 'cancelada');
    assert.equal(mp.reembolsos.filter((r) => r.pagoId === '9400').length, 1);
  });

  it('si el comprador ya tiene el producto, se cancela cuando lo devuelve; un reintegro fallido se reintenta', async () => {
    const body = { comprador: { ...COMPRADOR, email: 'devuelve@test.com' }, items: [{ publicacion_id: ofertas.norte.id, cantidad: 1 }], entregas: [{ vendedor_id: ofertas.norte.vendedor_id, metodo: 'retiro' }] };
    const { datos } = await pedir('POST', '/api/compras', { body });
    const cabecera = { 'x-codigo-compra': datos.codigo_acceso };
    mp.registrarPago({ id: '9500', compraId: datos.compra_id, estado: 'approved', monto: datos.compra.total });
    await pedir('POST', '/api/pagos/confirmar', { body: { payment_id: '9500' }, headers: cabecera });
    const pedido = (await pedir('GET', '/api/vendedor/pedidos?estado=todos', { token: tokens.norte })).datos.find((x) => x.compra.id === datos.compra_id);
    for (const estado of ['en_preparacion', 'listo_para_retirar', 'entregado']) {
      assert.equal((await pedir('PATCH', `/api/vendedor/pedidos/${pedido.id}/estado`, { token: tokens.norte, body: { estado } })).status, 200);
    }
    assert.equal((await pedir('POST', '/api/arrepentimientos', { body: { compra_id: datos.compra_id, email: 'devuelve@test.com' } })).status, 201);
    const entregado = (await pedir('GET', '/api/vendedor/pedidos?estado=activos', { token: tokens.norte })).datos.find((x) => x.id === pedido.id);
    assert.ok(entregado, 'un pedido entregado con arrepentimiento sigue entre los activos');
    assert.equal(entregado.en_manos_del_comprador, true);

    const revocar = (b) => pedir('POST', `/api/vendedor/pedidos/${pedido.id}/arrepentimiento`, { token: tokens.norte, body: b });
    const sinDevolver = await revocar({});
    assert.equal(sinDevolver.status, 409);
    assert.match(sinDevolver.datos.mensaje, /te lo devuelva/);

    const stockAntes = await stockDe(ofertas.norte.id);
    mp.falloReembolso = 'Mercado Pago no responde';
    const conError = await revocar({ producto_devuelto: true, reponer_stock: false });
    assert.equal(conError.status, 200, 'el pedido se cancela igual');
    assert.equal(conError.datos.reintegro.estado, 'error');
    assert.match(conError.datos.reintegro.detalle, /no responde/);
    assert.equal(await stockDe(ofertas.norte.id), stockAntes, 'sin reponer stock');
    mp.falloReembolso = null;
    const reintento = await pedir('POST', `/api/vendedor/pedidos/${pedido.id}/reintegro`, { token: tokens.norte });
    assert.equal(reintento.datos.reintegro.estado, 'aprobado');
    assert.equal((await pedir('POST', `/api/vendedor/pedidos/${pedido.id}/reintegro`, { token: tokens.norte })).status, 409, 'ya está aprobado');
    assert.equal(mp.reembolsos.filter((r) => r.pagoId === '9500').length, 1);
  });

  it('Mis compras muestra estados, envío y transportista', async () => {
    const { datos } = await pedir('GET', '/api/compras', { token: tokens.comprador });
    const c = datos.find((x) => x.id === compra.id);
    const conEnvio = c.pedidos.find((p) => p.envio.metodo === 'domicilio');
    assert.equal(conEnvio.envio.transportista, 'andreani');
    assert.equal(conEnvio.envio.localidad, 'CABA');
  });

  describe('Panel del vendedor', () => {
    let pedidoRetiro;
    let pedidoEnvio;

    it('cada vendedor ve solo sus pedidos pagados', async () => {
      const norte = (await pedir('GET', '/api/vendedor/pedidos?estado=todos', { token: tokens.norte })).datos;
      pedidoRetiro = norte.find((p) => p.compra.id === compra.id);
      assert.ok(pedidoRetiro);
      assert.equal(pedidoRetiro.envio.metodo, 'retiro');
      assert.deepEqual(pedidoRetiro.siguientes_estados, ['en_preparacion']);
      const centro = (await pedir('GET', '/api/vendedor/pedidos?estado=todos', { token: tokens.vendedor })).datos;
      pedidoEnvio = centro.find((p) => p.compra.id === compra.id);
      assert.equal(pedidoEnvio.envio.transportista, 'andreani');
      assert.ok(!centro.some((p) => p.id === pedidoRetiro.id));
    });

    it('sigue el flujo pagado → en preparación → listo para retirar / enviado → entregado', async () => {
      const cambiar = (id, estado, token) => pedir('PATCH', `/api/vendedor/pedidos/${id}/estado`, { token, body: { estado } });
      assert.equal((await cambiar(pedidoRetiro.id, 'entregado', tokens.norte)).status, 409);
      assert.equal((await cambiar(pedidoRetiro.id, 'en_preparacion', tokens.norte)).status, 200);
      const mal = await cambiar(pedidoRetiro.id, 'enviado', tokens.norte);
      assert.equal(mal.status, 409);
      assert.match(mal.datos.mensaje, /listo para retirar/);
      assert.equal((await cambiar(pedidoRetiro.id, 'listo_para_retirar', tokens.norte)).status, 200);
      assert.equal((await cambiar(pedidoRetiro.id, 'entregado', tokens.norte)).datos.estado, 'entregado');

      assert.equal((await cambiar(pedidoEnvio.id, 'en_preparacion', tokens.vendedor)).status, 200);
      const conNumeroAntes = await pedir('PATCH', `/api/vendedor/pedidos/${pedidoEnvio.id}/estado`,
        { token: tokens.vendedor, body: { estado: 'en_preparacion', numero_seguimiento: 'AB123456' } });
      assert.equal(conNumeroAntes.status, 400, 'el número de seguimiento va con "enviado"');
      const enviado = await pedir('PATCH', `/api/vendedor/pedidos/${pedidoEnvio.id}/estado`,
        { token: tokens.vendedor, body: { estado: 'enviado', numero_seguimiento: ' 3600 0012 3456 ab ' } });
      assert.equal(enviado.status, 200);
      assert.equal(enviado.datos.numero_seguimiento, '3600 0012 3456 AB');
      assert.ok(enviado.datos.despachado_en);
      assert.equal((await cambiar(pedidoEnvio.id, 'entregado', tokens.norte)).status, 404, 'otro vendedor no puede tocarlo');
    });

    it('el número de seguimiento se puede corregir y lo ve el comprador', async () => {
      const corregir = (id, numero, token) => pedir('PUT', `/api/vendedor/pedidos/${id}/seguimiento`, { token, body: { numero_seguimiento: numero } });
      assert.equal((await corregir(pedidoEnvio.id, 'OCA-998877', tokens.vendedor)).datos.numero_seguimiento, 'OCA-998877');
      assert.equal((await corregir(pedidoEnvio.id, 'OCA-998877', tokens.norte)).status, 404, 'otro vendedor no puede');
      assert.equal((await corregir(pedidoRetiro.id, 'OCA-998877', tokens.norte)).status, 409, 'un retiro no lleva seguimiento');
      assert.equal((await corregir(pedidoEnvio.id, 'no válido!', tokens.vendedor)).status, 400);
      const { datos } = await pedir('GET', `/api/compras/${compra.id}`, { token: tokens.comprador });
      const conEnvio = datos.pedidos.find((p) => p.id === pedidoEnvio.id);
      assert.equal(conEnvio.envio.numero_seguimiento, 'OCA-998877');
      assert.ok(conEnvio.envio.despachado_en);
    });

    it('el vendedor no ve el catálogo de otros: solo carga y lista lo suyo', async () => {
      assert.equal((await pedir('GET', '/api/vendedor/catalogo?q=hilux', { token: tokens.vendedor })).status, 404, 'no hay buscador del catálogo');
      assert.equal((await pedir('POST', '/api/vendedor/publicaciones', { token: tokens.vendedor, body: { producto_id: 1, precio: 1, stock: 1, condicion: 'nuevo' } })).status, 404,
        'no se publica eligiendo productos del catálogo');
      const { datos: yo } = await pedir('GET', '/api/auth/yo', { token: tokens.vendedor });
      const { datos: propias } = await pedir('GET', '/api/vendedor/publicaciones', { token: tokens.vendedor });
      assert.ok(propias.length > 0);
      const { rows: ajenas } = await pool.query('SELECT id FROM publicaciones WHERE id = ANY($1::int[]) AND vendedor_id <> $2', [propias.map((x) => x.id), yo.vendedor.id]);
      assert.equal(ajenas.length, 0, 'la lista tiene solo publicaciones del local');
    });

    it('gestiona publicaciones: crear, editar precio y stock, y pausar', async () => {
      // Un repuesto de Hilux que ya vende otra casa y este local no tiene como nuevo: al cargarlo se suma a esa ficha
      const { datos: yo } = await pedir('GET', '/api/auth/yo', { token: tokens.vendedor });
      const { rows: [libre] } = await pool.query(`
        SELECT pr.id, pr.numero_pieza, pr.categoria_id, mr.nombre AS marca
          FROM productos pr JOIN marcas_repuesto mr ON mr.id = pr.marca_repuesto_id
         WHERE pr.estado_verificacion <> 'DISCONTINUED' AND normalizar(pr.nombre) LIKE '%hilux%'
           AND EXISTS (SELECT 1 FROM publicaciones o WHERE o.producto_id = pr.id AND o.estado = 'activa' AND o.vendedor_id <> $1)
           AND NOT EXISTS (SELECT 1 FROM publicaciones o WHERE o.producto_id = pr.id AND o.vendedor_id = $1 AND o.condicion = 'nuevo')
         ORDER BY pr.id LIMIT 1`, [yo.vendedor.id]);
      assert.ok(libre, 'hay un repuesto de Hilux para publicar');
      const body = {
        nombre: 'Nombre que escribe el vendedor', marca: libre.marca.toUpperCase(), numero_pieza: ` ${libre.numero_pieza.toLowerCase()} `,
        categoria_id: libre.categoria_id, universal: true, precio: 50000, stock: 4, condicion: 'nuevo', descripcion: '  Original, en caja cerrada.  ',
      };
      const creada = await pedir('POST', '/api/vendedor/productos', { token: tokens.vendedor, body });
      assert.equal(creada.status, 201);
      assert.equal(creada.datos.unida_a_existente, true, 'la misma marca y número es la misma pieza');
      assert.equal(creada.datos.producto.id, libre.id);
      assert.equal(creada.datos.descripcion, 'Original, en caja cerrada.');
      assert.ok(creada.datos.competidores > 0, 'sigue la comparación con las otras casas');
      const repetida = await pedir('POST', '/api/vendedor/productos', { token: tokens.vendedor, body });
      assert.equal(repetida.status, 409);
      assert.equal(repetida.datos.publicacion_id, creada.datos.id);
      const conOfertas = (await pedir('GET', `/api/productos/${libre.id}`)).datos;
      const mia = conOfertas.ofertas.find((o) => o.publicacion_id === creada.datos.id);
      assert.ok(mia && conOfertas.ofertas.length > 1, 'la ficha muestra la oferta junto a las de otras casas');
      assert.equal(mia.descripcion, 'Original, en caja cerrada.');
      assert.notEqual(conOfertas.producto.nombre, 'Nombre que escribe el vendedor', 'la ficha compartida no cambia');
      const editada = await pedir('PATCH', `/api/vendedor/publicaciones/${creada.datos.id}`, { token: tokens.vendedor, body: { precio: 47500, stock: 9 } });
      assert.equal(editada.datos.precio, 47500);
      assert.equal(editada.datos.stock, 9);
      await pedir('PATCH', `/api/vendedor/publicaciones/${creada.datos.id}`, { token: tokens.vendedor, body: { estado: 'pausada' } });
      const ficha = (await pedir('GET', `/api/productos/${libre.id}`)).datos;
      assert.ok(!ficha.ofertas.some((o) => o.publicacion_id === creada.datos.id), 'una publicación pausada no se muestra');
      const descripcion = (texto, token = tokens.vendedor) => pedir('PUT', `/api/vendedor/publicaciones/${creada.datos.id}/descripcion`, { token, body: { descripcion: texto } });
      assert.equal((await descripcion('Con garantía de 6 meses.')).datos.descripcion, 'Con garantía de 6 meses.');
      assert.equal((await descripcion('Otra', tokens.norte)).status, 404, 'otro local no la cambia');
      const sinTexto = await descripcion('   ');
      assert.equal(sinTexto.status, 200);
      assert.equal(sinTexto.datos.descripcion, null, 'sin texto, la publicación queda sin descripción');
      const comprador = await pedir('GET', '/api/vendedor/publicaciones', { token: tokens.comprador });
      assert.equal(comprador.status, 403);
    });

    it('da de alta un producto nuevo: queda sin verificar, con su fuente y en la subcategoría exacta', async () => {
      const { rows: [v] } = await pool.query("SELECT v.id FROM vehiculos v JOIN modelos_vehiculo m ON m.id = v.modelo_id WHERE m.nombre = 'Cronos' LIMIT 1");
      const { rows: [raiz] } = await pool.query("SELECT id FROM categorias WHERE slug = 'frenos'");
      const { rows: [hoja] } = await pool.query("SELECT id FROM categorias WHERE slug = 'pastillas-de-freno'");
      const body = { nombre: 'Pastillas cerámicas Fiat Cronos', marca: 'Bosch', numero_pieza: 'BO-TEST-01', categoria_id: raiz.id, universal: false, vehiculo_ids: [v.id], precio: 61000, stock: 5, condicion: 'nuevo' };
      const enRaiz = await pedir('POST', '/api/vendedor/productos', { token: tokens.vendedor, body });
      assert.equal(enRaiz.status, 400);
      assert.match(enRaiz.datos.mensaje, /subcategoría/);
      const r = await pedir('POST', '/api/vendedor/productos', { token: tokens.vendedor, body: { ...body, categoria_id: hoja.id } });
      assert.equal(r.status, 201);
      assert.match(r.datos.producto.sku, /^FRE-\d{6}$/);
      const repetido = await pedir('POST', '/api/vendedor/productos', { token: tokens.vendedor, body: { ...body, categoria_id: hoja.id, numero_pieza: 'bo test 01' } });
      assert.equal(repetido.status, 409, 'el mismo local no publica dos veces la misma pieza en la misma condición');
      const { rows: [otro] } = await pool.query(
        "SELECT v.id FROM vehiculos v JOIN modelos_vehiculo m ON m.id = v.modelo_id WHERE m.nombre = 'Cronos' AND v.id <> $1 LIMIT 1", [v.id]);
      const deOtraCasa = await pedir('POST', '/api/vendedor/productos', {
        token: tokens.norte, body: { ...body, marca: 'BOSCH', numero_pieza: 'bo-test 01', categoria_id: hoja.id, vehiculo_ids: [v.id, otro.id], precio: 59000, condicion: 'usado' },
      });
      assert.equal(deOtraCasa.status, 201);
      assert.equal(deOtraCasa.datos.unida_a_existente, true);
      assert.equal(deOtraCasa.datos.producto.id, r.datos.producto.id, 'misma pieza, misma ficha');
      const { rows: compat } = await pool.query('SELECT vehiculo_id FROM compatibilidades WHERE producto_id = $1 ORDER BY vehiculo_id', [r.datos.producto.id]);
      assert.deepEqual(compat.map((c) => c.vehiculo_id), [v.id, otro.id].sort((a, b) => a - b), 'suma la compatibilidad nueva sin duplicar la que había');
      const conDos = (await pedir('GET', `/api/productos/${r.datos.producto.id}`)).datos;
      assert.equal(conDos.ofertas.length, 2, 'el comprador compara las dos ofertas');
      const ficha = (await pedir('GET', `/api/productos/${r.datos.producto.id}?vehiculo=${v.id}`)).datos;
      assert.equal(ficha.producto.estado_verificacion, 'UNVERIFIED');
      assert.equal(ficha.producto.fuente.nombre, 'Carga de vendedores AUTONEX');
      assert.equal(ficha.compatibilidad.estado, 'sin_verificar');
    });

    it('el local sube su logo: entra completo en un cuadrado, se ve en su página y al quitarlo vuelve el de base', async () => {
      const sharp = (await import('sharp')).default;
      const ancho = { nombre: 'logo.png', tipo: 'image/png', datos: await imagenDePrueba(600, 200) };
      const subido = await subirImagen('PUT', '/api/vendedor/logo', 'logo', ancho, tokens.vendedor);
      assert.equal(subido.status, 200);
      assert.equal(subido.datos.logo_subido, true);
      assert.match(subido.datos.logo, /^api\/archivos\/\d+$/);
      const archivo = await verArchivo(subido.datos.logo);
      assert.match(archivo.headers['cache-control'], /^public/);
      const meta = await sharp(archivo.rawPayload).metadata();
      assert.deepEqual([meta.width, meta.height], [512, 512], 'el logo entero en un cuadrado');
      const { datos: yo } = await pedir('GET', '/api/auth/yo', { token: tokens.vendedor });
      assert.equal(yo.vendedor.logo, subido.datos.logo);
      assert.equal((await pedir('GET', `/api/vendedores/${yo.vendedor.slug}`)).datos.logo, subido.datos.logo, 'se ve en la página del local');
      assert.equal((await pedir('GET', '/api/vendedor/perfil', { token: tokens.vendedor })).datos.logo_subido, true);
      assert.equal((await subirImagen('PUT', '/api/vendedor/logo', 'logo', ancho, tokens.comprador)).status, 403, 'solo los vendedores');
      assert.equal((await subirImagen('PUT', '/api/vendedor/logo', 'logo', { ...ancho, datos: await imagenDePrueba(60, 60) }, tokens.vendedor)).status, 400, 'muy chico');

      const quitado = await pedir('DELETE', '/api/vendedor/logo', { token: tokens.vendedor });
      assert.equal(quitado.datos.logo_subido, false);
      assert.doesNotMatch(String(quitado.datos.logo), /archivos/, 'vuelve al logo de base del local');
      assert.equal((await verArchivo(subido.datos.logo)).statusCode, 404, 'el archivo se borra');
      assert.equal((await pedir('DELETE', '/api/vendedor/logo', { token: tokens.vendedor })).status, 404);
    });

    it('cada publicación tiene sus fotos y su descripción, y se ven en la ficha', async () => {
      const sharp = (await import('sharp')).default;
      const foto = (r, g, b) => sharp({ create: { width: 640, height: 480, channels: 3, background: { r, g, b } } }).png().toBuffer();
      const png = { nombre: 'frente.png', tipo: 'image/png', datos: await foto(220, 90, 20) };
      const jpg = { nombre: 'costado.jpg', tipo: 'image/jpeg', datos: await sharp(await foto(30, 60, 200)).jpeg().toBuffer() };
      const creada = await pedir('POST', '/api/vendedor/productos', {
        token: tokens.vendedor,
        body: { nombre: 'Disco de freno ventilado de prueba', marca: 'Fremax', numero_pieza: 'FOTO-TEST-01', categoria_id: await hojaDeCategoria(), universal: true, precio: 38000, stock: 3, condicion: 'usado', descripcion: 'Usado, sin rayas.' },
      });
      assert.equal(creada.status, 201);
      assert.equal(creada.datos.unida_a_existente, false);
      assert.deepEqual(creada.datos.fotos, []);
      const pubId = creada.datos.id;

      const subida = await subirFotos(pubId, [png, jpg], tokens.vendedor);
      assert.equal(subida.status, 200);
      assert.equal(subida.datos.fotos.length, 2);
      assert.match(subida.datos.fotos[0].url, /^api\/archivos\/\d+$/);
      const archivo = await app.inject({ method: 'GET', url: `/${subida.datos.fotos[0].url}` });
      assert.equal(archivo.statusCode, 200);
      assert.equal(archivo.headers['content-type'], 'image/webp', 'se guardan optimizadas en WebP');
      assert.match(archivo.headers['cache-control'], /immutable/);
      assert.equal((await sharp(archivo.rawPayload).metadata()).format, 'webp');

      const noEsFoto = await subirFotos(pubId, [{ nombre: 'virus.png', tipo: 'image/png', datos: Buffer.from('esto no es una imagen') }], tokens.vendedor);
      assert.equal(noEsFoto.status, 400);
      assert.match(noEsFoto.datos.mensaje, /no es una imagen válida/);
      const chica = await subirFotos(pubId, [{ nombre: 'chica.png', tipo: 'image/png', datos: await sharp({ create: { width: 80, height: 80, channels: 3, background: '#ffffff' } }).png().toBuffer() }], tokens.vendedor);
      assert.equal(chica.status, 400);
      assert.match(chica.datos.mensaje, /200×200/);
      const demasiadas = await subirFotos(pubId, [png, png, png, png, png], tokens.vendedor);
      assert.equal(demasiadas.status, 400, 'hasta 6 fotos por publicación');
      assert.equal((await subirFotos(pubId, [png], tokens.norte)).status, 404, 'otro local no puede subir fotos a esta publicación');
      assert.equal((await pedir('GET', '/api/vendedor/publicaciones', { token: tokens.vendedor })).datos.find((x) => x.id === pubId).fotos.length, 2,
        'los intentos fallidos no guardan nada');

      const ficha = (await pedir('GET', `/api/productos/${creada.datos.producto.id}`)).datos;
      const oferta = ficha.ofertas.find((o) => o.publicacion_id === pubId);
      assert.equal(oferta.fotos.length, 2);
      assert.equal(oferta.descripcion, 'Usado, sin rayas.');
      assert.equal(ficha.producto.imagenes.filter((i) => i.de_vendedor).length, 2, 'las fotos del vendedor van a la galería');
      assert.equal(ficha.producto.imagen_estado, 'OK');
      const listado = (await pedir('GET', '/api/productos?q=FOTO-TEST-01')).datos;
      assert.equal(listado.productos.find((x) => x.id === creada.datos.producto.id)?.imagen, subida.datos.fotos[0].url,
        'en el listado se ve la foto del vendedor en lugar de la ilustración de la categoría');

      const fotoId = subida.datos.fotos[0].id;
      assert.equal((await pedir('DELETE', `/api/vendedor/publicaciones/${pubId}/fotos/${fotoId}`, { token: tokens.norte })).status, 404);
      const borrada = await pedir('DELETE', `/api/vendedor/publicaciones/${pubId}/fotos/${fotoId}`, { token: tokens.vendedor });
      assert.equal(borrada.status, 200);
      assert.equal(borrada.datos.fotos.length, 1);
      assert.equal((await app.inject({ method: 'GET', url: `/${subida.datos.fotos[0].url}` })).statusCode, 404, 'el archivo se borra');
    });
  });
});

describe('Panel de administración del catálogo', () => {
  let admin;
  let fuenteId;
  let productoId;

  /** multipart/form-data armado a mano para fastify.inject */
  function formulario(campos, archivo) {
    const limite = `----autonex${Date.now()}`;
    const partes = Object.entries(campos).map(([k, v]) => `--${limite}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`);
    partes.push(`--${limite}\r\nContent-Disposition: form-data; name="archivo"; filename="${archivo.nombre}"\r\nContent-Type: text/csv\r\n\r\n${archivo.contenido}\r\n`);
    partes.push(`--${limite}--\r\n`);
    return { payload: Buffer.from(partes.join('')), headers: { 'content-type': `multipart/form-data; boundary=${limite}` } };
  }

  async function importarCsv(campos, nombre, contenido) {
    const { payload, headers } = formulario(campos, { nombre, contenido });
    const res = await app.inject({ method: 'POST', url: '/api/admin/importaciones', payload, headers: { ...headers, authorization: `Bearer ${admin}` } });
    return { status: res.statusCode, datos: res.json() };
  }

  before(async () => {
    admin = await login('admin@autonex.com.ar');
  });

  it('solo entra un administrador', async () => {
    assert.equal((await pedir('GET', '/api/admin/resumen')).status, 401);
    assert.equal((await pedir('GET', '/api/admin/resumen', { token: tokens.vendedor })).status, 403);
    const { status, datos } = await pedir('GET', '/api/admin/resumen', { token: admin });
    assert.equal(status, 200);
    assert.ok(datos.por_estado.vehiculos.VERIFIED > 0);
    assert.equal(datos.por_estado.productos.VERIFIED ?? 0, 0, 'los repuestos de demostración no están verificados');
  });

  it('crea una fuente con su checklist de licencia y la usa para importar', async () => {
    const r = await pedir('POST', '/api/admin/datos/fuentes', {
      token: admin,
      body: { datos: { nombre: 'Distribuidor de prueba', tipo: 'proveedor', nivel_confianza: 'media', terminos_revisados: true, licencia_verificada: true, permite_uso_comercial: true } },
    });
    assert.equal(r.status, 201);
    fuenteId = r.datos.registro.id;
    assert.equal(r.datos.registro.slug, 'distribuidor-de-prueba');
  });

  it('valida un CSV sin guardar y después lo importa con trazabilidad', async () => {
    const csv = 'Marca,Part Number,Nombre,Categoría,OEM,Marca OEM\nWega,WO-TEST-9,Filtro de aceite de prueba,filtro-de-aceite,90915-YZZTEST,Toyota\nWega,,Sin número,filtro-de-aceite,,\n';
    const vista = await importarCsv({ entidad: 'repuestos', fuente: 'distribuidor-de-prueba', solo_validar: 'true' }, 'repuestos.csv', csv);
    assert.equal(vista.status, 200);
    assert.equal(vista.datos.estado, 'validada');
    assert.equal(vista.datos.creado, 1);
    assert.equal(vista.datos.error, 1);
    assert.equal((await pool.query("SELECT 1 FROM productos WHERE numero_pieza = 'WO-TEST-9'")).rowCount, 0, 'la vista previa no guarda');

    const real = await importarCsv({ entidad: 'repuestos', fuente: 'distribuidor-de-prueba' }, 'repuestos.csv', csv);
    assert.equal(real.status, 201);
    assert.equal(real.datos.estado, 'completada_con_errores');
    const { rows: [p] } = await pool.query("SELECT * FROM productos WHERE numero_pieza = 'WO-TEST-9'");
    productoId = p.id;
    assert.equal(p.fuente_id, fuenteId);
    assert.equal(p.importacion_id, real.datos.importacion_id);
    assert.equal(p.estado_verificacion, 'UNVERIFIED');

    const errores = (await pedir('GET', `/api/admin/importaciones/${real.datos.importacion_id}`, { token: admin })).datos;
    assert.equal(errores.errores_total, 1);
    assert.equal(errores.errores[0].fila, 3);
  });

  it('busca por número OEM en cualquier formato', async () => {
    const { datos } = await pedir('GET', '/api/buscar/codigo?q=90915yzztest');
    assert.ok(datos.resultados.some((p) => p.id === productoId && p.tipo === 'oem'));
  });

  it('agrega compatibilidades por modelo y años, y VERIFIED exige una fuente real', async () => {
    const { rows: [m] } = await pool.query("SELECT mo.id FROM modelos_vehiculo mo WHERE mo.nombre = 'Hilux' LIMIT 1");
    const r = await pedir('POST', `/api/admin/productos/${productoId}/compatibilidades`, {
      token: admin, body: { modelo_id: m.id, anio_desde: 2016, anio_hasta: 2020, fuente_id: fuenteId },
    });
    assert.equal(r.status, 200);
    assert.ok(r.datos.agregadas > 0);
    assert.equal(r.datos.estado, 'UNVERIFIED');

    const { rows: [c] } = await pool.query('SELECT producto_id, vehiculo_id FROM compatibilidades WHERE producto_id = $1 LIMIT 1', [productoId]);
    const { rows: [demo] } = await pool.query("SELECT id FROM fuentes WHERE slug = 'demo'");
    const conDemo = await pedir('POST', '/api/admin/verificacion', {
      token: admin, body: { entidad: 'compatibilidades', ids: [`${c.producto_id}:${c.vehiculo_id}`], estado: 'VERIFIED', fuente_id: demo.id },
    });
    assert.equal(conDemo.status, 400);
    const ok = await pedir('POST', '/api/admin/verificacion', {
      token: admin, body: { entidad: 'compatibilidades', ids: [`${c.producto_id}:${c.vehiculo_id}`], estado: 'VERIFIED', fuente_id: fuenteId, nota: 'Catálogo 2026 pág. 12' },
    });
    assert.equal(ok.status, 200);
    const ficha = (await pedir('GET', `/api/productos/${productoId}?vehiculo=${c.vehiculo_id}`)).datos;
    assert.equal(ficha.compatibilidad.estado, 'compatible');
    assert.equal(ficha.compatibilidad.confirmada, true);
    const { rows: historial } = await pool.query("SELECT * FROM verificaciones WHERE entidad = 'compatibilidades' AND registro_id = $1", [`${c.producto_id}:${c.vehiculo_id}`]);
    assert.equal(historial.at(-1).estado_nuevo, 'VERIFIED');
  });

  it('una marca parecida a otra queda como posible duplicado y la decide el administrador', async () => {
    const csv = 'marca\nVolkswagem\nMarca Nueva De Prueba\n';
    const r = await importarCsv({ entidad: 'marcas', fuente: 'distribuidor-de-prueba' }, 'marcas.csv', csv);
    assert.equal(r.datos.duplicado, 1);
    assert.equal(r.datos.creado, 1);
    assert.equal((await pool.query("SELECT 1 FROM marcas_vehiculo WHERE nombre = 'Volkswagem'")).rowCount, 0, 'no se crea sola');
    const lista = (await pedir('GET', '/api/admin/duplicados?entidad=marcas', { token: admin })).datos;
    const caso = lista.registros.find((d) => d.datos_nuevos?.datos?.marca === 'Volkswagem');
    assert.equal(caso.existente.etiqueta, 'Volkswagen');
    const descartado = await pedir('POST', `/api/admin/duplicados/${caso.id}/resolver`, { token: admin, body: { accion: 'fusionar' } });
    assert.equal(descartado.datos.estado, 'fusionado');
    const otraVez = await pedir('POST', `/api/admin/duplicados/${caso.id}/resolver`, { token: admin, body: { accion: 'crear' } });
    assert.equal(otraVez.status, 409);
  });

  it('el alta manual avisa de parecidos y la baja no borra datos con dependencias', async () => {
    const parecida = await pedir('POST', '/api/admin/datos/marcas', { token: admin, body: { datos: { nombre: 'Volkswagenn' } } });
    assert.equal(parecida.status, 409);
    assert.equal(parecida.datos.requiere_confirmacion, true);
    const { rows: [vw] } = await pool.query("SELECT id FROM marcas_vehiculo WHERE nombre = 'Volkswagen'");
    const baja = await pedir('DELETE', `/api/admin/datos/marcas/${vw.id}`, { token: admin });
    assert.equal(baja.status, 409);
    assert.match(baja.datos.mensaje, /modelos/);
    const lista = (await pedir('GET', '/api/admin/datos/vehiculos?q=gol%20trend&estado=VERIFIED', { token: admin })).datos;
    assert.ok(lista.total > 0);
    assert.ok(lista.registros.every((v) => v.fuente && v.estado_verificacion === 'VERIFIED'));
  });

  it('descarga plantillas y los errores de una importación en CSV', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/plantillas/compatibilidades', headers: { authorization: `Bearer ${admin}` } });
    assert.equal(res.statusCode, 200);
    assert.match(res.body, /sku,marca,numero_pieza,vehiculo/);
  });
});

describe('Motos y casas de repuestos de todo el país', () => {
  let admin;
  let ktm;

  const api = (body) => pedir('POST', '/api/admin/importaciones/api', { token: admin, body });
  const buscar = async (q) => (await pedir('GET', `/api/productos?q=${encodeURIComponent(q)}&por_pagina=60`)).datos;

  async function importarArchivo(campos, nombre, contenido, tipo) {
    const limite = `----autonex${Date.now()}`;
    const partes = Object.entries(campos).map(([k, v]) => `--${limite}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`);
    partes.push(`--${limite}\r\nContent-Disposition: form-data; name="archivo"; filename="${nombre}"\r\nContent-Type: ${tipo}\r\n\r\n${contenido}\r\n`, `--${limite}--\r\n`);
    const res = await app.inject({
      method: 'POST', url: '/api/admin/importaciones', payload: Buffer.from(partes.join('')),
      headers: { 'content-type': `multipart/form-data; boundary=${limite}`, authorization: `Bearer ${admin}` },
    });
    return { status: res.statusCode, datos: res.json() };
  }

  before(async () => {
    admin = await login('admin@autonex.com.ar');
    const r = await pedir('POST', '/api/admin/datos/fuentes', {
      token: admin,
      body: { datos: { nombre: 'Catálogo de motos de prueba', tipo: 'proveedor', nivel_confianza: 'media', terminos_revisados: true, licencia_verificada: true, permite_uso_comercial: true } },
    });
    assert.equal(r.status, 201);
  });

  it('el selector tiene el segmento Motos, con las marcas argentinas primero, sin mezclarse con los autos', async () => {
    const refs = (await pedir('GET', '/api/referencias')).datos;
    assert.ok(refs.segmentos.some((s) => s.valor === 'moto' && s.etiqueta === 'Motos'));
    assert.equal(refs.categorias_moto.length, 31);
    const marcas = (await pedir('GET', '/api/vehiculos/marcas?segmento=moto')).datos;
    const nombres = marcas.map((m) => m.nombre);
    for (const m of ['Honda', 'KTM', 'Yamaha', 'Motomel']) assert.ok(nombres.includes(m), `falta ${m}`);
    assert.equal(nombres[0], 'Motomel');
    assert.equal(marcas[0].presencia.oficial_argentina, true);
    ktm = marcas.find((m) => m.nombre === 'KTM');
    const autos = (await pedir('GET', '/api/vehiculos/marcas?segmento=particular')).datos;
    assert.ok(autos.some((m) => m.nombre === 'Toyota'));
    assert.ok(!autos.some((m) => m.nombre === 'KTM'));
  });

  it('lista los modelos de moto con sus categorías y filtra por categoría', async () => {
    const modelos = (await pedir('GET', `/api/vehiculos/marcas/${ktm.id}/modelos?segmento=moto`)).datos;
    const exc = modelos.find((m) => m.nombre === '300 EXC');
    assert.deepEqual(exc.categorias, ['ENDURO', 'COMPETITION']);
    const mx = (await pedir('GET', `/api/vehiculos/marcas/${ktm.id}/modelos?segmento=moto&categoria=MOTOCROSS`)).datos;
    assert.ok(mx.some((m) => m.nombre === '250 SX-F'));
    assert.ok(mx.every((m) => m.categorias.includes('MOTOCROSS')));
  });

  it('la ficha de un modelo sin datos verificados no inventa años, versiones ni fotos', async () => {
    const { rows: [crf] } = await pool.query(`SELECT mo.id FROM modelos_vehiculo mo JOIN marcas_vehiculo ma ON ma.id = mo.marca_id
                                               WHERE ma.nombre = 'Honda' AND mo.nombre = 'CRF250R'`);
    const ficha = (await pedir('GET', `/api/vehiculos/modelos/${crf.id}`)).datos;
    assert.equal(ficha.segmento, 'moto');
    assert.ok(ficha.categorias.some((c) => c.codigo === 'MOTOCROSS' && c.estado === 'UNVERIFIED'));
    assert.equal(Number(ficha.versiones), 0);
    assert.equal(ficha.imagen_estado, ficha.imagenes.length ? 'OK' : 'IMAGE_MISSING');
    assert.ok(ficha.imagenes.every((i) => i.licencia && i.url_origen), 'toda foto tiene licencia y origen');
  });

  it('importa versiones por API, repuestos en XML y compatibilidades con años', async () => {
    const versiones = await api({
      entidad: 'vehiculos', fuente: 'catalogo-de-motos-de-prueba', filas: [
        { marca: 'KTM', modelo: '300 EXC', version: '300 EXC TPI (prueba)', anio_desde: 2020, anio_hasta: 2023, cilindrada_cc: 293, tiempos: '2T', alimentacion: 'inyeccion', velocidades: 6, segmento: 'moto' },
        { marca: 'Yamaha', modelo: 'YZ250F', version: 'YZ250F (prueba)', anio_desde: 2019, anio_hasta: 2023, cilindrada_cc: 250, tiempos: '4T', alimentacion: 'inyeccion', segmento: 'moto' },
        { marca: 'Honda', modelo: 'CRF250R', version: 'CRF250R (prueba)', anio_desde: 2018, anio_hasta: 2021, cilindrada_cc: 250, tiempos: '4T', alimentacion: 'inyeccion', segmento: 'moto' },
      ],
    });
    assert.equal(versiones.status, 201);
    assert.equal(versiones.datos.error, 0, JSON.stringify(versiones.datos.primeros_errores));
    const { rows: [motor] } = await pool.query(`SELECT m.tiempos, m.alimentacion FROM vehiculos v JOIN motores m ON m.id = v.motor_id
                                                 WHERE v.version = '300 EXC TPI (prueba)'`);
    assert.deepEqual({ ...motor }, { tiempos: '2T', alimentacion: 'inyeccion' });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<catalogo>
  <producto><marca>DID</marca><numero_pieza>520ERT2-PRUEBA</numero_pieza><nombre>Cadena 520 ERT2 de prueba</nombre>
    <categoria>Motos &gt; Transmisión final &gt; Cadenas</categoria><ean>7790000000017</ean><upc>012345678905</upc></producto>
  <producto><marca>Brembo</marca><numero_pieza>07HO-PRUEBA</numero_pieza><nombre>Pastillas de freno de prueba</nombre>
    <categoria>Motos &gt; Frenos &gt; Pastillas</categoria></producto>
</catalogo>`;
    const repuestos = await importarArchivo({ entidad: 'repuestos', fuente: 'catalogo-de-motos-de-prueba' }, 'repuestos.xml', xml, 'application/xml');
    assert.equal(repuestos.status, 201);
    assert.equal(repuestos.datos.creado, 2, JSON.stringify(repuestos.datos.primeros_errores));
    const { rows: [cadena] } = await pool.query(`SELECT p.upc, p.imagen, c.rubro FROM productos p JOIN categorias c ON c.id = p.categoria_id
                                                  WHERE p.numero_pieza = '520ERT2-PRUEBA'`);
    assert.equal(cadena.rubro, 'motos');
    assert.equal(cadena.upc, '012345678905');
    assert.equal(cadena.imagen, null, 'sin foto real no se usa la de la categoría');

    const compat = await api({
      entidad: 'compatibilidades', fuente: 'catalogo-de-motos-de-prueba', filas: [
        { marca: 'DID', numero_pieza: '520ERT2-PRUEBA', marca_vehiculo: 'KTM', modelo: '300 EXC', anio_desde: 2020, anio_hasta: 2023 },
        { marca: 'DID', numero_pieza: '520ERT2-PRUEBA', marca_vehiculo: 'Yamaha', modelo: 'YZ250F' },
        { marca: 'Brembo', numero_pieza: '07HO-PRUEBA', marca_vehiculo: 'Honda', modelo: 'CRF250R', anio_desde: 2018, anio_hasta: 2019 },
      ],
    });
    assert.equal(compat.datos.error, 0, JSON.stringify(compat.datos.primeros_errores));
    // El vendedor los publica cargando marca y número: se suman a las fichas importadas
    for (const numero of ['520ERT2-PRUEBA', '07HO-PRUEBA']) {
      const { rows: [p] } = await pool.query(
        'SELECT p.id, p.categoria_id, mr.nombre AS marca FROM productos p JOIN marcas_repuesto mr ON mr.id = p.marca_repuesto_id WHERE p.numero_pieza = $1', [numero]);
      const pub = await pedir('POST', '/api/vendedor/productos', {
        token: tokens.vendedor,
        body: { nombre: `Repuesto ${numero}`, marca: p.marca, numero_pieza: numero, categoria_id: p.categoria_id, universal: true, precio: 90000, stock: 3, condicion: 'nuevo' },
      });
      assert.equal(pub.status, 201);
      assert.equal(pub.datos.producto.id, p.id, 'se suma a la ficha que ya existe');
    }
  });

  it('encuentra los repuestos con las búsquedas de moto', async () => {
    const tiene = (datos, numero) => datos.productos.some((p) => p.numero_pieza === numero);
    const cadena = await buscar('cadena KTM 300 EXC');
    assert.equal(cadena.vehiculo_detectado.modelo, '300 EXC');
    assert.ok(tiene(cadena, '520ERT2-PRUEBA'));
    const did = await buscar('DID Yamaha YZ250F');
    assert.equal(did.vehiculo_detectado.modelo, 'YZ250F');
    assert.equal(did.vehiculo_detectado.texto_restante, 'did');
    assert.ok(tiene(did, '520ERT2-PRUEBA'));
    const brembo = await buscar('Brembo CRF250R');
    assert.equal(brembo.vehiculo_detectado.marca, 'Honda');
    assert.ok(tiene(brembo, '07HO-PRUEBA'));
    const crf = await buscar('Honda CRF250R');
    assert.ok(tiene(crf, '07HO-PRUEBA'));
    assert.ok(crf.productos.every((p) => !p.universal), 'los repuestos universales de autos no aparecen para una moto');    assert.equal((await buscar('CRF250R filtro')).vehiculo_detectado.modelo, 'CRF250R');
    assert.equal((await buscar('pastillas crf 250 r')).vehiculo_detectado.modelo, 'CRF250R');
    const pastillas = await buscar('pastillas Honda');
    assert.equal(pastillas.vehiculo_detectado.marca, 'Honda');
    assert.equal(pastillas.vehiculo_detectado.modelo, null);
    assert.ok(tiene(pastillas, '07HO-PRUEBA'));
    // La compatibilidad vale solo para 2018-2019 aunque la versión llegue a 2021
    assert.ok(!tiene(await buscar('pastillas CRF250R 2021'), '07HO-PRUEBA'));
    assert.ok(tiene(await buscar('pastillas CRF250R 2019'), '07HO-PRUEBA'));
    // Un modelo de moto con nombre genérico no se detecta sin la marca
    assert.equal((await buscar('repuestos blitz')).vehiculo_detectado, null);
    assert.equal((await buscar('Motomel Blitz')).vehiculo_detectado.modelo, 'Blitz');
  });

  it('filtra por rubro, por número de parte, EAN o UPC y por stock', async () => {
    const motos = (await pedir('GET', '/api/productos?rubro=motos&por_pagina=60')).datos;
    assert.ok(motos.total >= 2);
    const porUpc = (await pedir('GET', '/api/productos?codigo=012345678905')).datos;
    assert.deepEqual(porUpc.productos.map((p) => p.numero_pieza), ['520ERT2-PRUEBA']);
    const porNumero = (await pedir('GET', '/api/productos?codigo=07ho%20prueba')).datos;
    assert.equal(porNumero.productos[0]?.numero_pieza, '07HO-PRUEBA');
    const { rows: [p] } = await pool.query("SELECT id FROM productos WHERE numero_pieza = '07HO-PRUEBA'");
    await pool.query('UPDATE publicaciones SET stock = 0 WHERE producto_id = $1', [p.id]);
    assert.equal((await pedir('GET', '/api/productos?codigo=07HO-PRUEBA')).datos.total, 0);
    assert.equal((await pedir('GET', '/api/productos?codigo=07HO-PRUEBA&sin_stock=true')).datos.total, 1);
    const ficha = (await pedir('GET', `/api/productos/${p.id}`)).datos;
    assert.equal(ficha.producto.imagen_estado, 'IMAGE_MISSING');
    assert.equal(ficha.vehiculos_compatibles[0].versiones[0].compat_anio_hasta, 2019);
  });

  it('muestra qué fabrica cada marca de repuestos para motos, por categoría', async () => {
    const { rows: [pastillas] } = await pool.query(`SELECT c.slug FROM categorias c JOIN categorias g ON g.id = c.padre_id
                                                     WHERE c.nombre = 'Pastillas' AND g.nombre = 'Frenos' AND g.rubro = 'motos'`);
    const todas = (await pedir('GET', '/api/marcas-repuesto?rubro=motos')).datos;
    const brembo = todas.find((m) => m.nombre === 'Brembo');
    assert.ok(brembo.lineas.some((l) => l.nombre === 'Pastillas de freno' && l.categoria?.slug === pastillas.slug));
    assert.ok(todas.find((m) => m.nombre === 'SKF').lineas.some((l) => l.nombre === 'Rodamientos' && l.categoria === null),
      'una línea sin categoría clara queda sin categoría');
    const dePastillas = (await pedir('GET', `/api/marcas-repuesto?categoria=${pastillas.slug}`)).datos.map((m) => m.nombre);
    for (const marca of ['Brembo', 'Galfer', 'EBC', 'SBS', 'Ferodo']) assert.ok(dePastillas.includes(marca), marca);
    assert.ok(!dePastillas.includes('Michelin'));
    const { rows: grupos } = await pool.query(`SELECT g.nombre, count(h.id) AS hijas FROM categorias g JOIN categorias r ON r.id = g.padre_id
                                                LEFT JOIN categorias h ON h.padre_id = g.id
                                               WHERE r.slug = 'motos' GROUP BY g.nombre`);
    assert.ok(grupos.some((g) => g.nombre === 'Consumibles') && grupos.some((g) => g.nombre === 'Accesorios'));
    const { rows: [neumaticos] } = await pool.query(`SELECT count(*) AS tipos FROM categorias h JOIN categorias n ON n.id = h.padre_id
                                                      WHERE n.nombre = 'Neumáticos' AND n.rubro = 'motos'`);
    assert.equal(Number(neumaticos.tipos), 12);
  });

  it('importa líneas de producto de una marca nueva sin tocar código', async () => {
    const r = await api({
      entidad: 'lineas_marca_repuesto', fuente: 'catalogo-de-motos-de-prueba',
      filas: [{ marca: 'Marca de Prueba Motos', linea: 'Pastillas sinterizadas', categoria: 'Motos > Frenos > Pastillas' }],
    });
    assert.equal(r.datos.error, 0, JSON.stringify(r.datos.primeros_errores));
    const { rows: [marca] } = await pool.query("SELECT para_motos FROM marcas_repuesto WHERE nombre = 'Marca de Prueba Motos'");
    assert.equal(marca.para_motos, true);
  });

  it('no acepta imágenes de una fuente de demostración', async () => {
    const r = await api({
      entidad: 'imagenes', fuente: 'demo',
      filas: [{ entidad: 'producto', marca: 'DID', numero_pieza: '520ERT2-PRUEBA', url_imagen: 'https://example.com/cadena.jpg', permiso: 'libre' }],
    });
    assert.equal(r.datos.error, 1);
    assert.match(r.datos.primeros_errores[0].mensaje, /reales/);
  });

  it('hay casas de repuestos en todas las provincias', async () => {
    const vendedores = (await pedir('GET', '/api/vendedores')).datos;
    assert.ok(vendedores.length >= 34);
    const provincias = (await pedir('GET', '/api/referencias')).datos.provincias;
    const conVendedor = new Set(vendedores.map((v) => v.provincia));
    assert.deepEqual(provincias.filter((p) => !conVendedor.has(p)), []);
  });
});

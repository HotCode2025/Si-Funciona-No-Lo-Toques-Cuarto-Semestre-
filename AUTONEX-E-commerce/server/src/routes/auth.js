import crypto from 'node:crypto';
import multipart from '@fastify/multipart';
import bcrypt from 'bcrypt';
import { query, transaccion } from '../db.js';
import { ErrorApi } from '../errores.js';
import { dni, email, provincia, telefono, texto, textoOpcional } from '../esquemas.js';
import { config } from '../config.js';
import { consumirToken, eliminarCuenta, enviarRecuperacion, enviarVerificacion } from '../services/cuentas.js';
import { esquemaHorarios, leerHorarioTexto, normalizarHorarios, textoHorarios } from '../horarios.js';
import { MAX_BYTES_FOTO, guardarArchivo, leerImagenSubida, procesarAvatar } from '../services/fotos.js';

const password = { type: 'string', minLength: 8, maxLength: 72, pattern: '^(?=.*[A-Za-z])(?=.*[0-9]).+$' };
const tokenSchema = { type: 'string', pattern: '^[0-9a-f]{64}$' };

const datosLocal = {
  type: 'object',
  additionalProperties: false,
  required: ['nombre_comercial', 'direccion', 'ciudad', 'provincia', 'telefono'],
  properties: {
    nombre_comercial: texto(80, 3),
    descripcion: textoOpcional(600),
    direccion: texto(120, 3),
    ciudad: texto(80, 2),
    provincia,
    telefono,
    whatsapp: { type: 'string', pattern: '^[0-9]{10,15}$' },
    horario: texto(200, 3), // texto libre (versión anterior): se usa si no vienen los horarios por día
    horarios: esquemaHorarios,
  },
};

export function slugificar(texto) {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'local';
}

export async function obtenerUsuario(usuarioId) {
  const { rows: [usuario] } = await query(`
    SELECT u.id, u.email, u.nombre, u.apellido, u.telefono, u.dni, u.rol, u.email_verificado_en IS NOT NULL AS email_verificado,
           -- Foto de perfil: privada, el link lleva su clave
           (SELECT 'api/archivos/' || a.id || '?k=' || a.clave FROM archivos a WHERE a.id = u.avatar_archivo_id) AS avatar,
           CASE WHEN ve.id IS NULL THEN NULL
                ELSE json_build_object('id', ve.id, 'slug', ve.slug, 'nombre_comercial', ve.nombre_comercial,
                                       'ciudad', ve.ciudad, 'provincia', ve.provincia, 'logo', ve.logo)
           END AS vendedor
      FROM usuarios u LEFT JOIN vendedores ve ON ve.usuario_id = u.id
     WHERE u.id = $1`, [usuarioId]);
  return usuario || null;
}

export default async function rutasAuth(app) {
  // La foto de perfil llega como multipart/form-data
  await app.register(multipart, { limits: { fileSize: MAX_BYTES_FOTO, files: 1, fields: 1 } });

  const respuestaSesion = (usuario) => ({
    token: app.firmarToken({ id: usuario.id, email: usuario.email, rol: usuario.rol, vendedor_id: usuario.vendedor?.id }),
    usuario,
  });

  app.post('/auth/registro', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['email', 'password', 'nombre', 'apellido', 'rol'],
        properties: {
          email,
          password,
          nombre: texto(60, 2),
          apellido: texto(60, 2),
          telefono,
          dni,
          rol: { type: 'string', enum: ['comprador', 'vendedor'] },
          vendedor: datosLocal,
        },
      },
    },
  }, async (request, reply) => {
    const datos = request.body;
    const emailNormalizado = datos.email.toLowerCase();
    if (datos.rol === 'vendedor' && !datos.vendedor) {
      throw new ErrorApi(400, 'Para abrir tu local en AUTONEX completá los datos del comercio.');
    }

    const existente = await query('SELECT 1 FROM usuarios WHERE email = $1', [emailNormalizado]);
    if (existente.rowCount) throw new ErrorApi(409, 'Ya existe una cuenta con ese email. Probá iniciar sesión.');

    const hash = await bcrypt.hash(datos.password, 10);
    const usuarioId = await transaccion(async (db) => {
      const { rows: [u] } = await db.query(
        `INSERT INTO usuarios (email, password_hash, nombre, apellido, telefono, dni, rol)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [emailNormalizado, hash, datos.nombre, datos.apellido, datos.telefono ?? null, datos.dni ?? null, datos.rol],
      );
      if (datos.rol === 'vendedor') {
        const v = datos.vendedor;
        const horarios = v.horarios ? normalizarHorarios(v.horarios) : leerHorarioTexto(v.horario);
        if (!horarios && !v.horario) throw new ErrorApi(400, 'Indicá los días y el horario de atención del local.');
        const base = slugificar(v.nombre_comercial);
        const { rows: [{ cantidad }] } = await db.query(
          "SELECT count(*) AS cantidad FROM vendedores WHERE slug = $1 OR slug LIKE $1 || '-%'", [base]);
        const slug = cantidad ? `${base}-${cantidad + 1}` : base;
        await db.query(
          `INSERT INTO vendedores (usuario_id, slug, nombre_comercial, descripcion, direccion, ciudad, provincia,
                                   telefono, whatsapp, horario, horarios)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [u.id, slug, v.nombre_comercial, v.descripcion ?? null, v.direccion, v.ciudad, v.provincia,
            v.telefono, v.whatsapp ?? null, horarios ? textoHorarios(horarios) : v.horario, horarios ? JSON.stringify(horarios) : null],
        );
      }
      return u.id;
    });

    const usuario = await obtenerUsuario(usuarioId);
    const mail = await enviarVerificacion(usuario, request.log);
    if (config.exigirEmailConfirmado) {
      return reply.status(201).send({ requiere_confirmacion: true, email: usuario.email, rol: usuario.rol, mail_enviado: mail.enviado });
    }
    return reply.status(201).send(respuestaSesion(usuario));
  });

  // Link del mail de confirmación
  app.post('/auth/verificar-email', {
    schema: { body: { type: 'object', additionalProperties: false, required: ['token'], properties: { token: tokenSchema } } },
  }, async (request) => {
    const usuarioId = await consumirToken(request.body.token, 'verificacion');
    await query('UPDATE usuarios SET email_verificado_en = coalesce(email_verificado_en, now()) WHERE id = $1', [usuarioId]);
    const usuario = await obtenerUsuario(usuarioId);
    return { ok: true, email: usuario.email, ...respuestaSesion(usuario) };
  });

  // El cuerpo es opcional (con sesión se manda vacío), así que el email se valida acá
  app.post('/auth/reenviar-verificacion', { onRequest: app.autenticarOpcional }, async (request) => {
    if (request.user) {
      const usuario = await obtenerUsuario(request.user.id);
      if (!usuario) throw new ErrorApi(401, 'Tu cuenta ya no existe. Volvé a iniciar sesión.');
      if (usuario.email_verificado) return { ok: true, ya_verificado: true };
      await enviarVerificacion(usuario, request.log, { controlarEspera: true });
      return { ok: true, email: usuario.email };
    }
    // Sin sesión: misma respuesta exista o no la cuenta (no revela qué emails están registrados)
    const correo = typeof request.body?.email === 'string' ? request.body.email : '';
    if (!/^\S+@\S+\.\S+$/.test(correo.trim()) || correo.length > 160) throw new ErrorApi(400, 'Indicá el email de tu cuenta.');
    const { rows: [fila] } = await query('SELECT id FROM usuarios WHERE email = $1 AND email_verificado_en IS NULL', [correo.trim().toLowerCase()]);
    if (fila) {
      try {
        await enviarVerificacion(await obtenerUsuario(fila.id), request.log, { controlarEspera: true });
      } catch (error) {
        if (error.statusCode !== 429) throw error;
      }
    }
    return { ok: true, mensaje: 'Si la cuenta existe y todavía no está activa, te mandamos un link nuevo. Revisá también el correo no deseado.' };
  });

  // Eliminar la cuenta: hay que repetir la contraseña y escribir ELIMINAR
  app.post('/auth/eliminar-cuenta', {
    onRequest: app.autenticar,
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['password', 'confirmacion'],
        properties: { password: { type: 'string', minLength: 1, maxLength: 200 }, confirmacion: { type: 'string', maxLength: 20 } },
      },
    },
  }, async (request) => {
    if (request.body.confirmacion.trim().toUpperCase() !== 'ELIMINAR') {
      throw new ErrorApi(400, 'Para confirmar, escribí ELIMINAR.');
    }
    await eliminarCuenta(request.user.id, request.body.password, request.log);
    return { ok: true, mensaje: 'Eliminamos tu cuenta.' };
  });

  // "Olvidé mi contraseña": siempre responde lo mismo, exista o no la cuenta
  app.post('/auth/recuperar', {
    schema: { body: { type: 'object', additionalProperties: false, required: ['email'], properties: { email } } },
  }, async (request) => {
    await enviarRecuperacion(request.body.email, request.log);
    return { ok: true, mensaje: 'Si el email tiene una cuenta en AUTONEX, te mandamos un link para elegir una nueva contraseña.' };
  });

  // Link del mail de recuperación: guarda la nueva contraseña e inicia la sesión
  app.post('/auth/restablecer', {
    schema: {
      body: { type: 'object', additionalProperties: false, required: ['token', 'password'], properties: { token: tokenSchema, password } },
    },
  }, async (request) => {
    const hash = await bcrypt.hash(request.body.password, 10);
    const usuarioId = await transaccion(async (db) => {
      const id = await consumirToken(request.body.token, 'recuperacion', db);
      // Quien recibió el mail demostró que el email es suyo
      await db.query('UPDATE usuarios SET password_hash = $2, email_verificado_en = coalesce(email_verificado_en, now()) WHERE id = $1', [id, hash]);
      await db.query("UPDATE tokens_usuario SET usado_en = now() WHERE usuario_id = $1 AND tipo = 'recuperacion' AND usado_en IS NULL", [id]);
      return id;
    });
    return respuestaSesion(await obtenerUsuario(usuarioId));
  });

  app.post('/auth/login', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['email', 'password'],
        properties: { email: { type: 'string', maxLength: 160 }, password: { type: 'string', maxLength: 200 } },
      },
    },
  }, async (request) => {
    const { email: correo, password: clave } = request.body;
    const { rows: [fila] } = await query('SELECT id, password_hash FROM usuarios WHERE email = $1', [correo.toLowerCase()]);
    const valido = fila && (await bcrypt.compare(clave, fila.password_hash));
    if (!valido) throw new ErrorApi(401, 'El email o la contraseña no son correctos.');
    const usuario = await obtenerUsuario(fila.id);
    if (config.exigirEmailConfirmado && !usuario.email_verificado) {
      throw new ErrorApi(403, `Tu cuenta todavía no está activa: confirmá tu email con el link que te mandamos a ${usuario.email}.`,
        { motivo: 'email_sin_confirmar', email: usuario.email });
    }
    return respuestaSesion(usuario);
  });

  app.get('/auth/yo', { onRequest: app.autenticar }, async (request) => {
    const usuario = await obtenerUsuario(request.user.id);
    if (!usuario) throw new ErrorApi(401, 'Tu cuenta ya no existe. Volvé a iniciar sesión.');
    return usuario;
  });

  // ------------------------------------------------------------------ foto de perfil (opcional)
  app.put('/auth/yo/avatar', { onRequest: app.autenticar }, async (request) => {
    const { datos, nombre } = await leerImagenSubida(request);
    const foto = await procesarAvatar(datos, nombre);
    await transaccion(async (db) => {
      const { rows: [u] } = await db.query('SELECT avatar_archivo_id FROM usuarios WHERE id = $1 FOR UPDATE', [request.user.id]);
      const archivoId = await guardarArchivo(db, foto, { clave: crypto.randomBytes(16).toString('hex') });
      await db.query('UPDATE usuarios SET avatar_archivo_id = $2 WHERE id = $1', [request.user.id, archivoId]);
      if (u.avatar_archivo_id) await db.query('DELETE FROM archivos WHERE id = $1', [u.avatar_archivo_id]);
    });
    return obtenerUsuario(request.user.id);
  });

  app.delete('/auth/yo/avatar', { onRequest: app.autenticar }, async (request) => {
    const { rowCount } = await query(
      'DELETE FROM archivos WHERE id = (SELECT avatar_archivo_id FROM usuarios WHERE id = $1)', [request.user.id]);
    if (!rowCount) throw new ErrorApi(404, 'No tenés una foto de perfil.');
    return obtenerUsuario(request.user.id);
  });

  app.put('/auth/yo', {
    onRequest: app.autenticar,
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: { nombre: texto(60, 2), apellido: texto(60, 2), telefono, dni },
      },
    },
  }, async (request) => {
    const campos = Object.keys(request.body);
    const sets = campos.map((c, i) => `${c} = $${i + 2}`).join(', ');
    await query(`UPDATE usuarios SET ${sets} WHERE id = $1`, [request.user.id, ...campos.map((c) => request.body[c])]);
    return obtenerUsuario(request.user.id);
  });
}

import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { query, transaccion } from '../db.js';
import { ErrorApi } from '../errores.js';
import { enviarMail } from './mail.js';
import { mailCuentaEliminada, mailRecuperacion, mailVerificacion, urlSitio } from './plantillas-mail.js';

// Links de un solo uso para confirmar el email y recuperar la contraseña. El token viaja en el link; en la base se guarda
// solo su hash, así un acceso a la base no permite usar links pendientes.

const DURACION = { verificacion: 7 * 24 * 3600 * 1000, recuperacion: 3600 * 1000 };
const ESPERA_ENTRE_ENVIOS_MS = 60 * 1000;

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

async function crearToken(usuarioId, tipo) {
  const token = crypto.randomBytes(32).toString('hex');
  await query(
    'INSERT INTO tokens_usuario (usuario_id, tipo, token_hash, expira_en) VALUES ($1, $2, $3, $4)',
    [usuarioId, tipo, hashToken(token), new Date(Date.now() + DURACION[tipo])]);
  return token;
}

/** true si ya se mandó un link de ese tipo hace menos de un minuto (evita mandar mails en ráfaga). */
async function enviadoHacePoco(usuarioId, tipo) {
  const { rows: [ultimo] } = await query(
    'SELECT creado_en FROM tokens_usuario WHERE usuario_id = $1 AND tipo = $2 ORDER BY creado_en DESC LIMIT 1', [usuarioId, tipo]);
  return Boolean(ultimo && Date.now() - new Date(ultimo.creado_en).getTime() < ESPERA_ENTRE_ENVIOS_MS);
}

/** Valida un token vigente y sin usar; lo marca como usado y devuelve el id del usuario. */
export async function consumirToken(token, tipo, db = { query }) {
  const { rows: [fila] } = await db.query(
    `UPDATE tokens_usuario SET usado_en = now()
      WHERE token_hash = $1 AND tipo = $2 AND usado_en IS NULL AND expira_en > now()
      RETURNING usuario_id`, [hashToken(token), tipo]);
  if (!fila) {
    throw new ErrorApi(400, tipo === 'verificacion'
      ? 'El link de confirmación no es válido o ya venció. Pedí uno nuevo desde tu cuenta.'
      : 'El link para restablecer la contraseña no es válido o ya venció. Pedí uno nuevo.');
  }
  return fila.usuario_id;
}

export async function enviarVerificacion(usuario, log, { controlarEspera = false } = {}) {
  if (controlarEspera && await enviadoHacePoco(usuario.id, 'verificacion')) {
    throw new ErrorApi(429, 'Ya te mandamos un mail hace menos de un minuto. Revisá tu bandeja de entrada y el correo no deseado.');
  }
  const token = await crearToken(usuario.id, 'verificacion');
  const mail = mailVerificacion({ nombre: usuario.nombre, enlace: urlSitio(`/verificar-email?token=${token}`) });
  return enviarMail({ para: usuario.email, ...mail }, log);
}

/** Recuperación de contraseña. No revela si el email tiene cuenta: si no existe, no hace nada. */
export async function enviarRecuperacion(email, log) {
  const { rows: [usuario] } = await query('SELECT id, email, nombre FROM usuarios WHERE email = $1', [email.trim().toLowerCase()]);
  if (!usuario || await enviadoHacePoco(usuario.id, 'recuperacion')) return;
  const token = await crearToken(usuario.id, 'recuperacion');
  const mail = mailRecuperacion({ nombre: usuario.nombre, enlace: urlSitio(`/restablecer-clave?token=${token}`) });
  await enviarMail({ para: usuario.email, ...mail }, log);
}

const PEDIDO_EN_CURSO = "('pagado', 'en_preparacion', 'enviado', 'listo_para_retirar')";

/**
 * Elimina la cuenta de un comprador o de un vendedor (derecho de supresión, Ley 25.326):
 * - pide la contraseña y que no haya pedidos en curso (pagados y sin entregar), propios o del local;
 * - cancela las compras que quedaron sin pagar (las del usuario y las que incluyen productos del local);
 * - si es vendedor, pausa todas sus publicaciones y el local deja de mostrarse;
 * - reemplaza el email, el nombre, el teléfono y el DNI, y la cuenta queda sin acceso (la sesión deja de valer).
 * Las compras y los pedidos se conservan con los datos de cada compra (facturas, garantías y reclamos).
 */
export async function eliminarCuenta(usuarioId, clave, log) {
  const { rows: [u] } = await query(`
    SELECT us.id, us.email, us.nombre, us.rol, us.password_hash, ve.id AS vendedor_id
      FROM usuarios us LEFT JOIN vendedores ve ON ve.usuario_id = us.id
     WHERE us.id = $1 AND us.eliminado_en IS NULL`, [usuarioId]);
  if (!u) throw new ErrorApi(404, 'No encontramos tu cuenta.');
  if (u.rol === 'admin') throw new ErrorApi(403, 'La cuenta de administrador no se puede eliminar desde acá.');
  if (!(await bcrypt.compare(clave, u.password_hash))) throw new ErrorApi(400, 'La contraseña no es correcta.');

  const { rows: [propias] } = await query(`
    SELECT count(*)::int AS cantidad FROM pedidos pe JOIN compras co ON co.id = pe.compra_id
     WHERE co.usuario_id = $1 AND pe.estado IN ${PEDIDO_EN_CURSO}`, [u.id]);
  if (propias.cantidad > 0) {
    throw new ErrorApi(409, 'Tenés pedidos en curso: vas a poder eliminar tu cuenta cuando te los entreguen.');
  }
  if (u.vendedor_id) {
    const { rows: [delLocal] } = await query(
      `SELECT count(*)::int AS cantidad FROM pedidos WHERE vendedor_id = $1 AND estado IN ${PEDIDO_EN_CURSO}`, [u.vendedor_id]);
    if (delLocal.cantidad > 0) {
      throw new ErrorApi(409, `Tu local tiene ${delLocal.cantidad === 1 ? 'un pedido' : `${delLocal.cantidad} pedidos`} en curso: entregalos antes de eliminar la cuenta.`);
    }
  }

  await transaccion(async (db) => {
    // Compras sin pagar: las del usuario y las de otros compradores que incluyen productos del local
    const { rows: canceladas } = await db.query(`
      UPDATE compras co SET estado = 'cancelada', actualizado_en = now()
       WHERE co.estado IN ('pendiente_pago', 'pago_rechazado')
         AND (co.usuario_id = $1 OR EXISTS (SELECT 1 FROM pedidos pe WHERE pe.compra_id = co.id AND pe.vendedor_id = $2))
      RETURNING co.id`, [u.id, u.vendedor_id]);
    if (canceladas.length) {
      await db.query("UPDATE pedidos SET estado = 'cancelado', actualizado_en = now() WHERE compra_id = ANY($1::int[]) AND estado = 'pendiente_pago'",
        [canceladas.map((c) => c.id)]);
    }
    if (u.vendedor_id) {
      await db.query("UPDATE publicaciones SET estado = 'pausada', actualizado_en = now() WHERE vendedor_id = $1", [u.vendedor_id]);
    }
    await db.query('DELETE FROM archivos WHERE id = (SELECT avatar_archivo_id FROM usuarios WHERE id = $1)', [u.id]);
    await db.query(`
      UPDATE usuarios SET email = 'eliminado-' || id || '@cuenta-eliminada.invalid', nombre = 'Cuenta', apellido = 'eliminada',
             telefono = NULL, dni = NULL, password_hash = $2, email_verificado_en = NULL, eliminado_en = now()
       WHERE id = $1`, [u.id, `!eliminada-${crypto.randomBytes(16).toString('hex')}`]);
    await db.query('DELETE FROM tokens_usuario WHERE usuario_id = $1', [u.id]);
  });
  log.info?.(`Cuenta ${u.id} eliminada (${u.rol})`);
  await enviarMail({ para: u.email, ...mailCuentaEliminada({ nombre: u.nombre, esVendedor: Boolean(u.vendedor_id) }) }, log);
}

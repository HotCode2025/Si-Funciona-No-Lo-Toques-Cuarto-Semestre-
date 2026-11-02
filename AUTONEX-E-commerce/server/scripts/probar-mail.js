// Manda un mail de prueba para confirmar que el envío está bien configurado.
//   npm run mail:probar -- tu@email.com
// Usa el mismo proveedor que la app (SMTP o Resend, según server/.env) y muestra el resultado.

import { enviarMail, proveedorMail, remitente } from '../src/services/mail.js';

const para = process.argv[2];
if (!para || !/^\S+@\S+\.\S+$/.test(para)) {
  console.error('Uso: npm run mail:probar -- tu@email.com');
  process.exit(1);
}
const proveedor = proveedorMail();
if (!proveedor) {
  console.error('No hay proveedor de mails configurado: completá SMTP_USER y SMTP_PASS (o RESEND_API_KEY) en server/.env.');
  process.exit(1);
}
console.log(`Enviando por ${proveedor === 'smtp' ? 'SMTP' : 'Resend'} como ${remitente()} a ${para}…`);
const resultado = await enviarMail({
  para,
  asunto: 'Prueba de envío de AUTONEX',
  texto: 'Si te llegó este mail, los mails de AUTONEX (confirmación de email, comprobantes y recuperación de contraseña) ya salen bien.',
  html: '<p>Si te llegó este mail, los mails de <strong>AUTONEX</strong> (confirmación de email, comprobantes y recuperación de contraseña) ya salen bien.</p>',
}, console);
console.log(resultado.enviado ? `Enviado (id ${resultado.id}). Revisá la bandeja de entrada y el correo no deseado.` : `No se envió: ${resultado.error}`);
process.exit(resultado.enviado ? 0 : 1);

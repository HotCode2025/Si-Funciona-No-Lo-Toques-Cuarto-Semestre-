// Envío de mails por SMTP contra un servidor SMTP de prueba en la misma máquina (no sale ningún mail de verdad).
//   npm test

import net from 'node:net';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';

/** Servidor SMTP mínimo: acepta la autenticación (o la rechaza con 535) y guarda los mails recibidos. */
function servidorSmtp({ rechazarClave = false } = {}) {
  const recibidos = [];
  const servidor = net.createServer((socket) => {
    let enDatos = false;
    let pendiente = '';
    let actual = { de: '', para: [], cuerpo: '' };
    const responder = (linea) => socket.write(`${linea}\r\n`);
    responder('220 smtp.prueba ESMTP');
    socket.on('data', (trozo) => {
      pendiente += trozo.toString('utf8');
      let fin;
      while ((fin = pendiente.indexOf('\r\n')) >= 0) {
        const linea = pendiente.slice(0, fin);
        pendiente = pendiente.slice(fin + 2);
        if (enDatos) {
          if (linea === '.') {
            enDatos = false;
            recibidos.push(actual);
            actual = { de: '', para: [], cuerpo: '' };
            responder('250 OK: en cola');
          } else {
            actual.cuerpo += `${linea}\n`;
          }
          continue;
        }
        const comando = linea.toUpperCase();
        if (comando.startsWith('EHLO') || comando.startsWith('HELO')) socket.write('250-smtp.prueba\r\n250-AUTH PLAIN\r\n250 OK\r\n');
        else if (comando.startsWith('AUTH')) responder(rechazarClave ? '535 5.7.8 Username and Password not accepted' : '235 Autenticado');
        else if (comando.startsWith('MAIL FROM')) { actual.de = linea.slice(10); responder('250 OK'); }
        else if (comando.startsWith('RCPT TO')) { actual.para.push(linea.slice(8)); responder('250 OK'); }
        else if (comando === 'DATA') { enDatos = true; responder('354 Mandá el mail'); }
        else if (comando === 'QUIT') { responder('221 Chau'); socket.end(); }
        else responder('250 OK');
      }
    });
  });
  return new Promise((resolver) => servidor.listen(0, '127.0.0.1', () => resolver({ servidor, recibidos, puerto: servidor.address().port })));
}

describe('Mails por SMTP', () => {
  let smtp;
  let mail;
  let config;

  before(async () => {
    smtp = await servidorSmtp();
    // Variables del entorno antes de cargar la configuración (tienen prioridad sobre server/.env)
    Object.assign(process.env, {
      NODE_ENV: 'test', SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.puerto), SMTP_USER: 'autonex.prueba@gmail.com',
      SMTP_PASS: 'abcd efgh ijkl mnop', RESEND_API_KEY: '', MAIL_FROM: '', MAIL_REPLY_TO: 'consultas@autonex.test',
    });
    ({ config } = await import('../src/config.js'));
    mail = await import('../src/services/mail.js');
  });

  after(() => {
    mail?.cerrarMail();
    smtp?.servidor.close();
  });

  it('con SMTP_USER y SMTP_PASS manda por SMTP, como la cuenta de Gmail, y no por Resend', async () => {
    assert.equal(mail.proveedorMail(), 'smtp');
    assert.equal(config.mail.smtp.clave, 'abcdefghijklmnop', 'los espacios de la contraseña de aplicación se ignoran');
    assert.equal(mail.remitente(), 'AUTONEX <autonex.prueba@gmail.com>');
    const resultado = await mail.enviarMail({
      para: 'comprador@ejemplo.com', asunto: 'Confirmá tu email en AUTONEX', texto: 'Hola', html: '<p>Hola</p>', idempotencia: 'prueba-1',
    }, { info() {}, error() {} });
    assert.equal(resultado.enviado, true);
    const [recibido] = smtp.recibidos;
    assert.match(recibido.de, /autonex\.prueba@gmail\.com/);
    assert.deepEqual(recibido.para, ['<comprador@ejemplo.com>']);
    assert.match(recibido.cuerpo, /Subject: =\?UTF-8\?Q\?Confirm=C3=A1_tu_email_en_AUTONEX\?=|Subject: Confirmá tu email en AUTONEX/);
    assert.match(recibido.cuerpo, /Reply-To: consultas@autonex\.test/);
  });

  it('el remitente de prueba de Resend no se usa con SMTP; uno propio sí', () => {
    config.mail.remitente = 'AUTONEX <onboarding@resend.dev>';
    assert.equal(mail.remitente(), 'AUTONEX <autonex.prueba@gmail.com>');
    config.mail.remitente = 'AUTONEX <autonex.prueba@gmail.com>';
    assert.equal(mail.remitente(), 'AUTONEX <autonex.prueba@gmail.com>');
    config.mail.remitente = '';
  });

  it('si la cuenta rechaza la contraseña, el mail no sale pero no rompe nada y el log dice qué revisar', async () => {
    const rechazo = await servidorSmtp({ rechazarClave: true });
    mail.cerrarMail();
    config.mail.smtp.puerto = rechazo.puerto;
    const errores = [];
    const resultado = await mail.enviarMail({ para: 'otro@ejemplo.com', asunto: 'Prueba', texto: 'x', html: '<p>x</p>' }, { info() {}, error: (m) => errores.push(m) });
    mail.cerrarMail();
    rechazo.servidor.close();
    config.mail.smtp.puerto = smtp.puerto;
    assert.equal(resultado.enviado, false);
    assert.match(errores[0], /contraseña de aplicación/);
    assert.equal(rechazo.recibidos.length, 0);
  });
});

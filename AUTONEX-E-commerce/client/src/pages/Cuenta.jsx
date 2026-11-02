import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, KeyRound, MailCheck, XCircle } from 'lucide-react';
import { Cargando, ErrorMensaje } from '../components/Estados.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useAvisos } from '../context/AvisosContext.jsx';
import { api, guardarToken } from '../lib/api.js';
import { useTitulo } from '../lib/hooks.js';

// Páginas de los links que llegan por mail: confirmar el email y restablecer la contraseña. Y el pedido de recuperación.

const claveValida = (clave) => clave.length >= 8 && /[A-Za-z]/.test(clave) && /[0-9]/.test(clave);

/** /verificar-email?token=…: el link del mail de confirmación. */
export function VerificarEmail() {
  useTitulo('Confirmar email');
  const [params] = useSearchParams();
  const { usuario, iniciarConToken } = useAuth();
  const [estado, setEstado] = useState({ cargando: true, email: null, rol: null, error: null });
  const enviado = useRef(false);

  useEffect(() => {
    // Un solo pedido aunque React monte el efecto dos veces: el token es de un solo uso
    if (enviado.current) return;
    enviado.current = true;
    api('/auth/verificar-email', { method: 'POST', body: { token: params.get('token') || '' } })
      .then((r) => {
        if (r.token) iniciarConToken(r.token, r.usuario);
        setEstado({ cargando: false, email: r.email, rol: r.usuario?.rol, error: null });
      })
      .catch((error) => setEstado({ cargando: false, email: null, rol: null, error }));
  }, [params, iniciarConToken]);

  if (estado.cargando) return <div className="contenedor pagina"><Cargando texto="Confirmando tu email…" /></div>;
  return (
    <div className="contenedor pagina auth">
      <div className="tarjeta auth__tarjeta cuenta-resultado">
        {estado.email ? (
          <>
            <CheckCircle2 size={48} className="cuenta-resultado__ok" aria-hidden="true" />
            <h1>¡Listo, tu cuenta está activa!</h1>
            <p className="texto-gris">Confirmaste <strong>{estado.email}</strong>{estado.rol === 'vendedor' ? ' y tu local ya aparece en AUTONEX' : ''}. Ya ingresaste a tu cuenta.</p>
            <Link to={estado.rol === 'vendedor' ? '/panel' : '/'} className="btn btn--primario">{estado.rol === 'vendedor' ? 'Ir a mi panel' : 'Empezar a comprar'}</Link>
          </>
        ) : (
          <>
            <XCircle size={48} className="cuenta-resultado__error" aria-hidden="true" />
            <h1>No pudimos confirmar tu email</h1>
            <ErrorMensaje error={estado.error} />
            <p className="texto-gris">Pedí un link nuevo: intentá ingresar con tu email y tu contraseña y tocá "Reenviar el mail de confirmación".</p>
            <Link to={usuario ? '/' : '/ingresar'} className="btn">{usuario ? 'Ir al inicio' : 'Ingresar'}</Link>
          </>
        )}
      </div>
    </div>
  );
}

/** /recuperar-clave: pedir el link para elegir una contraseña nueva. */
export function RecuperarClave() {
  useTitulo('Recuperar contraseña');
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [mensaje, setMensaje] = useState(null);

  const enviar = async (e) => {
    e.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError({ message: 'Ingresá un email válido.' });
      return;
    }
    setEnviando(true);
    try {
      const r = await api('/auth/recuperar', { method: 'POST', body: { email: email.trim() } });
      setMensaje(r.mensaje);
    } catch (err) {
      setError(err);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="contenedor pagina auth">
      <div className="tarjeta auth__tarjeta">
        <div className="auth__cabecera">
          <KeyRound size={40} className="cuenta-resultado__icono" aria-hidden="true" />
          <h1>¿Olvidaste tu contraseña?</h1>
          <p className="texto-gris">Escribí el email de tu cuenta y te mandamos un link para elegir una nueva.</p>
        </div>
        {mensaje ? (
          <div className="pila">
            <p className="alerta alerta--exito"><MailCheck size={20} /> <span>{mensaje} Revisá también la carpeta de correo no deseado. El link vence en 1 hora.</span></p>
            <Link to="/ingresar" className="btn btn--bloque">Volver a ingresar</Link>
          </div>
        ) : (
          <form className="pila" onSubmit={enviar} noValidate>
            <ErrorMensaje error={error} />
            <div className="campo">
              <label htmlFor="recuperar-email">Email</label>
              <input id="recuperar-email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button type="submit" className="btn btn--primario btn--bloque" disabled={enviando}>{enviando ? 'Enviando…' : 'Mandarme el link'}</button>
          </form>
        )}
        <p className="auth__pie">¿Te acordaste? <Link to="/ingresar" className="enlace">Ingresá</Link></p>
      </div>
    </div>
  );
}

/** /restablecer-clave?token=…: el link del mail de recuperación. Guarda la contraseña nueva e inicia la sesión. */
export function RestablecerClave() {
  useTitulo('Elegí una contraseña nueva');
  const [params] = useSearchParams();
  const { refrescar } = useAuth();
  const { avisar } = useAvisos();
  const navegar = useNavigate();
  const [clave, setClave] = useState('');
  const [repetida, setRepetida] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const enviar = async (e) => {
    e.preventDefault();
    setError(null);
    if (!claveValida(clave)) return setError({ message: 'La contraseña necesita mínimo 8 caracteres, con al menos una letra y un número.' });
    if (clave !== repetida) return setError({ message: 'Las dos contraseñas no coinciden.' });
    setEnviando(true);
    try {
      const r = await api('/auth/restablecer', { method: 'POST', body: { token: params.get('token') || '', password: clave } });
      guardarToken(r.token);
      await refrescar();
      avisar('Listo: cambiaste tu contraseña.', 'exito');
      navegar(r.usuario.rol === 'vendedor' ? '/panel' : '/', { replace: true });
    } catch (err) {
      setError(err);
      setEnviando(false);
    }
    return undefined;
  };

  return (
    <div className="contenedor pagina auth">
      <div className="tarjeta auth__tarjeta">
        <div className="auth__cabecera">
          <KeyRound size={40} className="cuenta-resultado__icono" aria-hidden="true" />
          <h1>Elegí una contraseña nueva</h1>
        </div>
        <form className="pila" onSubmit={enviar} noValidate>
          <ErrorMensaje error={error} />
          <div className="campo">
            <label htmlFor="clave-nueva">Contraseña nueva</label>
            <input id="clave-nueva" className="input" type="password" autoComplete="new-password" value={clave} onChange={(e) => setClave(e.target.value)} />
            <span className="campo__ayuda">Mínimo 8 caracteres, con letras y números.</span>
          </div>
          <div className="campo">
            <label htmlFor="clave-repetida">Repetila</label>
            <input id="clave-repetida" className="input" type="password" autoComplete="new-password" value={repetida} onChange={(e) => setRepetida(e.target.value)} />
          </div>
          <button type="submit" className="btn btn--primario btn--bloque" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar y entrar'}</button>
        </form>
        <p className="auth__pie">¿El link venció? <Link to="/recuperar-clave" className="enlace">Pedí uno nuevo</Link></p>
      </div>
    </div>
  );
}

/** Aviso arriba de todas las páginas mientras el email de la cuenta no esté confirmado. */
export function AvisoEmailSinConfirmar() {
  const { usuario } = useAuth();
  const { avisar } = useAvisos();
  const [enviando, setEnviando] = useState(false);
  if (!usuario || usuario.email_verificado !== false) return null;

  const reenviar = async () => {
    setEnviando(true);
    try {
      await api('/auth/reenviar-verificacion', { method: 'POST' });
      avisar(`Te mandamos un link nuevo a ${usuario.email}.`, 'exito');
    } catch (err) {
      avisar(err.message, 'error', 6000);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="aviso-email" role="status">
      <div className="contenedor aviso-email__fila">
        <MailCheck size={18} aria-hidden="true" />
        <span>Confirmá tu email: te mandamos un link a <strong>{usuario.email}</strong>.</span>
        <button type="button" className="btn btn--chico" onClick={reenviar} disabled={enviando}>{enviando ? 'Enviando…' : 'Reenviar el mail'}</button>
      </div>
    </div>
  );
}

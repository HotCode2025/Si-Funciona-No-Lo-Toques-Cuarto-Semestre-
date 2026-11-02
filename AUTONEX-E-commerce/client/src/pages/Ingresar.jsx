import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Info, LogIn, MailCheck } from 'lucide-react';
import { api } from '../lib/api.js';
import { ErrorMensaje } from '../components/Estados.jsx';
import { Emblema } from '../components/Logo.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useAvisos } from '../context/AvisosContext.jsx';
import { useTitulo } from '../lib/hooks.js';

export default function Ingresar() {
  useTitulo('Ingresar');
  const { usuario, iniciarSesion } = useAuth();
  const { avisar } = useAvisos();
  const navegar = useNavigate();
  const { state } = useLocation();
  const destino = state?.desde && state.desde !== '/ingresar' ? state.desde : '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [reenviando, setReenviando] = useState(false);

  if (usuario && !enviando) return <Navigate to={destino} replace />;

  const enviar = async (e) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError({ message: 'Completá tu email y tu contraseña.' });
      return;
    }
    setEnviando(true);
    try {
      const u = await iniciarSesion(email.trim(), password);
      avisar(`¡Hola, ${u.nombre}!`);
      navegar(destino === '/' && u.rol === 'vendedor' ? '/panel' : destino, { replace: true });
    } catch (err) {
      setError(err);
      setEnviando(false);
    }
  };

  return (
    <div className="contenedor pagina auth">
      <div className="tarjeta auth__tarjeta">
        <div className="auth__cabecera">
          <span className="auth__emblema"><Emblema tamano={44} /></span>
          <h1>Ingresá a AUTONEX</h1>
          {state?.motivo && <p className="alerta alerta--info"><Info size={18} /> {state.motivo}</p>}
        </div>
        <form className="pila" onSubmit={enviar} noValidate>
          <ErrorMensaje error={error} />
          {error?.cuerpo?.motivo === 'email_sin_confirmar' && (
            <button type="button" className="btn btn--chico" disabled={reenviando} onClick={async () => {
              setReenviando(true);
              try {
                await api('/auth/reenviar-verificacion', { method: 'POST', body: { email: error.cuerpo.email } });
                avisar(`Te mandamos un link nuevo a ${error.cuerpo.email}.`, 'exito');
              } catch (err) {
                avisar(err.message, 'error', 6000);
              } finally {
                setReenviando(false);
              }
            }}>
              <MailCheck size={16} /> {reenviando ? 'Enviando…' : 'Reenviar el mail de confirmación'}
            </button>
          )}
          <div className="campo">
            <label htmlFor="email">Email</label>
            <input id="email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="password">Contraseña</label>
            <input id="password" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Link to="/recuperar-clave" className="enlace auth__olvide">¿Olvidaste tu contraseña?</Link>
          </div>
          <button type="submit" className="btn btn--primario btn--bloque" disabled={enviando}>
            <LogIn size={18} /> {enviando ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
        <p className="auth__pie">¿No tenés cuenta? <Link to="/registro" state={state} className="enlace">Creala gratis</Link></p>
      </div>
    </div>
  );
}

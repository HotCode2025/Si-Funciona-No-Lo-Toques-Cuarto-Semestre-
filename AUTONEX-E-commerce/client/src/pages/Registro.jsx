import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { MailCheck, ShoppingBag, Store, UserPlus } from 'lucide-react';
import { api } from '../lib/api.js';
import { ErrorMensaje } from '../components/Estados.jsx';
import EditorHorarios from '../components/EditorHorarios.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useAvisos } from '../context/AvisosContext.jsx';
import { useReferencias, useTitulo } from '../lib/hooks.js';
import { HORARIO_INICIAL, problemaHorarios } from '../lib/horarios.js';

const VACIO = {
  nombre: '', apellido: '', email: '', password: '', telefono: '', dni: '',
  nombre_comercial: '', direccion: '', ciudad: '', provincia: '', telefono_local: '', whatsapp: '', descripcion: '',
};

/** Validación en el navegador (la misma regla que aplica la API, que valida de nuevo). */
function validar(d, rol, horarios) {
  const errores = {};
  if (d.nombre.trim().length < 2) errores.nombre = 'Ingresá tu nombre.';
  if (d.apellido.trim().length < 2) errores.apellido = 'Ingresá tu apellido.';
  if (!/^\S+@\S+\.\S+$/.test(d.email.trim())) errores.email = 'Ingresá un email válido.';
  if (d.password.length < 8 || !/[A-Za-z]/.test(d.password) || !/[0-9]/.test(d.password)) {
    errores.password = 'Mínimo 8 caracteres, con al menos una letra y un número.';
  }
  if (d.dni && !/^[0-9]{7,8}$/.test(d.dni.trim())) errores.dni = 'El DNI tiene 7 u 8 números, sin puntos.';
  if (rol === 'vendedor') {
    if (d.nombre_comercial.trim().length < 3) errores.nombre_comercial = 'Ingresá el nombre del local.';
    if (d.direccion.trim().length < 3) errores.direccion = 'Ingresá la dirección del local.';
    if (d.ciudad.trim().length < 2) errores.ciudad = 'Ingresá la ciudad.';
    if (!d.provincia) errores.provincia = 'Elegí la provincia.';
    if (d.telefono_local.trim().length < 6) errores.telefono_local = 'Ingresá un teléfono de contacto.';
    const problema = problemaHorarios(horarios);
    if (problema) errores.horarios = problema.mensaje;
    if (d.whatsapp && !/^[0-9]{10,15}$/.test(d.whatsapp.trim())) errores.whatsapp = 'Solo números, con código de país (ej: 5493511234567).';
  }
  return errores;
}

/** Después de registrarse: la cuenta se activa con el link que llega por mail. */
function CuentaCreada({ email, rol, mailEnviado }) {
  const { avisar } = useAvisos();
  const [enviando, setEnviando] = useState(false);
  const reenviar = async () => {
    setEnviando(true);
    try {
      await api('/auth/reenviar-verificacion', { method: 'POST', body: { email } });
      avisar('Listo: si no te llegó, en un momento tenés un link nuevo.', 'exito');
    } catch (err) {
      avisar(err.message, 'error', 6000);
    } finally {
      setEnviando(false);
    }
  };
  return (
    <div className="contenedor pagina auth">
      <div className="tarjeta auth__tarjeta cuenta-resultado">
        <MailCheck size={48} className="cuenta-resultado__icono" aria-hidden="true" />
        <h1>Confirmá tu email para activar tu cuenta</h1>
        {mailEnviado === false ? (
          <p className="alerta alerta--aviso texto-chico">
            Creamos tu cuenta, pero no pudimos mandar el mail a <strong>{email}</strong> en este momento. Tocá “Reenviar el mail” en unos
            minutos; si sigue sin llegar, escribinos.
          </p>
        ) : (
          <p>Te mandamos un mail a <strong>{email}</strong> con el link para activar tu cuenta{rol === 'vendedor' ? ' y abrir tu local' : ''}.</p>
        )}
        <p className="texto-gris texto-chico">
          Hasta que no lo confirmes no vas a poder ingresar{rol === 'vendedor' ? ' y tu local no aparece en AUTONEX' : ''}. El link vence en 7 días.
          Si no lo ves, revisá el correo no deseado.
        </p>
        <button type="button" className="btn" onClick={reenviar} disabled={enviando}>{enviando ? 'Enviando…' : 'Reenviar el mail'}</button>
        <Link to="/ingresar" className="enlace texto-chico">Ya lo confirmé: ingresar</Link>
      </div>
    </div>
  );
}

export default function Registro() {
  useTitulo('Crear cuenta');
  const referencias = useReferencias();
  const { usuario, registrarse } = useAuth();
  const { avisar } = useAvisos();
  const navegar = useNavigate();
  const { state } = useLocation();
  const [rol, setRol] = useState('comprador');
  const [acepta, setAcepta] = useState(false);
  const [datos, setDatos] = useState(VACIO);
  const [horarios, setHorarios] = useState(HORARIO_INICIAL);
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [creada, setCreada] = useState(null); // { email, rol } cuando falta confirmar el email

  if (creada) return <CuentaCreada {...creada} />;
  if (usuario && !enviando) return <Navigate to="/" replace />;

  const campo = (nombre) => ({
    id: nombre,
    value: datos[nombre],
    'aria-invalid': errores[nombre] ? 'true' : undefined,
    onChange: (e) => setDatos((d) => ({ ...d, [nombre]: e.target.value })),
  });
  const ErrorCampo = ({ de }) => (errores[de] ? <span className="campo__error">{errores[de]}</span> : null);

  const enviar = async (e) => {
    e.preventDefault();
    setError(null);
    const encontrados = validar(datos, rol, horarios);
    if (!acepta) encontrados.acepta = 'Para crear la cuenta tenés que aceptar los términos y condiciones.';
    setErrores(encontrados);
    if (Object.keys(encontrados).length) return;
    setEnviando(true);
    const cuerpo = {
      email: datos.email, password: datos.password, nombre: datos.nombre, apellido: datos.apellido,
      telefono: datos.telefono || undefined, dni: datos.dni || undefined, rol,
    };
    if (rol === 'vendedor') {
      cuerpo.vendedor = {
        nombre_comercial: datos.nombre_comercial, direccion: datos.direccion, ciudad: datos.ciudad, provincia: datos.provincia,
        telefono: datos.telefono_local, whatsapp: datos.whatsapp || undefined, horarios,
        descripcion: datos.descripcion || undefined,
      };
    }
    try {
      const r = await registrarse(cuerpo);
      if (r.requiere_confirmacion) {
        setCreada({ email: r.email, rol: r.rol, mailEnviado: r.mail_enviado });
        window.scrollTo({ top: 0 });
        return;
      }
      avisar(`¡Bienvenido/a a AUTONEX, ${r.usuario.nombre}!`);
      navegar(rol === 'vendedor' ? '/panel' : state?.desde || '/', { replace: true });
    } catch (err) {
      setError(err);
      setEnviando(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="contenedor pagina auth">
      <div className="tarjeta auth__tarjeta auth__tarjeta--ancha">
        <div className="auth__cabecera">
          <h1>Creá tu cuenta</h1>
          <p className="texto-gris">Elegí cómo vas a usar AUTONEX.</p>
        </div>
        <div className="selector-rol" role="radiogroup" aria-label="Tipo de cuenta">
          <button type="button" role="radio" aria-checked={rol === 'comprador'} className={rol === 'comprador' ? 'activo' : ''} onClick={() => setRol('comprador')}>
            <ShoppingBag size={24} /><strong>Quiero comprar</strong><small>Buscá repuestos para tu auto</small>
          </button>
          <button type="button" role="radio" aria-checked={rol === 'vendedor'} className={rol === 'vendedor' ? 'activo' : ''} onClick={() => setRol('vendedor')}>
            <Store size={24} /><strong>Tengo una casa de repuestos</strong><small>Publicá y vendé en todo el país</small>
          </button>
        </div>

        <form onSubmit={enviar} noValidate className="pila">
          <ErrorMensaje error={error} titulo="No pudimos crear la cuenta" />
          <h2 className="subtitulo-form">Tus datos</h2>
          <div className="grilla-form">
            <div className="campo"><label htmlFor="nombre">Nombre</label><input className="input" autoComplete="given-name" {...campo('nombre')} /><ErrorCampo de="nombre" /></div>
            <div className="campo"><label htmlFor="apellido">Apellido</label><input className="input" autoComplete="family-name" {...campo('apellido')} /><ErrorCampo de="apellido" /></div>
            <div className="campo"><label htmlFor="email">Email</label><input className="input" type="email" autoComplete="email" {...campo('email')} /><ErrorCampo de="email" /></div>
            <div className="campo"><label htmlFor="password">Contraseña</label><input className="input" type="password" autoComplete="new-password" {...campo('password')} />
              <span className="campo__ayuda">Mínimo 8 caracteres, con letras y números.</span><ErrorCampo de="password" /></div>
            <div className="campo"><label htmlFor="telefono">Teléfono <small className="texto-gris">(opcional)</small></label><input className="input" type="tel" autoComplete="tel" {...campo('telefono')} /></div>
            <div className="campo"><label htmlFor="dni">DNI <small className="texto-gris">(opcional)</small></label><input className="input" inputMode="numeric" {...campo('dni')} /><ErrorCampo de="dni" /></div>
          </div>

          {rol === 'vendedor' && (
            <>
              <h2 className="subtitulo-form">Datos del local</h2>
              <div className="grilla-form">
                <div className="campo ancho-total"><label htmlFor="nombre_comercial">Nombre comercial</label><input className="input" {...campo('nombre_comercial')} /><ErrorCampo de="nombre_comercial" /></div>
                <div className="campo"><label htmlFor="direccion">Dirección</label><input className="input" placeholder="Av. Colón 1450" {...campo('direccion')} /><ErrorCampo de="direccion" /></div>
                <div className="campo"><label htmlFor="ciudad">Ciudad</label><input className="input" {...campo('ciudad')} /><ErrorCampo de="ciudad" /></div>
                <div className="campo"><label htmlFor="provincia">Provincia</label>
                  <select className="select" {...campo('provincia')}>
                    <option value="">Elegí…</option>
                    {referencias?.provincias.map((p) => <option key={p}>{p}</option>)}
                  </select><ErrorCampo de="provincia" /></div>
                <div className="campo"><label htmlFor="telefono_local">Teléfono del local</label><input className="input" type="tel" {...campo('telefono_local')} /><ErrorCampo de="telefono_local" /></div>
                <div className="campo"><label htmlFor="whatsapp">WhatsApp <small className="texto-gris">(opcional)</small></label><input className="input" inputMode="numeric" placeholder="5493511234567" {...campo('whatsapp')} /><ErrorCampo de="whatsapp" /></div>
                <div className="campo ancho-total"><label htmlFor="descripcion">Descripción <small className="texto-gris">(opcional)</small></label><textarea className="textarea" {...campo('descripcion')} /></div>
                <div className="campo ancho-total"><span className="campo__etiqueta">Días y horario de atención</span>
                  <EditorHorarios valor={horarios} alCambiar={setHorarios} /></div>
              </div>
            </>
          )}

          <div className="campo">
            <label className="check legal__acepto">
              <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} aria-invalid={errores.acepta ? 'true' : undefined} />
              <span>
                Leí y acepto los <Link to="/terminos" target="_blank" className="enlace">Términos y condiciones</Link>
                {rol === 'vendedor' && <>, los <Link to="/terminos-vendedores" target="_blank" className="enlace">Términos para vendedores</Link></>}
                {' '}y la <Link to="/privacidad" target="_blank" className="enlace">Política de privacidad</Link>.
              </span>
            </label>
            <ErrorCampo de="acepta" />
          </div>

          <button type="submit" className="btn btn--primario btn--bloque" disabled={enviando}>
            <UserPlus size={18} /> {enviando ? 'Creando cuenta…' : rol === 'vendedor' ? 'Crear cuenta y abrir mi local' : 'Crear cuenta'}
          </button>
        </form>
        <p className="auth__pie">¿Ya tenés cuenta? <Link to="/ingresar" state={state} className="enlace">Ingresá</Link></p>
      </div>
    </div>
  );
}

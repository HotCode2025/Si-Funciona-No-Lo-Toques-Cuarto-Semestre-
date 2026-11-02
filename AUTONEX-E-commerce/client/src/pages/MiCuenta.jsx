import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, Camera, Save, Trash2, UserRound } from 'lucide-react';
import { ErrorMensaje } from '../components/Estados.jsx';
import Avatar from '../components/Avatar.jsx';
import CambiarImagen from '../components/CambiarImagen.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useAvisos } from '../context/AvisosContext.jsx';
import { api } from '../lib/api.js';
import { useTitulo } from '../lib/hooks.js';

/** Mis datos (nombre, apellido, teléfono y DNI) y la opción de eliminar la cuenta. */
export default function MiCuenta() {
  useTitulo('Mi cuenta');
  const { usuario, refrescar } = useAuth();
  const { avisar } = useAvisos();
  const [datos, setDatos] = useState({
    nombre: usuario.nombre || '', apellido: usuario.apellido || '', telefono: usuario.telefono || '', dni: usuario.dni || '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const guardar = async (e) => {
    e.preventDefault();
    setError(null);
    const cuerpo = { nombre: datos.nombre.trim(), apellido: datos.apellido.trim() };
    if (datos.telefono.trim()) cuerpo.telefono = datos.telefono.trim();
    if (datos.dni.trim()) cuerpo.dni = datos.dni.trim();
    setGuardando(true);
    try {
      await api('/auth/yo', { method: 'PUT', body: cuerpo });
      await refrescar();
      avisar('Guardamos tus datos.', 'exito');
    } catch (err) {
      setError(err);
    } finally {
      setGuardando(false);
    }
  };

  const campo = (nombre) => ({ id: `cuenta-${nombre}`, value: datos[nombre], onChange: (e) => setDatos((d) => ({ ...d, [nombre]: e.target.value })) });

  return (
    <div className="contenedor pagina mi-cuenta">
      <h1 className="titulo-seccion">Mi cuenta</h1>

      <section className="tarjeta tarjeta--padding pila mi-cuenta__foto">
        <h2 className="subtitulo-form"><Camera size={18} /> Foto de perfil <small className="texto-gris">(opcional)</small></h2>
        <CambiarImagen id="foto-perfil" ruta="/auth/yo/avatar" campo="avatar" tiene={Boolean(usuario.avatar)} alCambiar={() => refrescar()}
          textos={{
            subir: 'Subir foto', cambiar: 'Cambiar foto', subida: 'Actualizamos tu foto de perfil.', quitada: 'Quitamos tu foto de perfil.',
            confirmarQuitar: '¿Quitar tu foto de perfil?',
          }}
          ayuda="JPG, PNG o WebP de hasta 8 MB. Se recorta en forma cuadrada. Se ve en tu cuenta; si la quitás o eliminás la cuenta, la borramos.">
          <Avatar src={usuario.avatar} nombre={`${usuario.nombre} ${usuario.apellido}`} className="mi-cuenta__avatar" />
        </CambiarImagen>
      </section>

      <form className="tarjeta tarjeta--padding pila" onSubmit={guardar}>
        <h2 className="subtitulo-form"><UserRound size={18} /> Mis datos</h2>
        <p className="texto-gris texto-chico">Email de la cuenta: <strong>{usuario.email}</strong></p>
        <div className="grilla-form">
          <div className="campo"><label htmlFor="cuenta-nombre">Nombre</label><input className="input" autoComplete="given-name" {...campo('nombre')} /></div>
          <div className="campo"><label htmlFor="cuenta-apellido">Apellido</label><input className="input" autoComplete="family-name" {...campo('apellido')} /></div>
          <div className="campo"><label htmlFor="cuenta-telefono">Teléfono <small className="texto-gris">(opcional)</small></label><input className="input" type="tel" autoComplete="tel" {...campo('telefono')} /></div>
          <div className="campo"><label htmlFor="cuenta-dni">DNI <small className="texto-gris">(opcional)</small></label><input className="input" inputMode="numeric" {...campo('dni')} /></div>
        </div>
        <ErrorMensaje error={error} />
        <div><button type="submit" className="btn btn--primario" disabled={guardando}><Save size={18} /> {guardando ? 'Guardando…' : 'Guardar cambios'}</button></div>
        {usuario.rol === 'vendedor' && (
          <p className="texto-chico texto-gris">Los datos de tu local (dirección, horario, WhatsApp) se editan en <Link to="/panel/local" className="enlace">Panel → Mi local</Link>.</p>
        )}
      </form>

      {usuario.rol !== 'admin' && <EliminarCuenta esVendedor={usuario.rol === 'vendedor'} />}
    </div>
  );
}

function EliminarCuenta({ esVendedor }) {
  const { cerrarSesion } = useAuth();
  const { avisar } = useAvisos();
  const navegar = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const listo = password && confirmacion.trim().toUpperCase() === 'ELIMINAR';

  const eliminar = async (e) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await api('/auth/eliminar-cuenta', { method: 'POST', body: { password, confirmacion } });
      cerrarSesion();
      avisar('Eliminamos tu cuenta. Te mandamos un mail de confirmación.', 'exito', 7000);
      navegar('/', { replace: true });
    } catch (err) {
      setError(err);
      setEnviando(false);
    }
  };

  return (
    <section className="tarjeta tarjeta--padding pila mi-cuenta__peligro">
      <h2 className="subtitulo-form"><Trash2 size={18} /> Eliminar mi cuenta</h2>
      <ul className="texto-chico">
        <li>Se borran tus datos personales de la cuenta y ya no vas a poder ingresar. <strong>No se puede deshacer.</strong></li>
        {esVendedor && <li>Tu local se da de baja: tus publicaciones se pausan y el local deja de aparecer en AUTONEX.</li>}
        <li>Las compras sin pagar se cancelan. Las compras y los pedidos ya hechos se conservan con los datos de cada compra, porque la ley exige guardarlos para facturas, garantías y reclamos.</li>
        <li>Si tenés pedidos en curso{esVendedor ? ' (tuyos o de tu local)' : ''}, primero tienen que estar entregados.</li>
        <li>Después podés volver a crear una cuenta con el mismo email.</li>
      </ul>
      {!abierto ? (
        <div><button type="button" className="btn btn--peligro" onClick={() => setAbierto(true)}><Trash2 size={18} /> Quiero eliminar mi cuenta</button></div>
      ) : (
        <form className="pila" onSubmit={eliminar}>
          <p className="alerta alerta--aviso"><AlertTriangle size={18} /> <span>Para confirmar, escribí tu contraseña y la palabra <strong>ELIMINAR</strong>.</span></p>
          <div className="grilla-form">
            <div className="campo"><label htmlFor="eliminar-clave">Contraseña</label>
              <input id="eliminar-clave" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <div className="campo"><label htmlFor="eliminar-confirmacion">Escribí ELIMINAR</label>
              <input id="eliminar-confirmacion" className="input" autoComplete="off" value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} /></div>
          </div>
          <ErrorMensaje error={error} titulo="No pudimos eliminar la cuenta" />
          <div className="fila fila--envolver">
            <button type="button" className="btn" onClick={() => { setAbierto(false); setPassword(''); setConfirmacion(''); setError(null); }}>Cancelar</button>
            <button type="submit" className="btn btn--peligro" disabled={!listo || enviando}><Trash2 size={18} /> {enviando ? 'Eliminando…' : 'Eliminar mi cuenta definitivamente'}</button>
          </div>
        </form>
      )}
    </section>
  );
}

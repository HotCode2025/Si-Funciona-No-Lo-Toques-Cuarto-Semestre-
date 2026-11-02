import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Save } from 'lucide-react';
import { Cargando, ErrorMensaje } from '../../components/Estados.jsx';
import EditorHorarios from '../../components/EditorHorarios.jsx';
import Avatar from '../../components/Avatar.jsx';
import CambiarImagen from '../../components/CambiarImagen.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useAvisos } from '../../context/AvisosContext.jsx';
import { api } from '../../lib/api.js';
import { useApi, useReferencias, useTitulo } from '../../lib/hooks.js';
import { HORARIO_INICIAL, problemaHorarios } from '../../lib/horarios.js';

const CAMPOS = ['nombre_comercial', 'descripcion', 'direccion', 'ciudad', 'provincia', 'telefono', 'whatsapp'];

export default function PanelLocal() {
  useTitulo('Mi local');
  const referencias = useReferencias();
  const { refrescar } = useAuth();
  const { avisar } = useAvisos();
  const perfil = useApi('/vendedor/perfil');
  const [datos, setDatos] = useState(null);
  const [horarios, setHorarios] = useState(null);
  const [logo, setLogo] = useState(null);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!perfil.datos) return;
    setDatos(Object.fromEntries(CAMPOS.map((c) => [c, perfil.datos[c] || ''])));
    setHorarios(perfil.datos.horarios || HORARIO_INICIAL);
    setLogo({ ruta: perfil.datos.logo, subido: perfil.datos.logo_subido });
  }, [perfil.datos]);

  if (perfil.cargando || !datos) return <Cargando />;

  const campo = (nombre) => ({ id: nombre, value: datos[nombre], onChange: (e) => setDatos((d) => ({ ...d, [nombre]: e.target.value })) });

  const guardar = async (e) => {
    e.preventDefault();
    const problema = problemaHorarios(horarios);
    if (problema) return setError({ message: `Revisá el horario de atención: ${problema.mensaje}` });
    setGuardando(true);
    setError(null);
    try {
      perfil.setDatos(await api('/vendedor/perfil', { method: 'PUT', body: { ...datos, horarios } }));
      await refrescar();
      avisar('Datos del local actualizados.');
    } catch (err) {
      setError(err);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form className="tarjeta tarjeta--padding pila panel-local" onSubmit={guardar}>
      <p className="texto-gris">Estos datos se muestran en tu página y en el checkout cuando el comprador elige <strong>retiro en el local</strong>.</p>
      <ErrorMensaje error={error} titulo="No se pudo guardar" />
      <div className="campo">
        <span className="campo__etiqueta">Logo del local</span>
        <CambiarImagen id="logo-local" ruta="/vendedor/logo" campo="logo" tiene={logo.subido}
          alCambiar={async (r) => { setLogo({ ruta: r.logo, subido: r.logo_subido }); await refrescar(); }}
          textos={{
            subir: 'Subir logo', cambiar: 'Cambiar logo', subida: 'Actualizamos el logo del local.', quitada: 'Quitamos el logo que subiste.',
            confirmarQuitar: '¿Quitar el logo del local?',
          }}
          ayuda="Se ve en tu página, en el listado de vendedores y en las ofertas de tus productos. JPG, PNG o WebP de hasta 8 MB; si no es cuadrado, lo completamos con blanco.">
          <Avatar src={logo.ruta} nombre={datos.nombre_comercial} redondo={false} className="panel-local__logo" />
        </CambiarImagen>
      </div>
      <div className="grilla-form">
        <div className="campo ancho-total"><label htmlFor="nombre_comercial">Nombre comercial</label><input className="input" {...campo('nombre_comercial')} /></div>
        <div className="campo ancho-total"><label htmlFor="descripcion">Descripción</label><textarea className="textarea" {...campo('descripcion')} /></div>
        <div className="campo"><label htmlFor="direccion">Dirección</label><input className="input" {...campo('direccion')} /></div>
        <div className="campo"><label htmlFor="ciudad">Ciudad</label><input className="input" {...campo('ciudad')} /></div>
        <div className="campo"><label htmlFor="provincia">Provincia</label>
          <select className="select" {...campo('provincia')}>{referencias?.provincias.map((p) => <option key={p}>{p}</option>)}</select></div>
        <div className="campo"><label htmlFor="telefono">Teléfono</label><input className="input" type="tel" {...campo('telefono')} /></div>
        <div className="campo"><label htmlFor="whatsapp">WhatsApp (con código de país)</label><input className="input" inputMode="numeric" {...campo('whatsapp')} /></div>
      </div>
      <fieldset className="panel-local__horarios">
        <legend>Días y horario de atención</legend>
        {!perfil.datos.horarios && perfil.datos.horario && (
          <p className="alerta alerta--info texto-chico">Tu horario anterior era “{perfil.datos.horario}”. Cargalo por día y guardá los cambios.</p>
        )}
        <EditorHorarios valor={horarios} alCambiar={setHorarios} />
      </fieldset>
      <div><button type="submit" className="btn btn--primario" disabled={guardando}><Save size={18} /> {guardando ? 'Guardando…' : 'Guardar cambios'}</button>
        <p className="texto-chico texto-gris">¿Querés cerrar tu local? Podés eliminar tu cuenta desde <Link to="/mi-cuenta" className="enlace">Mi cuenta</Link>.</p></div>
    </form>
  );
}

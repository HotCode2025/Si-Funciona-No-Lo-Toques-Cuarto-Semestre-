import { useState } from 'react';
import { Trash2, Upload } from 'lucide-react';
import { ErrorMensaje } from './Estados.jsx';
import { useAvisos } from '../context/AvisosContext.jsx';
import { api } from '../lib/api.js';

const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_MB = 8;

/**
 * Subir, cambiar o quitar una imagen (logo del local o foto de perfil). Sube apenas se elige el archivo: PUT `ruta`
 * con el archivo en el campo `campo`; quitar es DELETE `ruta`. `alCambiar` recibe la respuesta de la API.
 */
export default function CambiarImagen({ id, ruta, campo, tiene, alCambiar, textos, ayuda, children }) {
  const { avisar } = useAvisos();
  const [ocupado, setOcupado] = useState(null);
  const [error, setError] = useState(null);

  const ejecutar = async (que, accion, mensaje) => {
    setOcupado(que);
    setError(null);
    try {
      await alCambiar(await accion());
      avisar(mensaje);
    } catch (err) {
      setError(err);
    } finally {
      setOcupado(null);
    }
  };

  const subir = (archivo) => {
    if (!archivo) return;
    if (!TIPOS.includes(archivo.type)) return setError({ message: 'Elegí una imagen JPG, PNG o WebP.' });
    if (archivo.size > MAX_MB * 1024 * 1024) return setError({ message: `La imagen pesa más de ${MAX_MB} MB.` });
    const datos = new FormData();
    datos.append(campo, archivo, archivo.name);
    return ejecutar('subir', () => api(ruta, { method: 'PUT', body: datos }), textos.subida);
  };
  const quitar = () => {
    if (!window.confirm(textos.confirmarQuitar)) return;
    ejecutar('quitar', () => api(ruta, { method: 'DELETE' }), textos.quitada);
  };

  return (
    <div className="cambiar-imagen">
      {children}
      <div className="cambiar-imagen__acciones">
        <div className="fila fila--envolver">
          <label className={`btn btn--chico ${ocupado ? 'btn--deshabilitado' : ''}`} htmlFor={id}>
            <Upload size={15} /> {ocupado === 'subir' ? 'Subiendo…' : tiene ? textos.cambiar : textos.subir}
            <input id={id} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={Boolean(ocupado)}
              onChange={(e) => { subir(e.target.files[0]); e.target.value = ''; }} />
          </label>
          {tiene && (
            <button type="button" className="btn btn--chico btn--fantasma" disabled={Boolean(ocupado)} onClick={quitar}>
              <Trash2 size={15} /> {ocupado === 'quitar' ? 'Quitando…' : 'Quitar'}
            </button>
          )}
        </div>
        {ayuda && <small className="texto-gris">{ayuda}</small>}
        <ErrorMensaje error={error} />
      </div>
    </div>
  );
}

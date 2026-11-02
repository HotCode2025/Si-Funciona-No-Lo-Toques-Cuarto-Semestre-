import { Link } from 'react-router-dom';
import { Wrench } from 'lucide-react';
import { Vacio } from '../components/Estados.jsx';
import { useTitulo } from '../lib/hooks.js';

export default function NoEncontrado() {
  useTitulo('Página no encontrada');
  return (
    <div className="contenedor pagina">
      <Vacio icono={Wrench} titulo="Esta página no existe (error 404)"
        accion={<><Link to="/" className="btn btn--primario">Ir al inicio</Link><Link to="/catalogo" className="btn">Ver catálogo</Link></>}>
        Puede que el enlace esté roto o que la página se haya movido.
      </Vacio>
    </div>
  );
}

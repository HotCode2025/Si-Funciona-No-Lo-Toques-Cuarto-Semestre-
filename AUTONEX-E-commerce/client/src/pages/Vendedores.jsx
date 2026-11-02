import { Link } from 'react-router-dom';
import { Clock, MapPin, Recycle } from 'lucide-react';
import { Cargando, ErrorMensaje } from '../components/Estados.jsx';
import Avatar from '../components/Avatar.jsx';
import { useApi, useTitulo } from '../lib/hooks.js';
import { plural } from '../lib/formato.js';
import { estadoAhora } from '../lib/horarios.js';

export default function Vendedores() {
  useTitulo('Vendedores');
  const { datos, error, cargando } = useApi('/vendedores');
  return (
    <div className="contenedor pagina">
      <nav className="migas" aria-label="Ubicación"><Link to="/">Inicio</Link><span aria-hidden="true">/</span><span>Vendedores</span></nav>
      <h1 className="titulo-seccion">Casas de repuestos en AUTONEX</h1>
      <p className="texto-gris">Comercios de todo el país publican sus repuestos. Podés comprarle a varios en el mismo carrito.</p>
      {cargando && <Cargando />}
      <ErrorMensaje error={error} />
      <div className="grilla-tarjetas-vendedor">
        {datos?.map((v) => (
          <Link key={v.slug} to={`/vendedores/${v.slug}`} className="tarjeta-vendedor">
            <Avatar src={v.logo} nombre={v.nombre_comercial} redondo={false} className="tarjeta-vendedor__logo" />
            <div className="tarjeta-vendedor__cuerpo">
              <h2>{v.nombre_comercial}</h2>
              {v.es_desarmadero && <span className="etiqueta-desarmadero"><Recycle size={14} /> Desarmadero · repuestos usados</span>}
              <p className="texto-chico"><MapPin size={14} /> {v.direccion}, {v.ciudad}, {v.provincia}</p>
              <p className="texto-chico texto-gris"><Clock size={14} /> {v.horario}</p>
              {v.horarios && (estadoAhora(v.horarios).abierto
                ? <span className="estado estado--verde tarjeta-vendedor__abierto">Abierto ahora</span>
                : <span className="estado estado--gris tarjeta-vendedor__abierto">Cerrado ahora</span>)}
              <span className="tarjeta-vendedor__pie">{plural(v.publicaciones, 'publicación activa', 'publicaciones activas')}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

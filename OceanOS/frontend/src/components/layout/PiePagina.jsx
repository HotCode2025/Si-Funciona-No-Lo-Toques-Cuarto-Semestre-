import { Link } from 'react-router-dom';
import { Marca } from '../marca/Logo.jsx';

/**
 * Los cinco de Los Sin Chamba. Van en el pie porque el profesor los busca
 * en el sitio, no solo en la carátula del informe.
 */
const EQUIPO = [
  'Lautaro Martinez',
  'Leandro Orozco',
  'Gabriel Maculus',
  'Jose Rodriguez',
  'Otar',
];

export default function PiePagina() {
  return (
    <footer className="border-t border-columna bg-abismo px-5 py-10 text-carta lg:px-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 sm:flex-row sm:justify-between">
        <div className="max-w-xs">
          <Marca claro />
          <p className="mt-3 text-sm text-sonda">
            Restauramos ecosistemas y los convertimos en activos verificables.
          </p>
          <p className="mt-4 text-xs text-sonda/70">
            Los Sin Chamba · Puerto Madryn, Chubut, Argentina
          </p>
        </div>

        <nav className="flex flex-wrap gap-x-12 gap-y-8 text-sm">
          <div>
            <p className="mb-2 font-500">Plataforma</p>
            <ul className="space-y-1.5 text-sonda">
              <li><Link to="/funciones" className="hover:text-carta">Todas las funciones</Link></li>
              <li><Link to="/ecosistema" className="hover:text-carta">Estado del océano</Link></li>
              <li><Link to="/mercado" className="hover:text-carta">Activos</Link></li>
              <li><Link to="/app" className="hover:text-carta">App ciudadana</Link></li>
              <li><Link to="/panel" className="hover:text-carta">Panel de organizaciones</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-2 font-500">Equipo</p>
            <ul className="space-y-1.5 text-sonda">
              {EQUIPO.map((nombre) => <li key={nombre}>{nombre}</li>)}
            </ul>
            <p className="mt-3 text-xs text-sonda/70">UTN · Tecnicatura en Programación</p>
          </div>
          <div>
            <p className="mb-2 font-500">Alianzas</p>
            <ul className="space-y-1.5 text-sonda">
              <li>CONICET · CENPAT</li>
              <li>Secretaría de Pesca</li>
              <li>Rewilding Argentina</li>
            </ul>
          </div>
        </nav>
      </div>
    </footer>
  );
}

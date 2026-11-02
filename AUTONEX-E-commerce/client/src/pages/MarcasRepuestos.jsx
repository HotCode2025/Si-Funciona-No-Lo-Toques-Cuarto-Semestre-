import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import TarjetaMarcaRepuesto from '../components/MarcaRepuesto.jsx';
import { Cargando, ErrorMensaje } from '../components/Estados.jsx';
import { useApi, useTitulo } from '../lib/hooks.js';
import { normalizar } from '../lib/formato.js';

/** Marcas de repuestos para motos y qué fabrica cada una (filtros, frenos, cadenas, suspensión, neumáticos…). */
export default function MarcasRepuestos() {
  useTitulo('Marcas de repuestos para motos');
  const { datos, error, cargando } = useApi('/marcas-repuesto?rubro=motos');
  const [texto, setTexto] = useState('');
  const lista = useMemo(() => {
    const t = normalizar(texto);
    const marcas = (datos || []).filter((m) => m.lineas.length > 0);
    return t ? marcas.filter((m) => normalizar(`${m.nombre} ${m.lineas.map((l) => l.nombre).join(' ')}`).includes(t)) : marcas;
  }, [datos, texto]);

  return (
    <div className="contenedor pagina">
      <nav className="migas" aria-label="Ubicación">
        <Link to="/">Inicio</Link><span aria-hidden="true">/</span>
        <Link to="/catalogo?categoria=motos">Motos</Link><span aria-hidden="true">/</span>
        <span>Marcas de repuestos</span>
      </nav>
      <h1 className="titulo-seccion">Marcas de repuestos para motos</h1>
      <p className="texto-gris">
        Qué fabrica cada marca: tocá una línea para ver esa categoría del catálogo. Los repuestos con número de parte,
        precio, stock y compatibilidad aparecen cuando una casa de repuestos o un distribuidor publica su catálogo.
      </p>
      <label className="selector__buscar marcas-repuesto__buscar">
        <Search size={16} aria-hidden="true" />
        <input className="input" type="search" value={texto} onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar marca o repuesto (ej: Brembo, cadenas, neumáticos enduro)" aria-label="Buscar marca o repuesto" />
      </label>
      {cargando && <Cargando texto="Cargando marcas…" />}
      {error && <ErrorMensaje error={error} />}
      {datos && (
        <>
          <p className="texto-chico texto-gris">{lista.length} marcas</p>
          <div className="marcas-repuesto">
            {lista.map((m) => <TarjetaMarcaRepuesto key={m.id} marca={m} />)}
          </div>
          {!lista.length && <p className="texto-gris">No hay marcas con “{texto}”.</p>}
          <p className="texto-chico texto-gris marcas-repuesto__fuente">
            Lista de marcas y líneas de producto de AUTONEX, sin verificar con cada fabricante. Los logos son marcas
            registradas de sus dueños (ver <Link to="/creditos">créditos</Link>).
          </p>
        </>
      )}
    </div>
  );
}

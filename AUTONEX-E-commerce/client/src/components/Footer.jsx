import { Link } from 'react-router-dom';
import { CreditCard, ShieldCheck, Truck, Undo2 } from 'lucide-react';
import Logo from './Logo.jsx';
import { categoriasRaiz, useCategorias, useReferencias } from '../lib/hooks.js';
import { URL_DEFENSA_CONSUMIDOR } from '../pages/Legales.jsx';

export default function Footer() {
  const categorias = categoriasRaiz(useCategorias());
  const referencias = useReferencias();
  return (
    <footer className="footer">
      <div className="footer__garantias">
        <div className="contenedor footer__garantias-fila">
          <div><Truck size={26} aria-hidden="true" /><span><strong>Envíos a todo el país</strong> Andreani, OCA, Correo Argentino o moto en tu ciudad</span></div>
          <div><CreditCard size={26} aria-hidden="true" /><span><strong>Pagás con Mercado Pago</strong> Tarjetas, débito y dinero en cuenta</span></div>
          <div><ShieldCheck size={26} aria-hidden="true" /><span><strong>Compatibilidad con su fuente</strong> Te mostramos qué está verificado y qué no</span></div>
        </div>
      </div>
      <div className="contenedor footer__principal">
        <div className="footer__marca">
          <Logo conLema />
          <p>Comparamos ofertas de casas de repuestos de todo el país para que encuentres la pieza justa para tu auto o camioneta.</p>
        </div>
        <div>
          <h4>Categorías</h4>
          <ul>
            {categorias.slice(0, 5).map((c) => <li key={c.slug}><Link to={`/catalogo?categoria=${c.slug}`}>{c.nombre}</Link></li>)}
          </ul>
        </div>
        <div>
          <h4>&nbsp;</h4>
          <ul>
            {categorias.slice(5).map((c) => <li key={c.slug}><Link to={`/catalogo?categoria=${c.slug}`}>{c.nombre}</Link></li>)}
          </ul>
        </div>
        <div>
          <h4>AUTONEX</h4>
          <ul>
            <li><Link to="/vendedores">Vendedores</Link></li>
            <li><Link to="/marcas-repuestos">Marcas de repuestos para motos</Link></li>
            <li><Link to="/mis-compras">Mis compras</Link></li>
            <li><Link to="/seguir-compra">Seguí tu compra (sin cuenta)</Link></li>
            <li><Link to="/registro">Vendé en AUTONEX</Link></li>
          </ul>
        </div>
        <div>
          <h4>Legales</h4>
          <ul>
            <li><Link to="/terminos">Términos y condiciones</Link></li>
            <li><Link to="/terminos-vendedores">Términos para vendedores</Link></li>
            <li><Link to="/privacidad">Política de privacidad</Link></li>
            <li><Link to="/arrepentimiento">Botón de arrepentimiento</Link></li>
          </ul>
        </div>
      </div>
      <div className="footer__legales">
        <div className="contenedor footer__legales-fila">
          <Link to="/arrepentimiento" className="footer__arrepentimiento"><Undo2 size={16} aria-hidden="true" /> Botón de arrepentimiento</Link>
          <nav aria-label="Reclamos" className="footer__legales-enlaces">
            <a href={URL_DEFENSA_CONSUMIDOR} target="_blank" rel="noopener noreferrer">Defensa de las y los Consumidores. Para reclamos ingrese aquí</a>
          </nav>
          {(referencias?.operador?.razonSocial || referencias?.operador?.cuit) && (
            <span className="footer__titular">
              {[referencias.operador.razonSocial, referencias.operador.cuit && `CUIT ${referencias.operador.cuit}`, referencias.operador.domicilio, referencias.operador.email].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>
      </div>
      <div className="footer__legal">
        <div className="contenedor fila fila--entre fila--envolver">
          <span>© {new Date().getFullYear()} AUTONEX · Proyecto universitario de demostración. Los vendedores, precios y repuestos son ficticios{referencias?.totales ? `; las ${referencias.totales.versiones.toLocaleString('es-AR')} versiones de vehículos son reales` : ''}.</span>
          <span>Fotos: Wikimedia Commons · Vehículos: datos abiertos del DNRPA · <Link to="/creditos">fuentes y créditos</Link></span>
        </div>
      </div>
    </footer>
  );
}

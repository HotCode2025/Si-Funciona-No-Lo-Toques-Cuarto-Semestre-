import { Link, NavLink, Route, Routes } from 'react-router-dom';
import { ClipboardList, ExternalLink, LayoutDashboard, PackageCheck, PackageOpen, Settings, Tag, TrendingUp, Undo2 } from 'lucide-react';
import { Cargando, ErrorMensaje } from '../../components/Estados.jsx';
import Avatar from '../../components/Avatar.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useApi, useTitulo } from '../../lib/hooks.js';
import { precio } from '../../lib/formato.js';
import PanelPedidos from './PanelPedidos.jsx';
import PanelPublicaciones from './PanelPublicaciones.jsx';
import PanelLocal from './PanelLocal.jsx';

function Resumen() {
  useTitulo('Panel del vendedor');
  const { datos, error, cargando } = useApi('/vendedor/resumen');
  if (cargando) return <Cargando />;
  if (error) return <ErrorMensaje error={error} />;
  const e = datos.pedidos_por_estado;
  const tarjetas = [
    ...(Number(datos.arrepentimientos) > 0 ? [{
      icono: Undo2, valor: datos.arrepentimientos, texto: 'Arrepentimientos para resolver: no los despaches, cancelalos y reintegrá',
      enlace: '/panel/pedidos?estado=arrepentimiento', alerta: true,
    }] : []),
    { icono: ClipboardList, valor: e.pagado || 0, texto: 'Pedidos pagados para preparar', enlace: '/panel/pedidos?estado=pagado', destacado: (e.pagado || 0) > 0 },
    { icono: PackageOpen, valor: e.en_preparacion || 0, texto: 'En preparación', enlace: '/panel/pedidos?estado=en_preparacion' },
    { icono: PackageCheck, valor: (e.enviado || 0) + (e.listo_para_retirar || 0), texto: 'Enviados o listos para retirar', enlace: '/panel/pedidos?estado=activos' },
    { icono: TrendingUp, valor: precio(datos.ventas_mes), texto: `Ventas del mes · total histórico ${precio(datos.ventas_totales)}` },
    { icono: Tag, valor: datos.publicaciones_activas, texto: `Publicaciones activas · ${datos.publicaciones_pausadas} pausadas`, enlace: '/panel/publicaciones' },
    { icono: Tag, valor: datos.stock_bajo + datos.sin_stock, texto: `Con stock bajo o sin stock (${datos.sin_stock} sin stock)`, enlace: '/panel/publicaciones?estado=sin_stock', alerta: datos.sin_stock > 0 },
  ];
  return (
    <div className="panel-resumen">
      {tarjetas.map((t) => {
        const Icono = t.icono;
        const contenido = (
          <>
            <Icono size={24} />
            <strong>{t.valor}</strong>
            <span>{t.texto}</span>
          </>
        );
        const clase = `panel-dato ${t.destacado ? 'panel-dato--destacado' : ''} ${t.alerta ? 'panel-dato--alerta' : ''}`;
        return t.enlace
          ? <Link key={t.texto} to={t.enlace} className={clase}>{contenido}</Link>
          : <div key={t.texto} className={clase}>{contenido}</div>;
      })}
      {(e.pendiente_pago || 0) > 0 && (
        <p className="texto-chico texto-gris panel-resumen__nota">
          Hay {e.pendiente_pago} pedido(s) esperando que el comprador termine de pagar. Aparecen en "Pedidos" cuando Mercado Pago aprueba el pago.
        </p>
      )}
    </div>
  );
}

export default function Panel() {
  const { usuario } = useAuth();
  const local = usuario.vendedor;
  return (
    <div className="contenedor pagina panel">
      <header className="panel__cabecera">
        <Avatar src={local?.logo} nombre={local?.nombre_comercial} redondo={false} />
        <div>
          <span className="texto-gris texto-chico">Panel del vendedor</span>
          <h1>{local?.nombre_comercial}</h1>
          <span className="texto-gris texto-chico">{local?.ciudad}, {local?.provincia}</span>
        </div>
        {local && <Link to={`/vendedores/${local.slug}`} className="btn btn--chico panel__ver-local"><ExternalLink size={16} /> Ver mi página</Link>}
      </header>
      <nav className="pestanas" aria-label="Secciones del panel">
        <NavLink to="/panel" end><LayoutDashboard size={18} /> Resumen</NavLink>
        <NavLink to="/panel/pedidos"><ClipboardList size={18} /> Pedidos</NavLink>
        <NavLink to="/panel/publicaciones"><Tag size={18} /> Publicaciones</NavLink>
        <NavLink to="/panel/local"><Settings size={18} /> Mi local</NavLink>
      </nav>
      <Routes>
        <Route index element={<Resumen />} />
        <Route path="pedidos" element={<PanelPedidos />} />
        <Route path="publicaciones" element={<PanelPublicaciones />} />
        <Route path="local" element={<PanelLocal />} />
      </Routes>
    </div>
  );
}

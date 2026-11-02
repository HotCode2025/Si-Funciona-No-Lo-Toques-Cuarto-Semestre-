import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import SelectorVehiculo from './components/SelectorVehiculo.jsx';
import RutaProtegida from './components/RutaProtegida.jsx';
import Inicio from './pages/Inicio.jsx';
import Catalogo from './pages/Catalogo.jsx';
import Producto from './pages/Producto.jsx';
import Vendedores from './pages/Vendedores.jsx';
import Vendedor from './pages/Vendedor.jsx';
import Carrito from './pages/Carrito.jsx';
import Ingresar from './pages/Ingresar.jsx';
import Registro from './pages/Registro.jsx';
import Checkout from './pages/Checkout.jsx';
import PagoResultado from './pages/PagoResultado.jsx';
import MisCompras from './pages/MisCompras.jsx';
import SeguirCompra from './pages/SeguirCompra.jsx';
import Comprobante from './pages/Comprobante.jsx';
import { Privacidad, Terminos, TerminosVendedores } from './pages/Legales.jsx';
import Arrepentimiento from './pages/Arrepentimiento.jsx';
import MiCuenta from './pages/MiCuenta.jsx';
import { AvisoEmailSinConfirmar, RecuperarClave, RestablecerClave, VerificarEmail } from './pages/Cuenta.jsx';
import Panel from './pages/panel/Panel.jsx';
import Admin from './pages/admin/Admin.jsx';
import NoEncontrado from './pages/NoEncontrado.jsx';
import Creditos from './pages/Creditos.jsx';
import MarcasRepuestos from './pages/MarcasRepuestos.jsx';

function SubirAlNavegar() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <div className="app">
      <SubirAlNavegar />
      <Header />
      <AvisoEmailSinConfirmar />
      <main className="app__contenido">
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/catalogo" element={<Catalogo />} />
          <Route path="/producto/:id" element={<Producto />} />
          <Route path="/vendedores" element={<Vendedores />} />
          <Route path="/vendedores/:slug" element={<Vendedor />} />
          <Route path="/carrito" element={<Carrito />} />
          <Route path="/ingresar" element={<Ingresar />} />
          <Route path="/registro" element={<Registro />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/pago/:resultado" element={<PagoResultado />} />
          <Route path="/seguir-compra" element={<SeguirCompra />} />
          <Route path="/comprobante/:id" element={<Comprobante />} />
          <Route path="/mis-compras" element={<RutaProtegida><MisCompras /></RutaProtegida>} />
          <Route path="/mi-cuenta" element={<RutaProtegida><MiCuenta /></RutaProtegida>} />
          <Route path="/panel/*" element={<RutaProtegida rol="vendedor"><Panel /></RutaProtegida>} />
          <Route path="/admin/*" element={<RutaProtegida rol="admin"><Admin /></RutaProtegida>} />
          <Route path="/marcas-repuestos" element={<MarcasRepuestos />} />
          <Route path="/creditos" element={<Creditos />} />
          <Route path="/terminos" element={<Terminos />} />
          <Route path="/privacidad" element={<Privacidad />} />
          <Route path="/terminos-vendedores" element={<TerminosVendedores />} />
          <Route path="/arrepentimiento" element={<Arrepentimiento />} />
          <Route path="/verificar-email" element={<VerificarEmail />} />
          <Route path="/recuperar-clave" element={<RecuperarClave />} />
          <Route path="/restablecer-clave" element={<RestablecerClave />} />
          <Route path="*" element={<NoEncontrado />} />
        </Routes>
      </main>
      <Footer />
      <SelectorVehiculo />
    </div>
  );
}

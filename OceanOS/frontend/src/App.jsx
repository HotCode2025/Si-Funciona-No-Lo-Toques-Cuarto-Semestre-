import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { DemoProvider, useDemo } from './contexts/DemoContext.jsx';

import PublicoLayout from './layouts/PublicoLayout.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import PanelLayout from './layouts/PanelLayout.jsx';

import Portada       from './pages/publico/Portada.jsx';
import Funciones     from './pages/publico/Funciones.jsx';
import Ecosistema    from './pages/publico/Ecosistema.jsx';
import Mercado       from './pages/publico/Mercado.jsx';
import ActivoDetalle from './pages/publico/ActivoDetalle.jsx';

import Inicio    from './pages/app/Inicio.jsx';
import Reportar  from './pages/app/Reportar.jsx';
import Verificar from './pages/app/Verificar.jsx';
import Billetera from './pages/app/Billetera.jsx';
import Perfil    from './pages/app/Perfil.jsx';
import Tokens    from './pages/app/Tokens.jsx';


import { Boton, Cargando } from './components/ui/index.jsx';

// Carga diferida: recharts pesa y solo hace falta en el detalle de zona y
// en el panel. La app ciudadana no lo baja nunca.
const ZonaDetalle     = lazy(() => import('./pages/publico/ZonaDetalle.jsx'));
const Resumen         = lazy(() => import('./pages/panel/Resumen.jsx'));
const Proyectos       = lazy(() => import('./pages/panel/Proyectos.jsx'));
const ProyectoDetalle = lazy(() => import('./pages/panel/ProyectoDetalle.jsx'));
const Sensores        = lazy(() => import('./pages/panel/Sensores.jsx'));
const Automatizaciones = lazy(() => import('./pages/panel/Automatizaciones.jsx'));

function NoEncontrado() {
  return (
    <div className="mx-auto max-w-md px-5 py-24 text-center">
      <p className="cifra font-display text-5xl font-600 text-kelp">404</p>
      <h1 className="mt-4 font-display text-xl font-600">Acá no hay nada</h1>
      <p className="mt-2 text-sm text-tinta">
        La dirección que seguiste no existe o se movió.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link to="/"><Boton variante="kelp">Volver al inicio</Boton></Link>
        <Link to="/funciones"><Boton variante="linea">Ver las funciones</Boton></Link>
      </div>
    </div>
  );
}

function Rutas() {
  // Al reiniciar la demo cambia `version`: con la key nueva se vuelven a
  // montar todas las pantallas y cada una pide sus datos otra vez.
  const { version } = useDemo();

  return (
    <Routes key={version}>
      {/* Público */}
      <Route element={<PublicoLayout />}>
        <Route path="/" element={<Portada />} />
        <Route path="/funciones" element={<Funciones />} />
        <Route path="/ecosistema" element={<Ecosistema />} />
        <Route path="/ecosistema/:slug" element={<ZonaDetalle />} />
        <Route path="/mercado" element={<Mercado />} />
        <Route path="/mercado/:id" element={<ActivoDetalle />} />
        <Route path="*" element={<NoEncontrado />} />
      </Route>

      {/* Sin login por ahora: quien tenga guardado el enlace viejo cae en
          la lista de funciones en vez de en un 404. */}
      <Route path="/ingresar" element={<Navigate to="/funciones" replace />} />

      {/* Capa 1 — app ciudadana */}
      <Route path="/app" element={<AppLayout />}>
        <Route index element={<Inicio />} />
        <Route path="reportar" element={<Reportar />} />
        <Route path="verificar" element={<Verificar />} />
        <Route path="billetera" element={<Billetera />} />
        <Route path="perfil" element={<Perfil />} />
        <Route path="tokens" element={<Tokens />} />
      </Route>

      {/* Capa 2 — panel de organización */}
      <Route path="/panel" element={<PanelLayout />}>
        <Route index element={<Resumen />} />
        <Route path="proyectos" element={<Proyectos />} />
        <Route path="proyectos/:id" element={<ProyectoDetalle />} />
        <Route path="sensores" element={<Sensores />} />
        <Route path="automatizaciones" element={<Automatizaciones />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <DemoProvider>
        <Suspense fallback={<div className="grid min-h-dvh place-items-center"><Cargando /></div>}>
          <Rutas />
        </Suspense>
      </DemoProvider>
    </BrowserRouter>
  );
}

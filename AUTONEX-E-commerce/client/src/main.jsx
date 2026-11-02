import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow/700.css';
import '@fontsource/barlow/800-italic.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/700-italic.css';
import '@fontsource/barlow-condensed/800-italic.css';
import '@fontsource/jetbrains-mono/500.css';
import './estilos/base.css';
import './estilos/componentes.css';
import './estilos/paginas.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { VehiculoProvider } from './context/VehiculoContext.jsx';
import { CarritoProvider } from './context/CarritoContext.jsx';
import { AvisosProvider } from './context/AvisosContext.jsx';

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <AvisosProvider>
        <AuthProvider>
          <VehiculoProvider>
            <CarritoProvider>
              <App />
            </CarritoProvider>
          </VehiculoProvider>
        </AuthProvider>
      </AvisosProvider>
    </BrowserRouter>
  </React.StrictMode>,
);

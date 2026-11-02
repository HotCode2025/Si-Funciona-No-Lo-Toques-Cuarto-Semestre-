import { AlertTriangle, PackageSearch } from 'lucide-react';

export function Cargando({ texto = 'Cargando…' }) {
  return (
    <div className="cargando" role="status">
      <span className="cargando__rueda" aria-hidden="true" />
      <span>{texto}</span>
    </div>
  );
}

export function ErrorMensaje({ error, titulo }) {
  if (!error) return null;
  const detalles = error.detalles?.length > 1 ? error.detalles : null;
  return (
    <div className="alerta alerta--error" role="alert">
      <AlertTriangle size={20} aria-hidden="true" />
      <div>
        {titulo && <strong>{titulo}. </strong>}
        {detalles ? (
          <>
            <span>Revisá estos datos:</span>
            <ul>{detalles.map((d) => <li key={d}>{d}</li>)}</ul>
          </>
        ) : (
          <span>{error.message}</span>
        )}
      </div>
    </div>
  );
}

export function Vacio({ icono: Icono = PackageSearch, titulo, children, accion }) {
  return (
    <div className="vacio">
      <span className="vacio__icono"><Icono size={34} aria-hidden="true" /></span>
      <h3>{titulo}</h3>
      {children && <div className="texto-gris">{children}</div>}
      {accion && <div className="vacio__accion">{accion}</div>}
    </div>
  );
}

export function EtiquetaEstado({ estado, mapa }) {
  const info = mapa[estado] || { texto: estado, tono: 'gris' };
  return <span className={`estado estado--${info.tono}`}>{info.texto}</span>;
}

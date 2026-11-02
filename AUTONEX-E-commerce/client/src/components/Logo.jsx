/** Logo de AUTONEX: la "A" con la estela naranja + el nombre (AUTON en blanco, EX en naranja). */
export function Emblema({ tamano = 36 }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path d="M9 52 L27 14 Q28.6 11 32 11 Q35.4 11 37 14 L55 52 H44.5 L32 25 L19.5 52 Z" fill="currentColor" />
      <path d="M17 52 L28.5 37 Q31.5 33.2 36.5 33 L61 31.6 L57.6 37.4 L39.5 38.6 Q36.6 38.8 34.8 41.2 L27.4 52 Z" fill="#FF6A13" />
    </svg>
  );
}

export default function Logo({ claro = true, conLema = false }) {
  return (
    <span className={`logo ${claro ? 'logo--claro' : 'logo--oscuro'}`} aria-label="AUTONEX">
      <Emblema />
      <span className="logo__texto">
        <span className="logo__nombre">AUTON<span className="logo__ex">EX</span></span>
        {conLema && <span className="logo__lema">Tu marketplace de autopartes</span>}
      </span>
    </span>
  );
}

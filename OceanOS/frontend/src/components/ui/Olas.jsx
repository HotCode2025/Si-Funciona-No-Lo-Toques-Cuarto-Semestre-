/** Línea de olas que se desplaza lento. Divisor entre secciones. */
const D = 'M0 40q90-28 180 0' + 't180 0'.repeat(15);
export default function Olas({ className = '' }) {
  return (
    <div className={`olas ${className}`} aria-hidden="true">
      <svg viewBox="0 0 2880 80" preserveAspectRatio="none" className="olas-a"><path d={D} /></svg>
      <svg viewBox="0 0 2880 80" preserveAspectRatio="none" className="olas-b"><path d={D} /></svg>
    </div>
  );
}

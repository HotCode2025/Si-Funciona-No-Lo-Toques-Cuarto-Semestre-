import { useEffect, useRef, useState } from 'react';

export default function Revelar({ children, className = '', retraso = 0, direccion = 'arriba', as: Component = 'div' }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -20px 0px' }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }
    return () => observer.disconnect();
  }, []);

  const transformInicial = direccion === 'arriba' ? 'translate-y-12'
                         : direccion === 'abajo' ? '-translate-y-12'
                         : direccion === 'izquierda' ? '-translate-x-12'
                         : direccion === 'derecha' ? 'translate-x-12'
                         : 'scale-95';

  return (
    <Component
      ref={ref}
      style={{ transitionDelay: `${retraso}ms` }}
      className={`transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        visible ? 'opacity-100 translate-y-0 translate-x-0 scale-100' : `opacity-0 ${transformInicial}`
      } ${className}`}
    >
      {children}
    </Component>
  );
}

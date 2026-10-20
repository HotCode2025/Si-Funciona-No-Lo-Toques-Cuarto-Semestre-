import { Link } from 'react-router-dom';
import { Activity, ArrowRight } from 'lucide-react';
import { useFetch } from '../../hooks/useFetch.js';
import MapaZona, { LeyendaMapa } from '../../components/mapa/MapaZona.jsx';
import { Boton, Barra } from '../../components/ui/index.jsx';
import Revelar from '../../components/ui/Revelar.jsx';
import { numero, dolares, colorSalud } from '../../utils/format.js';

/**
 * Las tres capas ordenadas por profundidad. No es una metáfora suelta:
 * la Capa 1 son personas en la superficie, la 2 la columna de agua donde
 * están los sensores, la 3 el lecho donde el carbono queda fijado.
 */
const CAPAS = [
  {
    profundidad: '0 m',
    lugar: 'Superficie',
    titulo: 'La gente que mira el agua',
    cuerpo: 'Buzos, pescadores y guías reportan lo que ven desde el celular: un gatopardo, una mancha de cachiyuyo, una red abandonada. Cada reporte verificado paga en tokens OKN que se cambian por salidas de buceo y avistaje.',
    dato: 'Gratis, para cualquiera',
    a: '/app',
    cta: 'Ver la app',
  },
  {
    profundidad: '−25 m',
    lugar: 'Columna de agua',
    titulo: 'Las organizaciones que lo gestionan',
    cuerpo: 'Pesqueras, ONGs y áreas protegidas cruzan esos reportes con sus propios sensores de temperatura, salinidad y biomasa. Ven la salud de cada zona en vivo, siguen sus proyectos de restauración y arman los informes que piden los fondos.',
    dato: 'Desde u$s 500 por mes',
    a: '/ecosistema',
    cta: 'Ver el estado del océano',
  },
  {
    profundidad: '−60 m',
    lugar: 'Lecho marino',
    titulo: 'El carbono que queda abajo',
    cuerpo: 'Un bosque de cachiyuyo fija carbono cinco veces más rápido que un bosque de tierra. Cuando la restauración está medida y certificada, esas toneladas se venden a empresas que necesitan compensar. Cada venta financia la próxima hectárea.',
    dato: 'Comisión del 8 al 12%',
    a: '/mercado',
    cta: 'Ver los activos',
  },
];

export default function Portada() {
  const { data: ind } = useFetch('/ecosistema/indicadores');
  const { data: zonasData } = useFetch('/ecosistema/zonas');
  const { data: avist } = useFetch('/avistamientos?zone=golfo-nuevo&limite=120');
  const { data: mercado } = useFetch('/mercado/indicadores');

  const indicadores = ind?.indicadores;
  const golfo = zonasData?.zonas?.find((z) => z.slug === 'golfo-nuevo');

  return (
    <>
        {/* ---------------- HERO: el mapa es el titular ---------------- */}
      <section className="hero-ocean border-b border-columna bg-abismo px-5 pb-12 pt-7 text-carta lg:px-10">
        <div className="relative z-10 mx-auto max-w-5xl">
          <p className="animar-flotar flex items-center gap-2 text-sm text-sonda"><Activity size={14} className="text-alga" /> Golfo Nuevo, Chubut · datos de demostración</p>
          <h1 className="animar-flotar retraso-1 mt-3 max-w-2xl font-display text-4xl leading-[1.08] font-600 sm:text-5xl">
            El 90% del bosque de cachiyuyo del Atlántico Sur desapareció desde 1990.
          </h1>
          <p className="animar-flotar retraso-2 mt-4 max-w-xl text-lg text-sonda">
            Este mapa muestra lo que queda, reportado por la gente que se mete al agua.
          </p>

          <div className="animar-flotar retraso-3 mt-6 flex flex-wrap gap-3">
            <Link to="/funciones"><Boton variante="kelp">Probar la demo <ArrowRight size={15} /></Boton></Link>
            <Link to="/ecosistema"><Boton variante="lineaClara">Explorar el ecosistema</Boton></Link>
          </div>

          <div className="animar-flotar retraso-4 mapa-marco mt-8">
            <MapaZona zona={golfo} avistamientos={avist?.avistamientos ?? []} alto={400} />
          </div>
          <LeyendaMapa className="animar-flotar retraso-4 mt-3 text-sonda/80" />

          {/* Las cuatro sondas del sistema */}
          <dl className="animar-flotar retraso-4 metric-grid mt-10 grid grid-cols-2 gap-x-6 gap-y-8 border-t border-columna pt-8 lg:grid-cols-4">
            {[
              { v: numero(indicadores?.reportes_verificados), r: 'reportes verificados' },
              { v: numero(indicadores?.hectareas_en_restauracion, 1), u: 'ha', r: 'en restauración' },
              { v: numero(indicadores?.tco2_certificado), u: 'tCO₂e', r: 'carbono certificado' },
              { v: dolares(mercado?.indicadores?.volumen_usd), r: 'transaccionados' },
            ].map((s, i) => (
              <div key={i}>
                <dd className="flex items-baseline gap-1.5">
                  <span className="cifra font-display text-3xl font-600 text-kelp">{s.v}</span>
                  {s.u && <span className="text-sm text-sonda">{s.u}</span>}
                </dd>
                <dt className="mt-1 text-sm text-sonda">{s.r}</dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ---------------- EL PROBLEMA ---------------- */}
      <section className="px-5 py-16 lg:px-10 overflow-hidden">
        <Revelar className="mx-auto grid max-w-5xl gap-10 md:grid-cols-[1fr_1.3fr]">
          <h2 className="font-display text-2xl leading-tight font-600">
            Sin tiburones, el bosque se cae solo
          </h2>
          <div className="space-y-4 text-[15px] leading-relaxed text-tinta">
            <p>
              Las poblaciones de tiburones costeros en Argentina cayeron un 70% en treinta
              años. Sin ellos arriba de la cadena, los herbívoros que se comen al cachiyuyo
              se multiplican sin control y el bosque colapsa.
            </p>
            <p>
              Eso no es solo un problema ecológico. Un bosque de algas fija carbono cinco
              veces más rápido que uno terrestre, y Argentina tiene el sistema de kelp más
              grande del Hemisferio Sur. Lo que se está perdiendo tiene precio de mercado.
            </p>
            <p className="text-carta">
              El obstáculo nunca fue la plata: fue que nadie está midiendo. Sin datos
              verificables no hay certificación, y sin certificación no hay financiamiento.
            </p>
          </div>
        </Revelar>
      </section>

      {/* ---------------- LAS TRES CAPAS, POR PROFUNDIDAD ---------------- */}
      <section className="border-t border-trazo bg-papel px-5 py-16 lg:px-10 overflow-hidden">
        <div className="mx-auto max-w-5xl">
          <Revelar>
            <h2 className="max-w-lg font-display text-2xl leading-tight font-600">
              Tres capas, una sola columna de agua
            </h2>
            <p className="mt-3 max-w-xl text-[15px] text-tinta">
              Cada capa produce el dato que la de abajo necesita. Por eso el sistema se
              sostiene: sin reportes de la gente no hay dashboard que vender, y sin dashboard
              no hay carbono que certificar.
            </p>
          </Revelar>

          <ol className="mt-12 space-y-0">
            {CAPAS.map((capa, i) => (
              <Revelar key={capa.lugar} as="li" retraso={i * 200} className="grid gap-6 md:grid-cols-[110px_1fr]">
                {/* Columna de sonda: la profundidad es el marcador */}
                <div className="flex gap-4 md:flex-col md:items-end md:text-right">
                  <div>
                    <p className="cifra font-display text-xl font-600 text-kelp">{capa.profundidad}</p>
                    <p className="text-xs text-tinta/70">{capa.lugar}</p>
                  </div>
                </div>

                <div className={`relative pb-12 pl-6 ${i < CAPAS.length - 1 ? 'border-l border-trazo' : ''}`}>
                  <span className="absolute -left-[5px] top-1.5 block h-2.5 w-2.5 rounded-full bg-kelp" />
                  <h3 className="font-display text-lg font-600">{capa.titulo}</h3>
                  <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-tinta">{capa.cuerpo}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-4">
                    <Link to={capa.a}
                          className="inline-flex items-center gap-1.5 text-sm font-500 underline underline-offset-4 hover:text-kelp">
                      {capa.cta} <ArrowRight size={14} />
                    </Link>
                    <span className="text-sm text-tinta/70">{capa.dato}</span>
                  </div>
                </div>
              </Revelar>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------- SALUD POR ZONA ---------------- */}
      <section className="px-5 py-16 lg:px-10 overflow-hidden">
        <div className="mx-auto max-w-5xl">
          <Revelar className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="font-display text-2xl font-600">Cómo está cada zona hoy</h2>
            <Link to="/ecosistema" className="text-sm underline underline-offset-4 hover:text-kelp">
              Ver el detalle
            </Link>
          </Revelar>

          <div className="mt-8 divide-y divide-trazo border-y border-trazo">
            {(zonasData?.zonas ?? []).map((z, i) => (
              <Revelar key={z.slug} retraso={i * 150} direccion="izquierda">
                <Link to={`/ecosistema/${z.slug}`}
                      className="grid grid-cols-[1fr_auto] items-center gap-4 py-4 hover:bg-papel sm:grid-cols-[1.2fr_1fr_auto] transition-colors">
                  <div>
                    <p className="font-500">{z.name}</p>
                    <p className="text-sm text-tinta/70">
                      {z.province}{z.is_protected && ' · área protegida'}
                    </p>
                  </div>
                  <div className="hidden sm:block">
                    <Barra valor={z.health_index} color={colorSalud(z.health_index)} />
                    <p className="mt-1.5 text-xs text-tinta/70">
                      cachiyuyo {numero(z.kelp_cobertura_pct, 1)}% · {z.avistamientos_tiburon} tiburones · {z.amenazas_abiertas} amenazas
                    </p>
                  </div>
                  <p className="cifra font-display text-2xl font-600"
                     style={{ color: colorSalud(z.health_index) }}>
                    {numero(z.health_index, 1)}
                  </p>
                </Link>
              </Revelar>
            ))}
          </div>
          <Revelar retraso={300}>
            <p className="mt-3 text-xs text-tinta/70">
              Índice de salud sobre 100: 50% cobertura de cachiyuyo, 30% presencia de tiburones,
              20% ausencia de amenazas. Ventana de 90 días.
            </p>
          </Revelar>
        </div>
      </section>

      {/* ---------------- CIERRE ---------------- */}
      <section className="border-t border-trazo bg-papel px-5 py-16 lg:px-10 overflow-hidden">
        <Revelar className="mx-auto max-w-2xl" direccion="arriba">
          <h2 className="font-display text-2xl leading-tight font-600">
            Si te metés al agua en la Patagonia, ya tenés el dato que falta
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-tinta">
            Cada salida que hacés es una medición que hoy se pierde. Reportarla toma
            un toque y suma tokens que se cambian con operadores de Puerto Madryn.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/funciones"><Boton variante="kelp">Probar la plataforma</Boton></Link>
            <Link to="/ecosistema"><Boton variante="linea">Ver los datos primero</Boton></Link>
          </div>
        </Revelar>
      </section>
    </>
  );
}

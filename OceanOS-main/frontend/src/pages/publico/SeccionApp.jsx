import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Smartphone, Share, SquarePlus, Zap, Coins, ShieldCheck, ChevronDown, Map as MapIcon, PlusCircle, CheckSquare, Wallet, User, ArrowRight } from 'lucide-react';
import Revelar from '../../components/ui/Revelar.jsx';
import { Marca } from '../../components/marca/Logo.jsx';
import { VideoFondo, CLIPS } from '../../components/media/Reel.jsx';
import { Etiqueta } from '../../components/ui/index.jsx';

const PASOS_IOS = [
  { icono: Safari, t: 'Abrí esta página en Safari' },
  { icono: Share, t: 'Tocá Compartir, el cuadrado con la flecha' },
  { icono: SquarePlus, t: 'Elegí "Agregar a inicio"' },
];
function Safari(props) { return <Smartphone {...props} />; }

/** Teléfono con video de fondo y fichas que aparecen como lo hace la app al verificar un reporte. */
function Telefono() {
  return (
    <div className="telefono flotar" role="img" aria-label="Vista ilustrativa de la app OceanOS">
      <div className="telefono-pantalla">
        <div className="absolute inset-0"><VideoFondo clip={CLIPS[2]} /></div>
        <div className="absolute inset-0 bg-linear-to-b from-abismo/75 via-transparent to-abismo/95" />
        <div className="telefono-isla" />
        <div className="relative z-10 flex h-full flex-col px-4 pt-10 pb-3">
          <Marca tamaño={22} />
          <div className="mt-auto space-y-2.5">
            <div className="ficha-1 vidrio rounded-2xl p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-500 text-carta">Orcas · Golfo Nuevo</p>
                <Etiqueta color="var(--color-alga)">verificado</Etiqueta>
              </div>
              <p className="mt-1 text-xs text-sonda">Reporte confirmado por la comunidad</p>
            </div>
            <div className="ficha-2 vidrio flex items-center gap-2 rounded-2xl p-3">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-kelp/90 text-abismo"><Coins size={16} /></span>
              <p className="text-sm text-carta">Tu reporte se paga en <span className="font-600 text-kelp-alto">tokens OKN</span></p>
            </div>
          </div>
          <nav className="vidrio mt-3 flex justify-between rounded-2xl px-3.5 py-2.5 text-sonda">
            {[MapIcon, PlusCircle, CheckSquare, Wallet, User].map((I, k) => (
              <I key={k} size={18} className={k === 0 ? 'text-kelp-alto' : ''} />
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}

export default function SeccionApp() {
  const [ios, setIos] = useState(false);

  return (
    <section id="descargar" className="relative scroll-mt-20 overflow-hidden border-t border-trazo px-5 py-20 lg:px-10">
      <div className="pointer-events-none absolute -left-40 top-10 h-96 w-96 rounded-full bg-alga/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-tiburon/10 blur-3xl" />

      <div className="relative mx-auto grid max-w-5xl items-center gap-14 lg:grid-cols-[1.1fr_.9fr]">
        <div>
          <Revelar>
            <p className="text-xs tracking-widest text-kelp-alto uppercase">App ciudadana</p>
            <h2 className="mt-3 max-w-lg font-display text-3xl leading-tight font-600 sm:text-4xl">
              El océano en tu bolsillo, listo para la próxima salida
            </h2>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-tinta">
              Reportá un avistaje o una mancha de cachiyuyo en un toque, mirá el mapa en vivo y cobrá
              tus reportes verificados en tokens OKN.
            </p>
          </Revelar>

          <Revelar retraso={120}>
            <ul className="mt-6 flex flex-wrap gap-2.5 text-sm text-carta">
              {[[Zap, 'Reportar en un toque'], [Coins, 'Ganás tokens OKN'], [ShieldCheck, 'Gratis, para cualquiera']].map(([I, t]) => (
                <li key={t} className="inline-flex items-center gap-2 rounded-full border border-columna/70 bg-hondo/40 px-3.5 py-1.5 backdrop-blur">
                  <I size={14} className="text-kelp-alto" /> {t}
                </li>
              ))}
            </ul>
          </Revelar>

          <Revelar retraso={240} className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href="/oceanos.apk" download="OceanOS_Patagonia.apk"
               className="btn-brillo group inline-flex items-center gap-3 rounded-xl border border-kelp/60 bg-kelp px-5 py-3 text-abismo transition-all duration-300 hover:-translate-y-0.5 hover:bg-kelp-alto hover:shadow-[0_12px_40px_-10px_rgb(229_164_69/.6)]">
              <Download size={22} className="transition-transform duration-300 group-hover:translate-y-0.5" />
              <span className="text-left leading-tight">
                <span className="block text-[11px] tracking-wide uppercase opacity-75">Descargar para</span>
                <span className="block text-base font-600">Android (APK)</span>
              </span>
            </a>

            <button type="button" onClick={() => setIos((v) => !v)} aria-expanded={ios} aria-controls="pasos-ios"
                    className="group inline-flex items-center gap-3 rounded-xl border border-columna bg-hondo/50 px-5 py-3 text-left text-carta backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:bg-columna/50">
              <Smartphone size={22} />
              <span className="leading-tight">
                <span className="block text-[11px] tracking-wide text-sonda uppercase">Instalar en</span>
                <span className="block text-base font-600">iPhone (iOS)</span>
              </span>
              <ChevronDown size={16} className={`ml-1 text-sonda transition-transform duration-500 ${ios ? 'rotate-180' : ''}`} />
            </button>
          </Revelar>

          {/* Pasos de iOS: se despliegan en lugar de abrir un alert() */}
          <div id="pasos-ios" className={`grid transition-all duration-700 ease-[cubic-bezier(.16,1,.3,1)] ${ios ? 'mt-4 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
            <ol className="overflow-hidden">
              {PASOS_IOS.map(({ icono: I, t }, k) => (
                <li key={t} className="flex items-center gap-3 border-l border-columna py-2 pl-4 text-sm text-tinta">
                  <span className="cifra grid h-6 w-6 shrink-0 place-items-center rounded-full border border-kelp/60 text-xs text-kelp-alto">{k + 1}</span>
                  <I size={15} className="shrink-0 text-sonda" /> {t}
                </li>
              ))}
            </ol>
          </div>

          <Revelar retraso={320}>
            <p className="mt-4 max-w-md text-xs text-sonda/70">
              En Android hace falta permitir la instalación de apps de origen desconocido.
              ¿Preferís no instalar nada?{' '}
              <Link to="/app" className="inline-flex items-center gap-1 text-sonda underline underline-offset-4 hover:text-kelp-alto">
                Abrí la app en el navegador <ArrowRight size={12} />
              </Link>
            </p>
          </Revelar>
        </div>

        <Revelar direccion="derecha" retraso={150} className="flex justify-center"><Telefono /></Revelar>
      </div>
    </section>
  );
}

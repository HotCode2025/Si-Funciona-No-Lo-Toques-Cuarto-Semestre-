import { Link } from 'react-router-dom';
import {
  ArrowRight, Map, PlusCircle, CheckSquare, Wallet, User, Waves, ChartLine,
  LayoutDashboard, FolderKanban, Radio, Store, ShoppingCart, RotateCcw, Coins, Workflow,
} from 'lucide-react';
import { useDemo } from '../../contexts/DemoContext.jsx';
import { useReglas } from '../../hooks/useReglas.js';
import { Boton, Panel } from '../../components/ui/index.jsx';

const ACTIVO_CARBONO = '/mercado/99999999-0000-0000-0000-000000000001';

/**
 * Un recorrido de cinco minutos por lo que más muestra el producto. Cada
 * paso deja algo cambiado que el siguiente aprovecha: el reporte y el voto
 * suman tokens, y los tokens son los que después se canjean.
 */
const RECORRIDO = [
  { titulo: 'Mirá el mapa en vivo',       detalle: 'Tocá cualquier punto para ver qué se vio, a qué profundidad y quién lo reportó.', a: '/app' },
  { titulo: 'Cargá un avistamiento',      a: '/app/reportar',
    // El monto sale de las reglas del servidor, no se escribe a mano.
    detalle: (r) => `Elegí Bahía Camarones y tocá el mapa: nadie reportó ahí este mes, así que al básico se le suma ${r ? `el bono de +${r.premios.zona_nueva} OKN` : 'el bono de zona nueva'} aunque todavía no esté verificado.` },
  { titulo: 'Resolvé una votación',       detalle: 'El reporte del gatuzo tiene dos votos. El tuyo es el tercero y lo resuelve.', a: '/app/verificar' },
  { titulo: 'Canjeá tokens',              detalle: 'Con lo que juntaste alcanza para el café del muelle. El código aparece al instante.', a: '/app/billetera' },
  { titulo: 'Entrá como organización',    detalle: 'Cambiá entre la ONG, la pesquera y el área protegida desde la barra lateral.', a: '/panel' },
  { titulo: 'Reservá carbono azul',       detalle: 'Poné una cantidad, mirá el total y la comisión que vuelve a la restauración.', a: ACTIVO_CARBONO },
];

/** Las mismas tres capas de la portada, con sus pantallas. */
const CAPAS = [
  {
    profundidad: '0 m',
    lugar: 'Superficie',
    titulo: 'App ciudadana',
    quien: 'Para buzos, pescadores y guías',
    nota: 'La usás con la cuenta de demostración de OceanOS.',
    funciones: [
      { icono: Map,         titulo: 'Mapa en vivo', texto: 'Los reportes sobre la carta batimétrica, filtrados por zona y por tipo.', a: '/app' },
      { icono: PlusCircle,  titulo: 'Reportar',     texto: 'Qué viste y dónde. Marcás el punto tocando el mapa y sumás tokens OKN.', a: '/app/reportar' },
      { icono: CheckSquare, titulo: 'Verificar',    texto: 'Votá los reportes que la IA no pudo clasificar. Tu voto pesa según tu reputación.', a: '/app/verificar' },
      { icono: Wallet,      titulo: 'Billetera',    texto: 'Saldo, historial de movimientos y canjes con operadores turísticos.', a: '/app/billetera' },
      { icono: User,        titulo: 'Perfil',       texto: 'Reputación, racha de días reportando y posición en la comunidad.', a: '/app/perfil' },
      { icono: Coins,       titulo: 'Cómo funcionan los tokens', texto: 'Qué suma y cuánto, rachas, bonos, reputación y canjes, con tu situación actual.', a: '/app/tokens' },
    ],
  },
  {
    profundidad: '−25 m',
    lugar: 'Columna de agua',
    titulo: 'Panel de organizaciones',
    quien: 'Para pesqueras, ONGs y áreas protegidas',
    nota: 'Podés entrar a las tres organizaciones de ejemplo y pasar de una a otra.',
    funciones: [
      { icono: Waves,           titulo: 'Estado del océano', texto: 'Índice de salud de cada zona, especies bajo seguimiento y quién está reportando.', a: '/ecosistema' },
      { icono: ChartLine,       titulo: 'Detalle de zona',   texto: 'Golfo Nuevo: mapa, cobertura de cachiyuyo semana a semana y proyectos activos.', a: '/ecosistema/golfo-nuevo' },
      { icono: LayoutDashboard, titulo: 'Resumen',           texto: 'Hectáreas, carbono certificado, amenazas en tus zonas y hitos pendientes.', a: '/panel' },
      { icono: FolderKanban,    titulo: 'Proyectos',         texto: 'Creá un proyecto, agregale hitos, marcalos hechos y actualizá las hectáreas.', a: '/panel/proyectos' },
      { icono: Radio,           titulo: 'Sensores IoT',      texto: 'Temperatura, salinidad, biomasa, turbidez, oxígeno y pH de los últimos 30 días.', a: '/panel/sensores' },
      { icono: Workflow,        titulo: 'Automatizaciones',  texto: 'El flujo de n8n: qué reporte disparó qué nodo, con la alerta a la ONG y la acreditación de tokens.', a: '/panel/automatizaciones' },
    ],
  },
  {
    profundidad: '−60 m',
    lugar: 'Lecho marino',
    titulo: 'Mercado de activos',
    quien: 'Para empresas y fondos que compensan',
    nota: 'Las reservas quedan registradas pero no cobran nada.',
    funciones: [
      { icono: Store,        titulo: 'Activos',         texto: 'Créditos de carbono azul, hectáreas vivas y bonos de restauración.', a: '/mercado' },
      { icono: ShoppingCart, titulo: 'Reservar',        texto: 'Toneladas de carbono certificadas por Verra en Punta Este, con el total calculado al momento.', a: ACTIVO_CARBONO },
    ],
  },
];

export default function Funciones() {
  const { reiniciar } = useDemo();
  const reglas = useReglas();

  return (
    <>
      {/* ---------------- Encabezado ---------------- */}
      <section className="hero-ocean border-b border-columna px-5 pb-12 pt-7 lg:px-10">
        <div className="relative z-10 mx-auto max-w-5xl">
          <p className="text-sm text-sonda">Versión de demostración · gratis y sin cuenta</p>
          <h1 className="mt-3 max-w-2xl font-display text-4xl leading-[1.08] font-600 text-carta sm:text-5xl">
            Todo lo que hace OceanOS
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-sonda">
            No hace falta registrarse: todas las funciones están abiertas y cargadas con datos
            de ejemplo de Chubut. Lo que hagas queda guardado mientras tengas esta pestaña abierta.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/app"><Boton variante="kelp">Empezar por el mapa <ArrowRight size={15} /></Boton></Link>
            <Boton variante="lineaClara" onClick={reiniciar}>
              <RotateCcw size={15} /> Reiniciar datos
            </Boton>
          </div>
        </div>
      </section>

      {/* ---------------- Recorrido sugerido ---------------- */}
      <section className="px-5 py-14 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-display text-2xl font-600">Recorrido sugerido</h2>
          <p className="mt-2 max-w-xl text-[15px] text-tinta">
            Seis pasos, unos cinco minutos. Cada uno deja algo cambiado que el siguiente aprovecha.
          </p>

          <ol className="mt-8 grid gap-3 md:grid-cols-2">
            {RECORRIDO.map((paso, i) => (
              <li key={paso.titulo}>
                <Link to={paso.a} className="group block h-full">
                  <Panel className="flex h-full gap-4 p-4 group-hover:-translate-y-0.5 group-hover:border-kelp">
                    <span className="cifra grid h-8 w-8 shrink-0 place-items-center rounded-full border border-kelp font-display text-sm font-600 text-kelp">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-500 text-carta">{paso.titulo}</p>
                      <p className="mt-1 text-sm leading-relaxed text-tinta/80">
                        {typeof paso.detalle === 'function' ? paso.detalle(reglas) : paso.detalle}
                      </p>
                    </div>
                    <ArrowRight size={16} className="mt-1 shrink-0 text-sonda transition-transform group-hover:translate-x-0.5 group-hover:text-kelp" />
                  </Panel>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------- Las tres capas ---------------- */}
      <section className="border-t border-trazo bg-papel px-5 py-14 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-display text-2xl font-600">Todas las funciones, por capa</h2>
          <p className="mt-2 max-w-xl text-[15px] text-tinta">
            Ordenadas igual que en la portada: de la superficie, donde está la gente, al lecho,
            donde queda el carbono.
          </p>

          <div className="mt-12 space-y-14">
            {CAPAS.map((capa) => (
              <div key={capa.lugar} className="grid gap-6 md:grid-cols-[150px_1fr]">
                <div>
                  <p className="cifra font-display text-xl font-600 text-kelp">{capa.profundidad}</p>
                  <p className="text-xs text-tinta/70">{capa.lugar}</p>
                </div>

                <div>
                  <h3 className="font-display text-xl font-600 text-carta">{capa.titulo}</h3>
                  <p className="mt-1 text-sm text-tinta/80">{capa.quien} · {capa.nota}</p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {capa.funciones.map(({ icono: Icono, titulo, texto, a }) => (
                      <Link key={titulo} to={a} className="group block">
                        <div className="flex h-full gap-3 rounded-carta border border-trazo bg-abismo p-4 transition-[transform,border-color] duration-200 group-hover:-translate-y-0.5 group-hover:border-kelp">
                          <Icono size={18} className="mt-0.5 shrink-0 text-sonda group-hover:text-kelp" />
                          <div className="min-w-0">
                            <p className="font-500 text-carta">{titulo}</p>
                            <p className="mt-1 text-sm leading-relaxed text-tinta/80">{texto}</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

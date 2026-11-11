import { Link } from "react-router-dom";
import { FiCheckCircle, FiClock, FiEdit3, FiArrowRight, FiList } from "react-icons/fi";
import { Button } from "../components/ui"; 
import { useAuth } from "../context/AuthContext.jsx";

function HomePage() {
  const auth = useAuth(); 

  return (
    <div className="w-full flex flex-col items-center bg-zinc-950 text-slate-200">
      
      <section className="w-full max-w-5xl mx-auto px-6 py-24 md:py-32 flex flex-col items-center text-center">
        <div className="inline-block mb-4 px-3 py-1 rounded-full bg-sky-500/10 text-sky-400 text-sm font-medium border border-sky-500/20">
          Gestión de tareas eficiente
        </div>
        <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 tracking-tight">
          Organiza tu día con <span className="text-transparent bg-clip-text bg-linear-to-r from-sky-400 to-indigo-500">PERN</span>
        </h1>
        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mb-10 leading-relaxed">
          La plataforma definitiva para crear, administrar y dar seguimiento a tus tareas diarias de forma rápida, segura y sin complicaciones.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          
          {auth.isAuthenticated ? (
            <Link to="/tareas">
              <Button className="flex items-center gap-2 px-8 py-3 text-lg bg-sky-500 hover:bg-sky-600">
                Ir a mis tareas <FiList />
              </Button>
            </Link>
          ) : (
            <Link to="/register">
              <Button className="flex items-center gap-2 px-8 py-3 text-lg bg-sky-500 hover:bg-sky-600">
                Comenzar ahora <FiArrowRight />
              </Button>
            </Link>
          )}

          <Link to="/about">
            <Button styles="px-8 py-3 text-lg bg-zinc-800 hover:bg-zinc-700 text-slate-200 border border-zinc-700">
              Conocer más
            </Button>
          </Link>
        </div>
      </section>

      <section className="w-full bg-zinc-900/50 border-y border-zinc-800/80 py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">¿Cómo funciona?</h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              Nuestra aplicación está diseñada para que te enfoques en lo que realmente importa: completar tus objetivos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center p-6 rounded-2xl hover:bg-zinc-800/50 transition-colors">
              <div className="w-16 h-16 rounded-full bg-sky-500/10 flex items-center justify-center mb-6 text-sky-400">
                <FiEdit3 className="text-3xl" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">1. Crea tus tareas</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Agrega nuevas tareas con título, descripción, fecha de entrega y asígnales un estado inicial en segundos.
              </p>
            </div>

            <div className="flex flex-col items-center text-center p-6 rounded-2xl hover:bg-zinc-800/50 transition-colors">
              <div className="w-16 h-16 rounded-full bg-sky-500/10 flex items-center justify-center mb-6 text-sky-400">
                <FiClock className="text-3xl" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">2. Gestiona tu tiempo</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Visualiza todas tus tareas en un panel centralizado y mantén el control de las fechas límite fácilmente.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="flex flex-col items-center text-center p-6 rounded-2xl hover:bg-zinc-800/50 transition-colors">
              <div className="w-16 h-16 rounded-full bg-sky-500/10 flex items-center justify-center mb-6 text-sky-400">
                <FiCheckCircle className="text-3xl" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">3. Actualiza y completa</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Edita la información cuando lo necesites, actualiza su estado a "Completada" y elimina las que ya no sirvan.
              </p>
            </div>
          </div>
        </div>
      </section>

      {!auth.isAuthenticated && (
        <section className="w-full max-w-5xl mx-auto px-6 py-24 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            ¿Listo para empezar a organizarte?
          </h2>
          <p className="text-slate-400 mb-8 max-w-lg mx-auto">
            Únete a la plataforma y descubre lo fácil que es mantener tus proyectos al día.
          </p>
          <Link to="/login">
            <Button className="px-10 py-4 text-lg bg-white text-zinc-900 hover:bg-slate-200 font-bold">
              Iniciar Sesión
            </Button>
          </Link>
        </section>
      )}

    </div>
  );
}

export default HomePage;
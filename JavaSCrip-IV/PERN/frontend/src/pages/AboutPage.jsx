import { Container, Card } from "../components/ui"; // Ajusta la ruta si es necesario
import { FiCode, FiUsers, FiBookOpen } from "react-icons/fi";

function AboutPage() {
  return (
        <Card >
          
          {/* Icono decorativo principal */}
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-sky-500/10 rounded-full text-sky-400">
              <FiCode className="text-5xl" />
            </div>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-slate-100 mb-2">
            Sobre Nosotros
          </h1>
          <p className="text-sky-400 font-medium mb-8">
            Proyecto PERN - Programación IV
          </p>

          <div className="text-slate-300 space-y-6 text-lg leading-relaxed">
            <p>
              Esta aplicación fue desarrollada por los estudiantes del grupo{" "}
              <span className="font-bold text-white bg-zinc-800 px-2 py-1 rounded-md">
                "Si funciona no lo toques"
              </span>.
            </p>

            <div className="flex flex-col md:flex-row justify-center gap-6 mt-8 pt-8 border-t border-zinc-800">
              
              <div className="flex flex-col items-center flex-1">
                <div className="text-sky-400 mb-2">
                  <FiBookOpen className="text-2xl" />
                </div>
                <h3 className="text-slate-100 font-semibold mb-1 text-center">Nuestra Casa de Estudios</h3>
                <p className="text-sm text-slate-400 text-center">
                  Tecnicatura en Programación<br />
                  UTN Facultad Regional San Rafael
                </p>
              </div>

              <div className="flex flex-col items-center flex-1">
                <div className="text-sky-400 mb-2">
                  <FiUsers className="text-2xl" />
                </div>
                <h3 className="text-slate-100 font-semibold mb-1 text-center">La Cátedra</h3>
                <p className="text-sm text-slate-400 text-center">
                  Programación IV<br />
                  Prof. Ariel Betancud
                </p>
              </div>

            </div>
          </div>
          
        </Card>
  );
}

export default AboutPage;
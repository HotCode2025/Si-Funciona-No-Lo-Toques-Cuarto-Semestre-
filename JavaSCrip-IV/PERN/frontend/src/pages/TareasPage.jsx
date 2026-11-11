import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Container, Button } from "../components/ui/index";
import { FaEdit, FaTrash } from "react-icons/fa";
import axios from "axios";

function TareasPage() {
  const [tareas, setTareas] = useState([]);

  useEffect(() => {
    axios.get("http://localhost:3000/api/tareas", {
      withCredentials: true,
    })
      .then((response) => {
        setTareas(response.data);
      })
      .catch((error) => console.error("Error al traer tareas:", error));
  }, []);

  return (
    <Container>
      <h1 className="text-2xl font-bold text-slate-100 mb-6 mt-4">Tareas</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tareas.map((tarea) => (
          <div 
            key={tarea.id || tarea._id || tarea.titulo}
            className={`flex w-full max-w-md flex-col gap-4 rounded-3xl border
                        border-zinc-800 bg-zinc-900/80 p-8 shadow-2xl
                        shadow-black/60 backdrop-blur`} 
          >
            <h2 className="text-2xl font-bold text-slate-100">{tarea.titulo}</h2>
            <p>{tarea.descripcion}</p>
            {tarea.fechaEntrega && (<p>Fecha de entrega: {tarea.fechaEntrega}</p>)}
            <p>Estado: {tarea.estado || "No asignado"}</p>

            <div className="grid grid-cols-2 gap-3 mt-auto pt-4 border-t border-zinc-800/50">
              <Link to={`/tareas/editar/${tarea.id || tarea._id}`}>
                <Button>
                 < FaEdit /> Editar
                </Button>
              </Link>

              <Button 
                styles="bg-red-900 hover:bg-red-800"
                onClick={() => {
                    console.log("Eliminar tarea:", tarea.id || tarea._id)
                    if(window.confirm("¿Estás seguro de que deseas eliminar esta tarea?")) {
                        axios.delete(`http://localhost:3000/api/tareas/${tarea.id || tarea._id}`, {
                            withCredentials: true,
                        })
                        .then((response) => {
                            // Ajuste funcional para que filtre correctamente si usas id o _id
                            setTareas(tareas.filter(t => (t.id || t._id) !== (tarea.id || tarea._id)));
                            console.log("Respuesta del backend (DELETE tarea):", response.data);
                        })
                        .catch((error) => console.error("Error al eliminar tarea:", error));
                    }
                }}
              >
               < FaTrash /> Eliminar
              </Button>
            </div>
          </div>
        ))}
      </div>

      {tareas.length === 0 && (
        <p className="text-slate-400 mt-4">No hay tareas creadas todavía.</p>
      )}
    </Container>
  );
}

export default TareasPage;
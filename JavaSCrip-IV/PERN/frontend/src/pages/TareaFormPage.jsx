import { Card, Input, Textarea, Button, Container } from "../components/ui";
import { useForm } from "react-hook-form";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom"; 
import { useState, useEffect } from "react";

function TareaFormPage() {
  const { register, handleSubmit, formState: { errors, isSubmitting }, setValue } = useForm();
  const navigate = useNavigate();
  const { id } = useParams();
  const [formError, setFormError] = useState(null);
  
  const isEditing = Boolean(id);

  useEffect(() => {
    if (isEditing) {
      axios.get(`http://localhost:3000/api/tareas/${id}`, {
        withCredentials: true,
      })
        .then((response) => {
          console.log("Respuesta del backend (GET tarea):", response.data);
          const tarea = response.data[0];
          
          setValue("titulo", tarea.titulo);
          setValue("descripcion", tarea.descripcion);
          if (tarea.fechaEntrega) {
            setValue("fechaEntrega", tarea.fechaEntrega.split("T")[0]);
          }
          setValue("estado", tarea.estado);
        })
        .catch((error) => {
          console.error("Error al cargar la tarea:", error);
          setFormError(error.response?.data?.message || "Error al cargar la tarea");
        });
    }
  }, [id, isEditing, setValue]);

  const onSubmit = async (data) => {
    try {
      if (isEditing) {
        const response = await axios.put(`http://localhost:3000/api/tareas/${id}`, data, {
          withCredentials: true,
        });
        console.log("Respuesta del backend (PUT tarea):", response.data);
      } else {
        const response = await axios.post("http://localhost:3000/api/tareas", data, {
          withCredentials: true,
        });
        console.log("Respuesta del backend (POST tarea):", response.data);
      }
      
      navigate("/tareas"); 
    } catch (error) {
      setFormError(error.response?.data?.message || "Error al procesar la tarea");
      console.error("Error en la petición:", error.response?.data || error.message);
    }
  };

  return (
      <Card>
        <h2 className="text-2xl font-bold mb-6 text-slate-100 text-center">
          Formulario de Tareas
        </h2>

        <span className="text-sm text-red-500">{formError}</span>
        
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          
          <div className="flex flex-col gap-1">
            <Input 
              type="text" 
              placeholder="Título de la tarea" 
              autoFocus 
              {...register("titulo", { required: "El título es requerido" })}
            />
            {errors.titulo && <span className="text-red-500 text-xs">{errors.titulo.message}</span>}
          </div>

          <div className="flex flex-col gap-1">
            <Textarea 
              placeholder="Descripción de la tarea..."
              {...register("descripcion", { required: "La descripción es requerida" })}
            />
            {errors.descripcion && <span className="text-red-500 text-xs">{errors.descripcion.message}</span>}
          </div>

          <div className="flex flex-col gap-1">
            <Input 
              type="date" 
              className="text-slate-300"
              {...register("fechaEntrega")}
            />
          </div>

          <div className="flex flex-col gap-1">
            <select 
              className="flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              {...register("estado", { required: "El estado es requerido" })}
              defaultValue=""
            >
              <option value="" disabled>Selecciona un estado</option>
              <option value="pendiente">Pendiente</option>
              <option value="en progreso">En progreso</option>
              <option value="completada">Completada</option>
            </select>
            {errors.estado && <span className="text-red-500 text-xs">{errors.estado.message}</span>}
          </div>

          <Button 
            type="submit" 
            disabled={isSubmitting}
            className="mt-4 bg-sky-500 hover:bg-sky-600 text-white font-medium py-2 rounded-md transition-colors"
          >
            {isSubmitting ? (isEditing ? "Actualizando..." : "Creando...") : (isEditing ? "Actualizar Tarea" : "Crear Tarea")}
          </Button>
          
        </form>
      </Card>
  );
}

export default TareaFormPage;
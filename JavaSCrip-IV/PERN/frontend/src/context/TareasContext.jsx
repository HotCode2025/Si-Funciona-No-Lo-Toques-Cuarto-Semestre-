import { createContext, useContext, useState } from "react";
import axios from "axios";

// 1. Crear el contexto
const TareasContext = createContext();

// 2. Hook personalizado para consumir el contexto (tu captura)
export const useTareas = () => {
  const context = useContext(TareasContext);
  
  if (!context) {
    throw new Error("useTareas debe estar dentro del proveedor TareasProvider");
  }
  
  return context;
};

// 3. El proveedor
export const TareasProvider = ({ children }) => {
  const [tareas, setTareas] = useState([]);

  // 4. Función listarTareas con Axios adentro
  const listarTareas = async () => {
    return axios.get("http://localhost:3000/api/tareas", {
      withCredentials: true,
    })
      .then((response) => {
        setTareas(response.data);
        return response.data; // Retornamos por si se necesita en algún componente
      })
      .catch((error) => console.error("Error al traer tareas:", error));
  };

  return (
    <TareasContext.Provider
      value={{
        tareas,
        setTareas,
        listarTareas 
      }}
    >
      {children}
    </TareasContext.Provider>
  );
};
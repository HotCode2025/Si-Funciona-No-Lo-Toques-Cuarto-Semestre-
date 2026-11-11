import {z} from "zod";

export const createTareaSchema = z.object({
    titulo: z.string({invalid_type_error: "El título debe ser una cadena de texto", required_error: "El título es requerido"}).min(1, { message: "El título es requerido" }),
    descripcion: z.string({required_error: "La descripción es requerida"}).min(1, { message: "La descripción es requerida" }),
    fechaEntrega: z.string().optional(),
    estado: z.enum(["pendiente", "en progreso", "completada"], { message: "El estado es requerido" }),
});

export const updateTareaSchema = z.object({
    titulo: z.string({invalid_type_error: "El título debe ser una cadena de texto"}).optional(),
    descripcion: z.string({required_error: "La descripción es requerida"}).optional(),
    fechaEntrega: z.string().optional(),
    estado: z.enum(["pendiente", "en progreso", "completada"]).optional(),
}); 
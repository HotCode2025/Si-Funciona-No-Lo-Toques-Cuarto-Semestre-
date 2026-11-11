import Router from 'express-promise-router';
import { listarTareas, listarTarea, crearTarea, actualizarTarea, eliminarTarea } from '../controllers/tareas.controller.js';
import isAuthenticated from '../middlewares/auth.middleware.js';
import { validateSchema } from '../middlewares/validate.middleware.js';
import { createTareaSchema, updateTareaSchema } from '../schemas/tareas.schemas.js';

const router = Router();

router.get('/tareas', isAuthenticated, listarTareas);

router.get('/tareas/:id', isAuthenticated, listarTarea);

router.post('/tareas', isAuthenticated, validateSchema(createTareaSchema), crearTarea);

router.put('/tareas/:id', isAuthenticated, validateSchema(updateTareaSchema), actualizarTarea);

router.delete('/tareas/:id', isAuthenticated, eliminarTarea);

export default router;
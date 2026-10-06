import Router from 'express-promise-router';
import { listarTareas, listarTarea, crearTarea, actualizarTarea, eliminarTarea } from '../controllers/tareas.controller.js';
import isAuthenticated from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/tareas', isAuthenticated, listarTareas);

router.get('/tareas/:id', isAuthenticated, listarTarea);

router.post('/tareas', isAuthenticated, crearTarea);

router.put('/tareas/:id', isAuthenticated, actualizarTarea);

router.delete('/tareas/:id', isAuthenticated, eliminarTarea);

export default router;
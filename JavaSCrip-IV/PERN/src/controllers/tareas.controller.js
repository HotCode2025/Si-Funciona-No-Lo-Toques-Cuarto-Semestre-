import { pool } from '../db.js';

export const listarTareas = async (req, res) => {
    if (!req.userId) {
        return res.status(401).json({ message: 'Usuario no autenticado' });
    }
    const result = await pool.query('SELECT * FROM tareas');
    console.log(req.userId);
    res.json(result.rows);
};

export const listarTarea = async (req, res) => {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM tareas WHERE id = $1', [id]);
    console.log(result);
    if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Tarea no encontrada' });
    }
    return res.json(result.rows);
};

export const crearTarea = async (req, res) => {
    console.log(req.body);
    const result = await pool.query('INSERT INTO tareas (titulo, descripcion) VALUES ($1, $2) RETURNING *', [req.body.titulo, req.body.descripcion]);
    console.log(result);
    res.status(201).json({ message: 'Tarea creada exitosamente', tarea: result.rows[0] });
};

export const actualizarTarea = async (req, res) => {
    const { id } = req.params;
    const { titulo, descripcion } = req.body;

    const result = await pool.query('UPDATE tareas SET titulo = $1, descripcion = $2 WHERE id = $3 RETURNING *', [titulo, descripcion, id]);
    console.log(result);
    if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Tarea no encontrada' });
    }
    res.json(result.rows[0]);
};

export const eliminarTarea = async (req, res) => {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM tareas WHERE id = $1 RETURNING *', [id]);
    console.log(result);
    if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Tarea no encontrada' });
    }
    res.sendStatus(204).json({ message: 'Tarea eliminada exitosamente' });
};

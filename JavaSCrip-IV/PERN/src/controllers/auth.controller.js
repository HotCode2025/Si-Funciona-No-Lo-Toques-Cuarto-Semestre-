import { pool } from '../db.js';
import bcrypt from 'bcrypt';
import {createAccessToken} from '../libs/jwt.js';

export const signin = (req, res) => {
    res.send('login route');
};
export const signup = async (req, res) => {
    const { name, email, password } = req.body;
    
    try{
        const hashedPassword = bcrypt.hashSync(password, 10);
        console.log('Hashed password:', hashedPassword);
        const result = await pool.query('INSERT INTO usuarios (name, email, password) VALUES ($1, $2, $3) RETURNING *', [name, email, hashedPassword]);
        console.log(result);

        const token = await createAccessToken({ id: result.rows[0].id });

        res.cookie('token', token, { httpOnly: true, sameSite: 'none', maxAge: 3600000 });
        res.json({token: token});
    } catch (error) {
        console.error('Error creating user:', error);
        if (error.code === '23505') { 
            return res.status(400).json({ message: 'Ya existe un usuario con ese mail' });
        }
        res.status(500).json({ message: 'Error al crear usuario' });   
    }
};
export const signout = (req, res) => {
    res.send('logout route');
};
export const profile = (req, res) => {
    res.send('profile route');
};
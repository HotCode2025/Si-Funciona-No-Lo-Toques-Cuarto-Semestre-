import { pool } from '../db.js';
import bcrypt from 'bcrypt';
import {createAccessToken} from '../libs/jwt.js';
import md5 from 'md5';

export const signin = async (req, res, next) => {
    const [email, password] = [req.body.email, req.body.password];
    try{

        const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        if(result.rowCount === 0){
            return res.status(400).json({ message: 'El correo no esta registrado' });
        }
        
        const validPassword = bcrypt.compareSync(password, result.rows[0].password);
        if(!validPassword){
            return res.status(400).json({ message: 'Contraseña incorrecta' });
        }

        const token = await createAccessToken({ id: result.rows[0].id });
        
        res.cookie('token', token, { 
            //httpOnly: true, 
            secure: true,
            sameSite: 'none', 
            maxAge: 3600000 });
            res.json({name: result.rows[0].name, email: result.rows[0].email, gravatar: result.rows[0].gravatar});

        } catch (error) {
            console.error('Error signing in user:', error);
            res.status(500).json({ message: 'Error al iniciar sesión' });
            next(error);
        }
};
export const signup = async (req, res, next) => {
    const { name, email, password } = req.body;
    
    try{
        const hashedPassword = bcrypt.hashSync(password, 10);
        const gravatar = `https://www.gravatar.com/avatar/${md5(email)}?d=identicon`;
        const result = await pool.query('INSERT INTO usuarios (name, email, password, gravatar) VALUES ($1, $2, $3, $4) RETURNING *', [name, email, hashedPassword, gravatar]);
        console.log(result);

        const token = await createAccessToken({ id: result.rows[0].id });

        res.cookie('token', token, { 
            //httpOnly: true, 
            secure: true,
            sameSite: 'none',
            maxAge: 3600000 
        });
        res.json({name: result.rows[0].name, email: result.rows[0].email, gravatar: result.rows[0].gravatar});
    } catch (error) {
        console.error('Error creating user:', error);
        if (error.code === '23505') { 
            return res.status(400).json({ message: 'Ya existe un usuario con ese mail' });
        }
        next(error);
    }
};
export const signout = (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Sesión cerrada' });
};
export const profile = async (req, res) => {
    const result = await pool.query('SELECT * FROM usuarios WHERE id = $1', [req.userId]);
    res.json(result.rows[0]);
};
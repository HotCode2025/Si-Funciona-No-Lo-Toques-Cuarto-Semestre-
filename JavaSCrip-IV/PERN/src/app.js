import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import tareasRoutes from './router/tareas.routes.js';
import authRoutes from './router/auth.routes.js';
import cookieParser from 'cookie-parser';

const app = express();

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use("/api", tareasRoutes);
app.use("/api", authRoutes);

// Routes
app.get('/', (req, res) => {
    res.json({'message': 'Hello, World!'});
});

app.get('/test', (req, res) => {
    res.send('test route working!');
});

app.use((err, req, res, next) => {
    res.status(500).json({ error: 'UPS!! parece que algo fallo en el servidor..' });
});

export default app;
import 'dotenv/config';

const requerido = (clave, porDefecto) => {
  const valor = process.env[clave] ?? porDefecto;
  if (valor === undefined) {
    throw new Error(`Falta la variable de entorno ${clave}. Copiá .env.example a .env.`);
  }
  return valor;
};

export const config = {
  env:        process.env.NODE_ENV ?? 'development',
  port:       Number(process.env.PORT ?? 3000),
  host:       process.env.HOST ?? '0.0.0.0',
  databaseUrl: requerido('DATABASE_URL'),
  jwtSecret:  requerido('JWT_SECRET'),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
};

export const isProd = config.env === 'production';

if (isProd && config.jwtSecret.startsWith('cambiame')) {
  throw new Error('Estás en producción con el JWT_SECRET de ejemplo. Generá uno real.');
}

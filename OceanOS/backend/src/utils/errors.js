/** Error de dominio: llega al cliente con código y mensaje propios. */
export class AppError extends Error {
  constructor(message, statusCode = 400, code = 'ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const badRequest   = (m = 'Revisá los datos enviados') => new AppError(m, 400, 'BAD_REQUEST');
export const unauthorized = (m = 'Necesitás iniciar sesión')  => new AppError(m, 401, 'UNAUTHORIZED');
export const forbidden    = (m = 'No tenés permiso para esto')=> new AppError(m, 403, 'FORBIDDEN');
export const notFound     = (m = 'No encontramos eso')        => new AppError(m, 404, 'NOT_FOUND');
export const conflict     = (m = 'Ese registro ya existe')    => new AppError(m, 409, 'CONFLICT');

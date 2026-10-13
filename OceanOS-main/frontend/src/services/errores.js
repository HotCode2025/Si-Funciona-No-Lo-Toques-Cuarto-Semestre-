/**
 * Error normalizado de la API. Vive aparte de api.js porque lo usan tanto
 * el cliente como el servidor de demostración, y si cada uno importara al
 * otro quedaría una dependencia circular.
 */
export class ApiError extends Error {
  constructor(message, code, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

// Los mismos códigos que backend/src/utils/errors.js.
export const badRequest = (m = 'Revisá los datos enviados') => new ApiError(m, 'BAD_REQUEST', 400);
export const forbidden  = (m = 'No tenés permiso para esto') => new ApiError(m, 'FORBIDDEN', 403);
export const notFound   = (m = 'No encontramos eso') => new ApiError(m, 'NOT_FOUND', 404);

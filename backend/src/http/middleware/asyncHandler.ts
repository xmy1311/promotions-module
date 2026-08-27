import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Express 4 no propaga el rechazo de un handler asíncrono al manejador de
 * errores: sin este envoltorio, un fallo de la base de datos dejaría la
 * petición colgada hasta el timeout del cliente.
 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

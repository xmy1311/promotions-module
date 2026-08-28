import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Evitar que errores no controlados rompan la aplicación */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

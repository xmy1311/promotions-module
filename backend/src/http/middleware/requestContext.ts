import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { Logger } from '../../config/logger';

declare module 'express-serve-static-core' {
  interface Request {
    requestId: string;
  }
}

/** controlar error inesperado 500 */
export function requestContext(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    req.requestId = randomUUID();
    res.setHeader('x-request-id', req.requestId);

    const startedAt = Date.now();
    res.on('finish', () => {
      logger.info(
        {
          requestId: req.requestId,
          method: req.method,
          path: req.originalUrl,
          status: res.statusCode,
          durationMs: Date.now() - startedAt,
        },
        'request',
      );
    });

    next();
  };
}

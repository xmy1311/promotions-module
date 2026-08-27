import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError, type FieldIssue } from '../../domain/errors';
import type { Logger } from '../../config/logger';

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: FieldIssue[];
    requestId?: string;
  };
}

/**
 * body-parser marca así un cuerpo que no es JSON válido. Es un error del
 * cliente (400) y no un fallo del servidor: sin este caso terminaría como un
 * 500 genérico y el consumidor de la API no sabría qué corregir.
 */
function isJsonParseError(error: unknown): boolean {
  return (
    error instanceof SyntaxError &&
    (error as SyntaxError & { type?: unknown }).type === 'entity.parse.failed'
  );
}

function zodIssues(error: ZodError): FieldIssue[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || 'body',
    message: issue.message,
  }));
}

/**
 * Único punto donde un error se convierte en respuesta. Los errores previstos
 * viajan con su código de dominio; cualquier otro se registra completo y se
 * responde con un 500 genérico: al cliente nunca le llega un stack trace, el
 * mensaje del driver ni la cadena de conexión.
 */
export function errorHandler(logger: Logger) {
  return (error: unknown, req: Request, res: Response, _next: NextFunction): void => {
    const requestId = req.requestId;

    if (isJsonParseError(error)) {
      const body: ErrorBody = {
        error: {
          code: 'INVALID_JSON',
          message: 'El cuerpo de la petición no es JSON válido',
        },
      };
      res.status(400).json(body);
      return;
    }

    if (error instanceof ZodError) {
      const body: ErrorBody = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'La solicitud no es válida',
          details: zodIssues(error),
        },
      };
      res.status(422).json(body);
      return;
    }

    if (error instanceof AppError) {
      const body: ErrorBody = {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details.length > 0 ? { details: error.details } : {}),
        },
      };
      res.status(error.httpStatus).json(body);
      return;
    }

    logger.error({ requestId, err: error }, 'Error no controlado');

    const body: ErrorBody = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Ocurrió un error inesperado',
        requestId,
      },
    };
    res.status(500).json(body);
  };
}

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

/** Bad Request */
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

/** Al cliente nunca le llega un stack, la cadena de conexión ni el driver. */
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

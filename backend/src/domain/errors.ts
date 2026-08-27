export type AppErrorCode =
  | 'INVALID_JSON'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'INVALID_STATE_TRANSITION'
  | 'PROMOTION_IS_IMMUTABLE'
  | 'DELETE_NOT_ALLOWED'
  | 'INTERNAL_ERROR';

export interface FieldIssue {
  field: string;
  message: string;
}

/**
 * Error de negocio con la información mínima que el borde HTTP necesita para
 * construir una respuesta. El dominio decide el `code`; la capa HTTP se limita
 * a traducirlo. Ningún error de esta jerarquía transporta detalles de
 * infraestructura.
 */
export class AppError extends Error {
  constructor(
    readonly code: AppErrorCode,
    readonly httpStatus: number,
    message: string,
    readonly details: FieldIssue[] = [],
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(details: FieldIssue[], message = 'La solicitud no es válida') {
    super('VALIDATION_ERROR', 422, message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'El recurso solicitado no existe') {
    super('NOT_FOUND', 404, message);
  }
}

export class InvalidStateTransitionError extends AppError {
  constructor(message: string) {
    super('INVALID_STATE_TRANSITION', 409, message);
  }
}

export class PromotionImmutableError extends AppError {
  constructor(
    message = 'Una promoción finalizada no puede modificarse ni cambiar de estado',
  ) {
    super('PROMOTION_IS_IMMUTABLE', 409, message);
  }
}

export class DeleteNotAllowedError extends AppError {
  constructor(
    message = 'Solo se pueden eliminar promociones en estado Programada',
  ) {
    super('DELETE_NOT_ALLOWED', 409, message);
  }
}

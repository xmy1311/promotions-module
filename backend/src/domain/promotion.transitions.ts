import type { IsoDate } from './dates';
import {
  DeleteNotAllowedError,
  InvalidStateTransitionError,
  PromotionImmutableError,
} from './errors';
import type { Promotion, PromotionStatus } from './promotion.types';

/**
 * La máquina de estados es un dato, no una cadena de condicionales: añadir un
 * estado es editar esta tabla, no repartir `if` por los servicios.
 *
 *   SCHEDULED --activar--> ACTIVE --finalizar--> FINISHED (terminal)
 */
export const ALLOWED_TRANSITIONS: Record<PromotionStatus, readonly PromotionStatus[]> = {
  SCHEDULED: ['ACTIVE'],
  ACTIVE: ['FINISHED'],
  FINISHED: [],
};

export function canTransition(from: PromotionStatus, to: PromotionStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/**
 * Decisión documentada (AMB-03): no se permite activar una promoción cuyo rango
 * ya terminó. Activar algo caducado es exactamente el error que el módulo
 * existe para evitar.
 */
export function assertTransitionAllowed(
  promotion: Promotion,
  to: PromotionStatus,
  today: IsoDate,
): void {
  if (promotion.status === 'FINISHED') {
    throw new PromotionImmutableError();
  }

  if (!canTransition(promotion.status, to)) {
    throw new InvalidStateTransitionError(
      `No se puede pasar de ${promotion.status} a ${to}`,
    );
  }

  if (promotion.status === 'SCHEDULED' && to === 'ACTIVE' && promotion.endDate < today) {
    throw new InvalidStateTransitionError(
      'No se puede activar una promoción cuya fecha de fin ya pasó',
    );
  }
}

/** Una promoción finalizada es inmutable en todo, no solo en sus datos. */
export function assertMutable(promotion: Promotion): void {
  if (promotion.status === 'FINISHED') {
    throw new PromotionImmutableError();
  }
}

export function assertDeletable(promotion: Promotion): void {
  if (promotion.status !== 'SCHEDULED') {
    throw new DeleteNotAllowedError();
  }
}

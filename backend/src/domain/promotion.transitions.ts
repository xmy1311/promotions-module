import type { IsoDate } from './dates';
import {
  DeleteNotAllowedError,
  InvalidStateTransitionError,
  PromotionImmutableError,
} from './errors';
import type { Promotion, PromotionStatus } from './promotion.types';

/**
 * Agrega las transiciones de estado permitidas para cada estado.
 * Se puede pasar de SCHEDULED a ACTIVE y de ACTIVE a FINISHED.
 */
export const ALLOWED_TRANSITIONS: Record<PromotionStatus, readonly PromotionStatus[]> = {
  SCHEDULED: ['ACTIVE'],
  ACTIVE: ['FINISHED'],
  FINISHED: [],
};

export function canTransition(from: PromotionStatus, to: PromotionStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/**No se activar una promoción ya finalizada */
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

/**Una promocion finalizada no es editable */
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

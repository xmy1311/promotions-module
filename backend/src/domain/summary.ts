import type { IsoDate } from './dates';
import { isInDateRange } from './promotion.rules';
import type { Promotion } from './promotion.types';

export interface PromotionSummary {
  scheduled: number;
  active: number;
  finished: number;
  /**ACTIVE y dentro del rango*/
  activeToday: number;
  today: IsoDate;
}


export function buildSummary(promotions: readonly Promotion[], today: IsoDate): PromotionSummary {
  const summary: PromotionSummary = {
    scheduled: 0,
    active: 0,
    finished: 0,
    activeToday: 0,
    today,
  };

  for (const promotion of promotions) {
    switch (promotion.status) {
      case 'SCHEDULED':
        summary.scheduled += 1;
        break;
      case 'ACTIVE':
        summary.active += 1;
        if (isInDateRange(promotion, today)) {
          summary.activeToday += 1;
        }
        break;
      case 'FINISHED':
        summary.finished += 1;
        break;
    }
  }

  return summary;
}

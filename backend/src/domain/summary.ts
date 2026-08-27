import type { IsoDate } from './dates';
import { isInDateRange } from './promotion.rules';
import type { Promotion } from './promotion.types';

export interface PromotionSummary {
  scheduled: number;
  active: number;
  finished: number;
  /**
   * Decisión documentada (AMB-08): cuenta las promociones que realmente están
   * descontando hoy, es decir estado ACTIVE *y* fecha de hoy dentro del rango.
   * Se devuelve `today` para que el criterio sea auditable desde fuera.
   */
  activeToday: number;
  today: IsoDate;
}

/**
 * El resumen se calcula en el dominio a partir de la lista completa, no con una
 * agregación en SQL, para que exista una sola definición de "vigente hoy" y
 * quede cubierta por tests unitarios. Con el volumen de un módulo de
 * promociones el coste es irrelevante; si creciera, la agregación se movería a
 * SQL usando esta función como oráculo de los tests.
 */
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

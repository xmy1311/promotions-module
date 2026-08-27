import { describe, expect, it } from 'vitest';
import { buildSummary } from '../../src/domain/summary';
import { makePromotion } from '../helpers/inMemoryRepositories';

const TODAY = '2026-06-15';

describe('buildSummary', () => {
  it('devuelve todos los contadores en cero cuando no hay promociones', () => {
    expect(buildSummary([], TODAY)).toEqual({
      scheduled: 0,
      active: 0,
      finished: 0,
      activeToday: 0,
      today: TODAY,
    });
  });

  it('cuenta las promociones por estado', () => {
    const summary = buildSummary(
      [
        makePromotion({ id: 1, status: 'SCHEDULED' }),
        makePromotion({ id: 2, status: 'SCHEDULED' }),
        makePromotion({ id: 3, status: 'ACTIVE' }),
        makePromotion({ id: 4, status: 'FINISHED' }),
      ],
      TODAY,
    );

    expect(summary).toMatchObject({ scheduled: 2, active: 1, finished: 1 });
  });

  // Decisión AMB-08: "vigentes hoy" es lo que realmente está descontando.
  it('solo cuenta como vigente hoy lo que está Activa y dentro del rango', () => {
    const summary = buildSummary(
      [
        makePromotion({ id: 1, status: 'ACTIVE', startDate: '2026-06-01', endDate: '2026-06-30' }),
        makePromotion({ id: 2, status: 'ACTIVE', startDate: '2026-01-01', endDate: '2026-05-31' }),
        makePromotion({ id: 3, status: 'SCHEDULED', startDate: '2026-06-01', endDate: '2026-06-30' }),
        makePromotion({ id: 4, status: 'FINISHED', startDate: '2026-06-01', endDate: '2026-06-30' }),
      ],
      TODAY,
    );

    expect(summary.activeToday).toBe(1);
  });

  it('incluye los días límite del rango', () => {
    const summary = buildSummary(
      [
        makePromotion({ id: 1, status: 'ACTIVE', startDate: TODAY, endDate: '2026-12-31' }),
        makePromotion({ id: 2, status: 'ACTIVE', startDate: '2026-01-01', endDate: TODAY }),
      ],
      TODAY,
    );

    expect(summary.activeToday).toBe(2);
  });

  it('devuelve la fecha usada para que el criterio sea auditable', () => {
    expect(buildSummary([], TODAY).today).toBe(TODAY);
  });
});

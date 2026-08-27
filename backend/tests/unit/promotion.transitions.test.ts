import { describe, expect, it } from 'vitest';
import {
  DeleteNotAllowedError,
  InvalidStateTransitionError,
  PromotionImmutableError,
} from '../../src/domain/errors';
import {
  assertDeletable,
  assertMutable,
  assertTransitionAllowed,
  canTransition,
} from '../../src/domain/promotion.transitions';
import { makePromotion } from '../helpers/inMemoryRepositories';

const TODAY = '2026-06-15';

describe('canTransition', () => {
  it('permite únicamente la cadena Programada -> Activa -> Finalizada', () => {
    expect(canTransition('SCHEDULED', 'ACTIVE')).toBe(true);
    expect(canTransition('ACTIVE', 'FINISHED')).toBe(true);
  });

  it.each([
    ['SCHEDULED', 'FINISHED'],
    ['ACTIVE', 'SCHEDULED'],
    ['FINISHED', 'ACTIVE'],
    ['FINISHED', 'SCHEDULED'],
    ['SCHEDULED', 'SCHEDULED'],
    ['ACTIVE', 'ACTIVE'],
  ] as const)('rechaza %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });
});

describe('assertTransitionAllowed', () => {
  it('activa una promoción programada cuyo rango sigue vigente', () => {
    const promotion = makePromotion({ status: 'SCHEDULED', endDate: '2026-12-31' });
    expect(() => assertTransitionAllowed(promotion, 'ACTIVE', TODAY)).not.toThrow();
  });

  it('activa una promoción programada cuyo rango aún no empieza', () => {
    const promotion = makePromotion({
      status: 'SCHEDULED',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
    });
    expect(() => assertTransitionAllowed(promotion, 'ACTIVE', TODAY)).not.toThrow();
  });

  // Decisión AMB-03: activar algo caducado es el error que el módulo evita.
  it('rechaza activar una promoción cuya fecha de fin ya pasó', () => {
    const promotion = makePromotion({
      status: 'SCHEDULED',
      startDate: '2026-01-01',
      endDate: '2026-05-31',
    });
    expect(() => assertTransitionAllowed(promotion, 'ACTIVE', TODAY)).toThrow(
      InvalidStateTransitionError,
    );
  });

  it('permite finalizar una promoción activa antes de que venza su rango', () => {
    const promotion = makePromotion({ status: 'ACTIVE', endDate: '2026-12-31' });
    expect(() => assertTransitionAllowed(promotion, 'FINISHED', TODAY)).not.toThrow();
  });

  it('rechaza el salto de Programada a Finalizada', () => {
    const promotion = makePromotion({ status: 'SCHEDULED' });
    expect(() => assertTransitionAllowed(promotion, 'FINISHED', TODAY)).toThrow(
      InvalidStateTransitionError,
    );
  });

  it('trata Finalizada como estado terminal', () => {
    const promotion = makePromotion({ status: 'FINISHED' });
    expect(() => assertTransitionAllowed(promotion, 'ACTIVE', TODAY)).toThrow(
      PromotionImmutableError,
    );
  });
});

describe('assertMutable', () => {
  it.each(['SCHEDULED', 'ACTIVE'] as const)('permite modificar una promoción %s', (status) => {
    expect(() => assertMutable(makePromotion({ status }))).not.toThrow();
  });

  it('impide modificar una promoción finalizada', () => {
    expect(() => assertMutable(makePromotion({ status: 'FINISHED' }))).toThrow(
      PromotionImmutableError,
    );
  });
});

describe('assertDeletable', () => {
  it('permite eliminar solo en estado Programada', () => {
    expect(() => assertDeletable(makePromotion({ status: 'SCHEDULED' }))).not.toThrow();
  });

  it.each(['ACTIVE', 'FINISHED'] as const)('impide eliminar una promoción %s', (status) => {
    expect(() => assertDeletable(makePromotion({ status }))).toThrow(DeleteNotAllowedError);
  });
});

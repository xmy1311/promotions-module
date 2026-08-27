import { describe, expect, it } from 'vitest';
import { isInDateRange, validatePromotionDraft } from '../../src/domain/promotion.rules';
import { makeDraft, makePromotion } from '../helpers/inMemoryRepositories';

const fieldsOf = (draft: Parameters<typeof validatePromotionDraft>[0]): string[] =>
  validatePromotionDraft(draft).map((issue) => issue.field);

describe('validatePromotionDraft', () => {
  it('acepta una promoción válida', () => {
    expect(validatePromotionDraft(makeDraft())).toEqual([]);
  });

  describe('nombre', () => {
    it('rechaza el nombre vacío', () => {
      expect(fieldsOf(makeDraft({ name: '' }))).toContain('name');
    });

    it('rechaza un nombre compuesto solo por espacios', () => {
      expect(fieldsOf(makeDraft({ name: '   ' }))).toContain('name');
    });

    it('rechaza un nombre que excede la longitud máxima', () => {
      expect(fieldsOf(makeDraft({ name: 'x'.repeat(121) }))).toContain('name');
    });
  });

  describe('objetivo', () => {
    it('rechaza una categoría vacía', () => {
      const draft = makeDraft({ target: { type: 'CATEGORY', category: '  ' } });
      expect(fieldsOf(draft)).toContain('category');
    });

    it('rechaza un identificador de producto inválido', () => {
      const draft = makeDraft({ target: { type: 'PRODUCT', productId: 0 } });
      expect(fieldsOf(draft)).toContain('productId');
    });

    it('acepta un producto válido', () => {
      const draft = makeDraft({ target: { type: 'PRODUCT', productId: 1 } });
      expect(validatePromotionDraft(draft)).toEqual([]);
    });
  });

  describe('valor del descuento', () => {
    it('rechaza un valor ausente', () => {
      const draft = makeDraft({ discountValue: Number.NaN });
      expect(fieldsOf(draft)).toContain('discountValue');
    });

    it('rechaza cero y valores negativos', () => {
      expect(fieldsOf(makeDraft({ discountValue: 0 }))).toContain('discountValue');
      expect(fieldsOf(makeDraft({ discountValue: -5 }))).toContain('discountValue');
    });

    it('rechaza más de dos decimales', () => {
      expect(fieldsOf(makeDraft({ discountValue: 10.555 }))).toContain('discountValue');
    });

    it.each([1, 50, 100])('acepta el porcentaje %i', (value) => {
      expect(validatePromotionDraft(makeDraft({ discountValue: value }))).toEqual([]);
    });

    it.each([0.5, 0.99, 100.01, 101, 500])('rechaza el porcentaje %s', (value) => {
      expect(fieldsOf(makeDraft({ discountValue: value }))).toContain('discountValue');
    });

    it('permite montos fijos mayores a 100 porque el límite es solo del porcentaje', () => {
      const draft = makeDraft({ discountType: 'FIXED_AMOUNT', discountValue: 25000 });
      expect(validatePromotionDraft(draft)).toEqual([]);
    });
  });

  describe('rango de fechas', () => {
    it('rechaza una fecha de fin anterior a la de inicio', () => {
      const draft = makeDraft({ startDate: '2026-05-10', endDate: '2026-05-01' });
      expect(fieldsOf(draft)).toContain('endDate');
    });

    it('rechaza fechas iguales porque el enunciado exige "posterior"', () => {
      const draft = makeDraft({ startDate: '2026-05-10', endDate: '2026-05-10' });
      expect(fieldsOf(draft)).toContain('endDate');
    });

    it('acepta un rango de un solo día de diferencia', () => {
      const draft = makeDraft({ startDate: '2026-05-10', endDate: '2026-05-11' });
      expect(validatePromotionDraft(draft)).toEqual([]);
    });

    it('rechaza fechas con formato inválido', () => {
      const draft = makeDraft({ startDate: '10/05/2026', endDate: '2026-05-11' });
      expect(fieldsOf(draft)).toContain('startDate');
    });
  });

  it('reporta todos los problemas a la vez y no solo el primero', () => {
    const draft = makeDraft({
      name: '',
      discountValue: 500,
      startDate: '2026-05-10',
      endDate: '2026-05-01',
    });

    expect(fieldsOf(draft)).toEqual(
      expect.arrayContaining(['name', 'discountValue', 'endDate']),
    );
  });
});

describe('isInDateRange', () => {
  const promotion = makePromotion({ startDate: '2026-03-01', endDate: '2026-03-31' });

  it.each([
    ['2026-03-01', true],
    ['2026-03-15', true],
    ['2026-03-31', true],
    ['2026-02-28', false],
    ['2026-04-01', false],
  ])('para hoy=%s devuelve %s', (today, expected) => {
    expect(isInDateRange(promotion, today)).toBe(expected);
  });
});

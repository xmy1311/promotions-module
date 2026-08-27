import { isAfter, isIsoDate, isWithinRange, type IsoDate } from './dates';
import type { FieldIssue } from './errors';
import type { Promotion, PromotionDraft } from './promotion.types';

export const NAME_MAX_LENGTH = 120;
export const CATEGORY_MAX_LENGTH = 80;
export const PERCENTAGE_MIN = 1;
export const PERCENTAGE_MAX = 100;
export const MAX_DISCOUNT_DECIMALS = 2;

function hasAtMostTwoDecimals(value: number): boolean {
  return Number.isFinite(value) && Math.round(value * 100) === value * 100;
}

/**
 * Reglas de negocio de una promoción. Es una función pura: no conoce HTTP,
 * ni la base de datos, ni el reloj. Devuelve todos los problemas encontrados
 * en lugar de lanzar en el primero, para que el formulario pueda marcar cada
 * campo de una sola vez.
 */
export function validatePromotionDraft(draft: PromotionDraft): FieldIssue[] {
  const issues: FieldIssue[] = [];

  if (draft.name.trim().length === 0) {
    issues.push({ field: 'name', message: 'El nombre es obligatorio' });
  } else if (draft.name.trim().length > NAME_MAX_LENGTH) {
    issues.push({
      field: 'name',
      message: `El nombre no puede superar ${NAME_MAX_LENGTH} caracteres`,
    });
  }

  issues.push(...validateTarget(draft));
  issues.push(...validateDiscount(draft));
  issues.push(...validateDateRange(draft));

  return issues;
}

function validateTarget(draft: PromotionDraft): FieldIssue[] {
  if (draft.target.type === 'PRODUCT') {
    if (!Number.isInteger(draft.target.productId) || draft.target.productId <= 0) {
      return [{ field: 'productId', message: 'Debe seleccionar un producto válido' }];
    }
    return [];
  }

  const category = draft.target.category.trim();
  if (category.length === 0) {
    return [{ field: 'category', message: 'Debe seleccionar una categoría' }];
  }
  if (category.length > CATEGORY_MAX_LENGTH) {
    return [
      {
        field: 'category',
        message: `La categoría no puede superar ${CATEGORY_MAX_LENGTH} caracteres`,
      },
    ];
  }
  return [];
}

function validateDiscount(draft: PromotionDraft): FieldIssue[] {
  const { discountType, discountValue } = draft;

  if (!Number.isFinite(discountValue)) {
    return [{ field: 'discountValue', message: 'El valor del descuento es obligatorio' }];
  }

  if (discountValue <= 0) {
    return [
      { field: 'discountValue', message: 'El valor del descuento debe ser mayor que cero' },
    ];
  }

  if (!hasAtMostTwoDecimals(discountValue)) {
    return [
      {
        field: 'discountValue',
        message: `El valor admite máximo ${MAX_DISCOUNT_DECIMALS} decimales`,
      },
    ];
  }

  if (discountType === 'PERCENTAGE' && (discountValue < PERCENTAGE_MIN || discountValue > PERCENTAGE_MAX)) {
    return [
      {
        field: 'discountValue',
        message: `El porcentaje debe estar entre ${PERCENTAGE_MIN} y ${PERCENTAGE_MAX}`,
      },
    ];
  }

  return [];
}

function validateDateRange(draft: PromotionDraft): FieldIssue[] {
  const issues: FieldIssue[] = [];

  if (!isIsoDate(draft.startDate)) {
    issues.push({ field: 'startDate', message: 'La fecha de inicio no es válida' });
  }
  if (!isIsoDate(draft.endDate)) {
    issues.push({ field: 'endDate', message: 'La fecha de fin no es válida' });
  }
  if (issues.length > 0) {
    return issues;
  }

  // El enunciado exige "posterior": la igualdad de fechas también se rechaza.
  if (!isAfter(draft.endDate, draft.startDate)) {
    issues.push({
      field: 'endDate',
      message: 'La fecha de fin debe ser posterior a la fecha de inicio',
    });
  }

  return issues;
}

/**
 * Vigencia: propiedad derivada de las fechas, independiente del estado.
 * Una promoción puede estar Activa y no vigente hoy, y viceversa.
 */
export function isInDateRange(promotion: Promotion, today: IsoDate): boolean {
  return isWithinRange(today, promotion.startDate, promotion.endDate);
}

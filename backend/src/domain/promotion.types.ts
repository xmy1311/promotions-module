import type { IsoDate } from './dates';

export const PROMOTION_STATUSES = ['SCHEDULED', 'ACTIVE', 'FINISHED'] as const;
export type PromotionStatus = (typeof PROMOTION_STATUSES)[number];

export const DISCOUNT_TYPES = ['PERCENTAGE', 'FIXED_AMOUNT'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const TARGET_TYPES = ['PRODUCT', 'CATEGORY'] as const;
export type TargetType = (typeof TARGET_TYPES)[number];

/**
 * Asociación excluyente: la promoción apunta a un producto o a una categoría,
 * nunca a ambos ni a ninguno. La misma invariante está replicada como CHECK en
 * la base de datos para que se sostenga aunque alguien escriba por fuera de la API.
 */
export type PromotionTarget =
  | { type: 'PRODUCT'; productId: number }
  | { type: 'CATEGORY'; category: string };

/** Datos de una promoción antes de existir en la base de datos. */
export interface PromotionDraft {
  name: string;
  target: PromotionTarget;
  discountType: DiscountType;
  discountValue: number;
  startDate: IsoDate;
  endDate: IsoDate;
}

export interface Promotion extends PromotionDraft {
  id: number;
  status: PromotionStatus;
  /** Nombre del producto asociado; nulo cuando el objetivo es una categoría. */
  productName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  category: string;
}

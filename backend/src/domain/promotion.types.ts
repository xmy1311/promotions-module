import type { IsoDate } from './dates';

export const PROMOTION_STATUSES = ['SCHEDULED', 'ACTIVE', 'FINISHED'] as const;
export type PromotionStatus = (typeof PROMOTION_STATUSES)[number];

export const DISCOUNT_TYPES = ['PERCENTAGE', 'FIXED_AMOUNT'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const TARGET_TYPES = ['PRODUCT', 'CATEGORY'] as const;
export type TargetType = (typeof TARGET_TYPES)[number];

/** Una promocion apunta a un producto o categoría */
export type PromotionTarget =
  | { type: 'PRODUCT'; productId: number }
  | { type: 'CATEGORY'; category: string };

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
  /** Nulo cuando  es una categoría. */
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

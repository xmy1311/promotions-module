export const PROMOTION_STATUSES = ['SCHEDULED', 'ACTIVE', 'FINISHED'] as const;
export type PromotionStatus = (typeof PROMOTION_STATUSES)[number];

export const DISCOUNT_TYPES = ['PERCENTAGE', 'FIXED_AMOUNT'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const TARGET_TYPES = ['PRODUCT', 'CATEGORY'] as const;
export type TargetType = (typeof TARGET_TYPES)[number];

export type PromotionTarget =
  | { type: 'PRODUCT'; productId: number }
  | { type: 'CATEGORY'; category: string };

export interface Promotion {
  id: number;
  name: string;
  target: PromotionTarget;
  productName: string | null;
  discountType: DiscountType;
  discountValue: number;
  startDate: string;
  endDate: string;
  status: PromotionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  category: string;
}

export interface PromotionSummary {
  scheduled: number;
  active: number;
  finished: number;
  activeToday: number;
  today: string;
}

/** Cuerpo que espera la API. Se construye desde el formulario. */
export interface PromotionPayload {
  name: string;
  targetType: TargetType;
  productId?: number;
  category?: string;
  discountType: DiscountType;
  discountValue: number;
  startDate: string;
  endDate: string;
}

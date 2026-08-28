import type { DiscountType, Promotion, PromotionStatus } from './types';

/** los estados se muestran en la interfaz de usuario en español */
export const STATUS_LABELS: Record<PromotionStatus, string> = {
  SCHEDULED: 'Programada',
  ACTIVE: 'Activa',
  FINISHED: 'Finalizada',
};

export const STATUS_STYLES: Record<PromotionStatus, string> = {
  SCHEDULED: 'bg-amber-100 text-amber-800 ring-amber-200',
  ACTIVE: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  FINISHED: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  PERCENTAGE: 'Porcentaje',
  FIXED_AMOUNT: 'Monto fijo',
};

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 2,
});

export function formatDiscount(promotion: Promotion): string {
  return promotion.discountType === 'PERCENTAGE'
    ? `${promotion.discountValue}%`
    : currencyFormatter.format(promotion.discountValue);
}

export function formatTarget(promotion: Promotion): string {
  return promotion.target.type === 'PRODUCT'
    ? (promotion.productName ?? `Producto #${promotion.target.productId}`)
    : `Categoría: ${promotion.target.category}`;
}

/** Etiqueta de la única transición disponible desde el estado actual. */
export function nextTransitionLabel(status: PromotionStatus): string | null {
  if (status === 'SCHEDULED') return 'Activar';
  if (status === 'ACTIVE') return 'Finalizar';
  return null;
}

export function nextStatus(status: PromotionStatus): PromotionStatus | null {
  if (status === 'SCHEDULED') return 'ACTIVE';
  if (status === 'ACTIVE') return 'FINISHED';
  return null;
}

import type { Product, Promotion } from '../src/domain/types';

export const PRODUCTS: Product[] = [
  { id: 1, sku: 'BEB-001', name: 'Gaseosa 1.5 L', category: 'Bebidas' },
  { id: 2, sku: 'SNK-001', name: 'Papas fritas 150 g', category: 'Snacks' },
];

export const CATEGORIES = ['Bebidas', 'Snacks'];

export function makePromotion(overrides: Partial<Promotion> = {}): Promotion {
  return {
    id: 1,
    name: 'Descuento de temporada',
    target: { type: 'CATEGORY', category: 'Bebidas' },
    productName: null,
    discountType: 'PERCENTAGE',
    discountValue: 20,
    startDate: '2026-06-01',
    endDate: '2026-06-30',
    status: 'SCHEDULED',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

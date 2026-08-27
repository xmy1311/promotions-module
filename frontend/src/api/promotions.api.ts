import type {
  Product,
  Promotion,
  PromotionPayload,
  PromotionStatus,
  PromotionSummary,
} from '../domain/types';
import { apiFetch } from './client';

export function listPromotions(status?: PromotionStatus): Promise<Promotion[]> {
  const query = status === undefined ? '' : `?status=${status}`;
  return apiFetch<Promotion[]>(`/promotions${query}`);
}

export function getSummary(): Promise<PromotionSummary> {
  return apiFetch<PromotionSummary>('/promotions/summary');
}

export function createPromotion(payload: PromotionPayload): Promise<Promotion> {
  return apiFetch<Promotion>('/promotions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updatePromotion(id: number, payload: PromotionPayload): Promise<Promotion> {
  return apiFetch<Promotion>(`/promotions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function transitionPromotion(id: number, to: PromotionStatus): Promise<Promotion> {
  return apiFetch<Promotion>(`/promotions/${id}/transitions`, {
    method: 'POST',
    body: JSON.stringify({ to }),
  });
}

export function deletePromotion(id: number): Promise<void> {
  return apiFetch<void>(`/promotions/${id}`, { method: 'DELETE' });
}

export function listProducts(): Promise<Product[]> {
  return apiFetch<Product[]>('/products');
}

export function listCategories(): Promise<string[]> {
  return apiFetch<string[]>('/categories');
}

import type { Product, Promotion, PromotionDraft, PromotionStatus } from '../domain/promotion.types';

export interface PromotionFilter {
  status?: PromotionStatus;
}

/** Implementados con SQL en producción y en memoria en los tests. */
export interface PromotionRepository {
  findAll(filter?: PromotionFilter): Promise<Promotion[]>;
  findById(id: number): Promise<Promotion | null>;
  create(draft: PromotionDraft): Promise<Promotion>;
  replace(id: number, draft: PromotionDraft): Promise<Promotion>;
  updateStatus(id: number, status: PromotionStatus): Promise<Promotion>;
  remove(id: number): Promise<void>;
}

export interface ProductRepository {
  findAll(): Promise<Product[]>;
  existsById(id: number): Promise<boolean>;
  listCategories(): Promise<string[]>;
}

export interface DatabaseProbe {
  ping(timeoutMs: number): Promise<void>;
}

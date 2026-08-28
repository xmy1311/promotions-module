import type { Clock } from '../domain/clock';
import { NotFoundError, ValidationError, type FieldIssue } from '../domain/errors';
import { validatePromotionDraft } from '../domain/promotion.rules';
import {
  assertDeletable,
  assertMutable,
  assertTransitionAllowed,
} from '../domain/promotion.transitions';
import type {
  Promotion,
  PromotionDraft,
  PromotionStatus,
} from '../domain/promotion.types';
import { buildSummary, type PromotionSummary } from '../domain/summary';
import type { ProductRepository, PromotionFilter, PromotionRepository } from './ports';

/** Orquesta repositorios y dominio; no conoce Express ni SQL. */
export class PromotionService {
  constructor(
    private readonly promotions: PromotionRepository,
    private readonly products: ProductRepository,
    private readonly clock: Clock,
  ) {}

  list(filter: PromotionFilter = {}): Promise<Promotion[]> {
    return this.promotions.findAll(filter);
  }

  async getById(id: number): Promise<Promotion> {
    const promotion = await this.promotions.findById(id);
    if (promotion === null) {
      throw new NotFoundError(`No existe la promoción ${id}`);
    }
    return promotion;
  }

  async create(draft: PromotionDraft): Promise<Promotion> {
    await this.assertDraftIsValid(draft);
    return this.promotions.create(draft);
  }

  /** Reemplazo completo: el formulario siempre envía el recurso entero. */
  async replace(id: number, draft: PromotionDraft): Promise<Promotion> {
    const existing = await this.getById(id);
    assertMutable(existing);
    await this.assertDraftIsValid(draft);
    return this.promotions.replace(id, draft);
  }

  async changeStatus(id: number, to: PromotionStatus): Promise<Promotion> {
    const promotion = await this.getById(id);
    assertTransitionAllowed(promotion, to, this.clock.today());
    return this.promotions.updateStatus(id, to);
  }

  async remove(id: number): Promise<void> {
    const promotion = await this.getById(id);
    assertDeletable(promotion);
    await this.promotions.remove(id);
  }

  async summary(): Promise<PromotionSummary> {
    const promotions = await this.promotions.findAll();
    return buildSummary(promotions, this.clock.today());
  }

  /** Sin comprobar el catálogo, un productId inexistente sería 500 en vez de 422. */
  private async assertDraftIsValid(draft: PromotionDraft): Promise<void> {
    const issues: FieldIssue[] = validatePromotionDraft(draft);

    if (!issues.some((issue) => issue.field === 'productId' || issue.field === 'category')) {
      issues.push(...(await this.validateTargetExists(draft)));
    }

    if (issues.length > 0) {
      throw new ValidationError(issues);
    }
  }

  private async validateTargetExists(draft: PromotionDraft): Promise<FieldIssue[]> {
    if (draft.target.type === 'PRODUCT') {
      const exists = await this.products.existsById(draft.target.productId);
      return exists ? [] : [{ field: 'productId', message: 'El producto no existe' }];
    }

    const categories = await this.products.listCategories();
    return categories.includes(draft.target.category.trim())
      ? []
      : [{ field: 'category', message: 'La categoría no existe' }];
  }
}

import type {
  ProductRepository,
  PromotionFilter,
  PromotionRepository,
} from '../../src/application/ports';
import type {
  Product,
  Promotion,
  PromotionDraft,
  PromotionStatus,
} from '../../src/domain/promotion.types';

export const SEED_PRODUCTS: Product[] = [
  { id: 1, sku: 'BEB-001', name: 'Gaseosa 1.5 L', category: 'Bebidas' },
  { id: 2, sku: 'SNK-001', name: 'Papas fritas 150 g', category: 'Snacks' },
];

/**
 * Dobles en memoria que respetan el mismo contrato que las implementaciones
 * SQL. Permiten cubrir el 100% de las reglas de negocio sin levantar una base
 * de datos, dejando la verificación real de SQL Server al smoke test.
 */
export class InMemoryPromotionRepository implements PromotionRepository {
  private readonly rows = new Map<number, Promotion>();
  private nextId = 1;

  constructor(seed: Promotion[] = []) {
    for (const promotion of seed) {
      this.rows.set(promotion.id, promotion);
      this.nextId = Math.max(this.nextId, promotion.id + 1);
    }
  }

  async findAll(filter: PromotionFilter = {}): Promise<Promotion[]> {
    const all = [...this.rows.values()];
    const filtered =
      filter.status === undefined
        ? all
        : all.filter((promotion) => promotion.status === filter.status);

    return filtered.sort((a, b) => b.startDate.localeCompare(a.startDate) || b.id - a.id);
  }

  async findById(id: number): Promise<Promotion | null> {
    return this.rows.get(id) ?? null;
  }

  async create(draft: PromotionDraft): Promise<Promotion> {
    const id = this.nextId;
    this.nextId += 1;

    const promotion = materialize(id, draft, 'SCHEDULED');
    this.rows.set(id, promotion);
    return promotion;
  }

  async replace(id: number, draft: PromotionDraft): Promise<Promotion> {
    const existing = this.rows.get(id);
    if (existing === undefined) {
      throw new Error(`La promoción ${id} no existe`);
    }

    const updated = materialize(id, draft, existing.status);
    this.rows.set(id, updated);
    return updated;
  }

  async updateStatus(id: number, status: PromotionStatus): Promise<Promotion> {
    const existing = this.rows.get(id);
    if (existing === undefined) {
      throw new Error(`La promoción ${id} no existe`);
    }

    const updated: Promotion = { ...existing, status };
    this.rows.set(id, updated);
    return updated;
  }

  async remove(id: number): Promise<void> {
    this.rows.delete(id);
  }
}

export class InMemoryProductRepository implements ProductRepository {
  constructor(private readonly products: Product[] = SEED_PRODUCTS) {}

  async findAll(): Promise<Product[]> {
    return this.products;
  }

  async existsById(id: number): Promise<boolean> {
    return this.products.some((product) => product.id === id);
  }

  async listCategories(): Promise<string[]> {
    return [...new Set(this.products.map((product) => product.category))].sort();
  }
}

function materialize(
  id: number,
  draft: PromotionDraft,
  status: PromotionStatus,
): Promotion {
  // Se extrae a una constante para que TypeScript conserve el estrechamiento
  // del tipo dentro del callback de find.
  const target = draft.target;
  const productName =
    target.type === 'PRODUCT'
      ? (SEED_PRODUCTS.find((product) => product.id === target.productId)?.name ?? null)
      : null;

  return {
    ...draft,
    id,
    status,
    productName,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

/** Constructor de promociones para los tests, con valores por defecto válidos. */
export function makePromotion(overrides: Partial<Promotion> = {}): Promotion {
  return {
    id: 1,
    name: 'Promoción de prueba',
    target: { type: 'CATEGORY', category: 'Bebidas' },
    productName: null,
    discountType: 'PERCENTAGE',
    discountValue: 10,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    status: 'SCHEDULED',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeDraft(overrides: Partial<PromotionDraft> = {}): PromotionDraft {
  return {
    name: 'Promoción de prueba',
    target: { type: 'CATEGORY', category: 'Bebidas' },
    discountType: 'PERCENTAGE',
    discountValue: 10,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    ...overrides,
  };
}

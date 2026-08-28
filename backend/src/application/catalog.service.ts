import type { Product } from '../domain/promotion.types';
import type { ProductRepository } from './ports';

export class CatalogService {
  constructor(private readonly products: ProductRepository) {}

  listProducts(): Promise<Product[]> {
    return this.products.findAll();
  }

  listCategories(): Promise<string[]> {
    return this.products.listCategories();
  }
}

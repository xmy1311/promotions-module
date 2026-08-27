import sql from 'mssql';
import type { ProductRepository } from '../application/ports';
import type { Product } from '../domain/promotion.types';

interface ProductRow {
  id: number;
  sku: string;
  name: string;
  category: string;
}

export class SqlProductRepository implements ProductRepository {
  constructor(private readonly pool: sql.ConnectionPool) {}

  async findAll(): Promise<Product[]> {
    const result = await this.pool.request().query<ProductRow>(`
        SELECT id, sku, name, category
        FROM   dbo.products
        WHERE  is_active = 1
        ORDER BY category, name;
    `);

    return result.recordset;
  }

  async existsById(id: number): Promise<boolean> {
    const result = await this.pool
      .request()
      .input('id', sql.Int, id)
      .query<{ id: number }>('SELECT id FROM dbo.products WHERE id = @id AND is_active = 1;');

    return result.recordset.length > 0;
  }

  /**
   * La categoría no tiene tabla propia: es un atributo de products (decisión
   * AMB-01, 2 tablas). Este método es la fuente de verdad de las categorías
   * válidas y suple la integridad referencial que daría una tabla dedicada.
   */
  async listCategories(): Promise<string[]> {
    const result = await this.pool.request().query<{ category: string }>(`
        SELECT DISTINCT category
        FROM   dbo.products
        WHERE  is_active = 1
        ORDER BY category;
    `);

    return result.recordset.map((row) => row.category);
  }
}

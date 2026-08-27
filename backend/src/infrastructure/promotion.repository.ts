import sql from 'mssql';
import type { PromotionFilter, PromotionRepository } from '../application/ports';
import type {
  DiscountType,
  Promotion,
  PromotionDraft,
  PromotionStatus,
  TargetType,
} from '../domain/promotion.types';

interface PromotionRow {
  id: number;
  name: string;
  target_type: TargetType;
  product_id: number | null;
  category: string | null;
  product_name: string | null;
  discount_type: DiscountType;
  discount_value: number;
  start_date: Date | string;
  end_date: Date | string;
  status: PromotionStatus;
  created_at: Date;
  updated_at: Date;
}

const SELECT_PROMOTION = `
    SELECT  p.id,
            p.name,
            p.target_type,
            p.product_id,
            p.category,
            pr.name AS product_name,
            p.discount_type,
            p.discount_value,
            p.start_date,
            p.end_date,
            p.status,
            p.created_at,
            p.updated_at
    FROM    dbo.promotions p
    LEFT JOIN dbo.products pr ON pr.id = p.product_id
`;

/**
 * El driver devuelve una columna DATE como Date en UTC medianoche. Convertirla
 * con métodos locales desplazaría el día en cualquier zona negativa, así que se
 * leen los componentes UTC y se reconstruye la cadena ISO.
 */
function toIsoDate(value: Date | string): string {
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

function toPromotion(row: PromotionRow): Promotion {
  return {
    id: row.id,
    name: row.name,
    target:
      row.target_type === 'PRODUCT'
        ? { type: 'PRODUCT', productId: row.product_id as number }
        : { type: 'CATEGORY', category: row.category as string },
    productName: row.product_name,
    discountType: row.discount_type,
    discountValue: Number(row.discount_value),
    startDate: toIsoDate(row.start_date),
    endDate: toIsoDate(row.end_date),
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function bindDraft(request: sql.Request, draft: PromotionDraft): sql.Request {
  return request
    .input('name', sql.NVarChar(120), draft.name.trim())
    .input('targetType', sql.VarChar(10), draft.target.type)
    .input(
      'productId',
      sql.Int,
      draft.target.type === 'PRODUCT' ? draft.target.productId : null,
    )
    .input(
      'category',
      sql.NVarChar(80),
      draft.target.type === 'CATEGORY' ? draft.target.category.trim() : null,
    )
    .input('discountType', sql.VarChar(12), draft.discountType)
    .input('discountValue', sql.Decimal(12, 2), draft.discountValue)
    // Se envían como cadena y no como Date: SQL Server interpreta siempre
    // 'YYYY-MM-DD' como ISO para el tipo DATE, mientras que un objeto Date
    // obligaría a un viaje por husos horarios que puede desplazar el día.
    .input('startDate', sql.VarChar(10), draft.startDate)
    .input('endDate', sql.VarChar(10), draft.endDate);
}

/**
 * Única capa que conoce SQL. Todas las consultas usan parámetros tipados del
 * driver: no hay concatenación de entrada de usuario en ninguna sentencia, de
 * modo que la inyección SQL queda cerrada por construcción y no por saneado.
 */
export class SqlPromotionRepository implements PromotionRepository {
  constructor(private readonly pool: sql.ConnectionPool) {}

  async findAll(filter: PromotionFilter = {}): Promise<Promotion[]> {
    const request = this.pool.request();
    let whereClause = '';

    if (filter.status !== undefined) {
      request.input('status', sql.VarChar(12), filter.status);
      whereClause = 'WHERE p.status = @status';
    }

    const result = await request.query<PromotionRow>(
      `${SELECT_PROMOTION} ${whereClause} ORDER BY p.start_date DESC, p.id DESC`,
    );

    return result.recordset.map(toPromotion);
  }

  async findById(id: number): Promise<Promotion | null> {
    const result = await this.pool
      .request()
      .input('id', sql.Int, id)
      .query<PromotionRow>(`${SELECT_PROMOTION} WHERE p.id = @id`);

    const row = result.recordset[0];
    return row === undefined ? null : toPromotion(row);
  }

  async create(draft: PromotionDraft): Promise<Promotion> {
    const result = await bindDraft(this.pool.request(), draft).query<{ id: number }>(`
        INSERT INTO dbo.promotions
            (name, target_type, product_id, category, discount_type, discount_value, start_date, end_date, status)
        OUTPUT INSERTED.id
        VALUES
            (@name, @targetType, @productId, @category, @discountType, @discountValue, @startDate, @endDate, 'SCHEDULED');
    `);

    const id = result.recordset[0]?.id;
    if (id === undefined) {
      throw new Error('La inserción no devolvió el identificador de la promoción');
    }

    return this.requireById(id);
  }

  async replace(id: number, draft: PromotionDraft): Promise<Promotion> {
    await bindDraft(this.pool.request(), draft).input('id', sql.Int, id).query(`
        UPDATE dbo.promotions
        SET    name           = @name,
               target_type    = @targetType,
               product_id     = @productId,
               category       = @category,
               discount_type  = @discountType,
               discount_value = @discountValue,
               start_date     = @startDate,
               end_date       = @endDate,
               updated_at     = SYSUTCDATETIME()
        WHERE  id = @id;
    `);

    return this.requireById(id);
  }

  async updateStatus(id: number, status: PromotionStatus): Promise<Promotion> {
    await this.pool
      .request()
      .input('id', sql.Int, id)
      .input('status', sql.VarChar(12), status)
      .query(
        'UPDATE dbo.promotions SET status = @status, updated_at = SYSUTCDATETIME() WHERE id = @id;',
      );

    return this.requireById(id);
  }

  async remove(id: number): Promise<void> {
    await this.pool
      .request()
      .input('id', sql.Int, id)
      .query('DELETE FROM dbo.promotions WHERE id = @id;');
  }

  private async requireById(id: number): Promise<Promotion> {
    const promotion = await this.findById(id);
    if (promotion === null) {
      throw new Error(`La promoción ${id} desapareció durante la operación`);
    }
    return promotion;
  }
}

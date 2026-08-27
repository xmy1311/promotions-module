import { describe, expect, it } from 'vitest';
import { PromotionService } from '../../src/application/promotion.service';
import { createFixedClock } from '../../src/domain/clock';
import {
  DeleteNotAllowedError,
  NotFoundError,
  PromotionImmutableError,
  ValidationError,
} from '../../src/domain/errors';
import {
  InMemoryProductRepository,
  InMemoryPromotionRepository,
  makeDraft,
  makePromotion,
} from '../helpers/inMemoryRepositories';

const TODAY = '2026-06-15';

function createService(seed = [] as ReturnType<typeof makePromotion>[]) {
  const promotions = new InMemoryPromotionRepository(seed);
  const products = new InMemoryProductRepository();
  const service = new PromotionService(promotions, products, createFixedClock(TODAY));
  return { service, promotions };
}

describe('PromotionService.create', () => {
  it('crea la promoción en estado Programada', async () => {
    const { service } = createService();
    const created = await service.create(makeDraft());

    expect(created.status).toBe('SCHEDULED');
    expect(created.id).toBeGreaterThan(0);
  });

  it('rechaza un producto que no existe con 422 en lugar de fallar contra la clave foránea', async () => {
    const { service } = createService();
    const draft = makeDraft({ target: { type: 'PRODUCT', productId: 9999 } });

    await expect(service.create(draft)).rejects.toBeInstanceOf(ValidationError);
  });

  it('rechaza una categoría que no existe en el catálogo', async () => {
    const { service } = createService();
    const draft = makeDraft({ target: { type: 'CATEGORY', category: 'Inexistente' } });

    await expect(service.create(draft)).rejects.toBeInstanceOf(ValidationError);
  });

  it('agrupa los errores de negocio en un solo ValidationError', async () => {
    const { service } = createService();
    const draft = makeDraft({ name: '', discountValue: 150 });

    await expect(service.create(draft)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      httpStatus: 422,
    });
  });
});

describe('PromotionService.replace', () => {
  it('permite modificar una promoción activa', async () => {
    const { service } = createService([makePromotion({ id: 1, status: 'ACTIVE' })]);

    const updated = await service.replace(1, makeDraft({ name: 'Nombre actualizado' }));

    expect(updated.name).toBe('Nombre actualizado');
    expect(updated.status).toBe('ACTIVE');
  });

  it('impide modificar una promoción finalizada', async () => {
    const { service } = createService([makePromotion({ id: 1, status: 'FINISHED' })]);

    await expect(service.replace(1, makeDraft())).rejects.toBeInstanceOf(
      PromotionImmutableError,
    );
  });

  it('devuelve NotFound para una promoción inexistente', async () => {
    const { service } = createService();
    await expect(service.replace(42, makeDraft())).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('PromotionService.changeStatus', () => {
  it('aplica la transición válida y la persiste', async () => {
    const { service } = createService([
      makePromotion({ id: 1, status: 'SCHEDULED', endDate: '2026-12-31' }),
    ]);

    const updated = await service.changeStatus(1, 'ACTIVE');

    expect(updated.status).toBe('ACTIVE');
    expect((await service.getById(1)).status).toBe('ACTIVE');
  });

  it('usa el reloj inyectado para decidir si el rango ya venció', async () => {
    const { service } = createService([
      makePromotion({ id: 1, status: 'SCHEDULED', startDate: '2026-01-01', endDate: '2026-05-31' }),
    ]);

    await expect(service.changeStatus(1, 'ACTIVE')).rejects.toMatchObject({
      code: 'INVALID_STATE_TRANSITION',
    });
  });
});

describe('PromotionService.remove', () => {
  it('elimina una promoción programada', async () => {
    const { service } = createService([makePromotion({ id: 1, status: 'SCHEDULED' })]);

    await service.remove(1);

    await expect(service.getById(1)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('impide eliminar una promoción activa', async () => {
    const { service } = createService([makePromotion({ id: 1, status: 'ACTIVE' })]);

    await expect(service.remove(1)).rejects.toBeInstanceOf(DeleteNotAllowedError);
  });
});

describe('PromotionService.summary', () => {
  it('calcula el resumen con la fecha del reloj inyectado', async () => {
    const { service } = createService([
      makePromotion({ id: 1, status: 'ACTIVE', startDate: '2026-06-01', endDate: '2026-06-30' }),
      makePromotion({ id: 2, status: 'SCHEDULED' }),
      makePromotion({ id: 3, status: 'FINISHED' }),
    ]);

    await expect(service.summary()).resolves.toEqual({
      scheduled: 1,
      active: 1,
      finished: 1,
      activeToday: 1,
      today: TODAY,
    });
  });
});

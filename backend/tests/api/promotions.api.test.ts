import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { CatalogService } from '../../src/application/catalog.service';
import { HealthService } from '../../src/application/health.service';
import { PromotionService } from '../../src/application/promotion.service';
import { createLogger } from '../../src/config/logger';
import { createFixedClock } from '../../src/domain/clock';
import { createApp } from '../../src/http/app';
import {
  InMemoryProductRepository,
  InMemoryPromotionRepository,
  makePromotion,
} from '../helpers/inMemoryRepositories';

const TODAY = '2026-06-15';

const VALID_BODY = {
  name: 'Descuento de temporada',
  targetType: 'CATEGORY',
  category: 'Bebidas',
  discountType: 'PERCENTAGE',
  discountValue: 20,
  startDate: '2026-06-01',
  endDate: '2026-06-30',
};

function buildApp(seed = [] as ReturnType<typeof makePromotion>[]): express.Express {
  const promotions = new InMemoryPromotionRepository(seed);
  const products = new InMemoryProductRepository();

  return createApp({
    promotionService: new PromotionService(promotions, products, createFixedClock(TODAY)),
    catalogService: new CatalogService(products),
    healthService: new HealthService({ ping: async () => {} }, 1000),
    logger: createLogger('silent'),
    corsOrigins: [],
  });
}

describe('POST /api/promotions', () => {
  let app: express.Express;
  beforeEach(() => {
    app = buildApp();
  });

  it('crea la promoción y devuelve 201', async () => {
    const response = await request(app).post('/api/promotions').send(VALID_BODY);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ status: 'SCHEDULED', name: VALID_BODY.name });
  });

  it('devuelve 422 con el campo señalado cuando falta el nombre', async () => {
    const response = await request(app)
      .post('/api/promotions')
      .send({ ...VALID_BODY, name: '' });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'name' })]),
    );
  });

  it('devuelve 422 cuando el porcentaje está fuera del rango 1-100', async () => {
    const response = await request(app)
      .post('/api/promotions')
      .send({ ...VALID_BODY, discountValue: 150 });

    expect(response.status).toBe(422);
  });

  it('devuelve 422 cuando la fecha de fin no es posterior a la de inicio', async () => {
    const response = await request(app)
      .post('/api/promotions')
      .send({ ...VALID_BODY, startDate: '2026-06-30', endDate: '2026-06-30' });

    expect(response.status).toBe(422);
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'endDate' })]),
    );
  });

  it('devuelve 422 cuando no se indica producto ni categoría', async () => {
    const response = await request(app)
      .post('/api/promotions')
      .send({ ...VALID_BODY, category: undefined });

    expect(response.status).toBe(422);
  });
});

describe('GET /api/promotions', () => {
  it('devuelve la lista completa', async () => {
    const app = buildApp([makePromotion({ id: 1 }), makePromotion({ id: 2 })]);
    const response = await request(app).get('/api/promotions');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
  });

  it('filtra por estado', async () => {
    const app = buildApp([
      makePromotion({ id: 1, status: 'SCHEDULED' }),
      makePromotion({ id: 2, status: 'ACTIVE' }),
    ]);

    const response = await request(app).get('/api/promotions?status=ACTIVE');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].status).toBe('ACTIVE');
  });

  it('rechaza un estado desconocido con 422', async () => {
    const response = await request(buildApp()).get('/api/promotions?status=CANCELADA');
    expect(response.status).toBe(422);
  });

  it('devuelve 404 para una promoción inexistente', async () => {
    const response = await request(buildApp()).get('/api/promotions/999');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

describe('GET /api/promotions/summary', () => {
  it('no queda capturado por la ruta paramétrica /:id', async () => {
    const app = buildApp([
      makePromotion({ id: 1, status: 'ACTIVE', startDate: '2026-06-01', endDate: '2026-06-30' }),
    ]);

    const response = await request(app).get('/api/promotions/summary');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      scheduled: 0,
      active: 1,
      finished: 0,
      activeToday: 1,
      today: TODAY,
    });
  });
});

describe('POST /api/promotions/:id/transitions', () => {
  it('aplica una transición válida', async () => {
    const app = buildApp([makePromotion({ id: 1, status: 'SCHEDULED', endDate: '2026-12-31' })]);

    const response = await request(app)
      .post('/api/promotions/1/transitions')
      .send({ to: 'ACTIVE' });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ACTIVE');
  });

  it('devuelve 409 ante una transición inválida', async () => {
    const app = buildApp([makePromotion({ id: 1, status: 'SCHEDULED' })]);

    const response = await request(app)
      .post('/api/promotions/1/transitions')
      .send({ to: 'FINISHED' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('INVALID_STATE_TRANSITION');
  });

  it('devuelve 409 al intentar reactivar una promoción finalizada', async () => {
    const app = buildApp([makePromotion({ id: 1, status: 'FINISHED' })]);

    const response = await request(app)
      .post('/api/promotions/1/transitions')
      .send({ to: 'ACTIVE' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('PROMOTION_IS_IMMUTABLE');
  });
});

describe('PUT /api/promotions/:id', () => {
  it('devuelve 409 al modificar una promoción finalizada', async () => {
    const app = buildApp([makePromotion({ id: 1, status: 'FINISHED' })]);

    const response = await request(app).put('/api/promotions/1').send(VALID_BODY);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('PROMOTION_IS_IMMUTABLE');
  });
});

describe('DELETE /api/promotions/:id', () => {
  it('elimina una promoción programada y devuelve 204', async () => {
    const app = buildApp([makePromotion({ id: 1, status: 'SCHEDULED' })]);

    expect((await request(app).delete('/api/promotions/1')).status).toBe(204);
    expect((await request(app).get('/api/promotions/1')).status).toBe(404);
  });

  it.each(['ACTIVE', 'FINISHED'] as const)(
    'devuelve 409 al eliminar una promoción %s',
    async (status) => {
      const app = buildApp([makePromotion({ id: 1, status })]);

      const response = await request(app).delete('/api/promotions/1');

      expect(response.status).toBe(409);
    },
  );

  it('devuelve 404 al eliminar una promoción inexistente', async () => {
    expect((await request(buildApp()).delete('/api/promotions/999')).status).toBe(404);
  });
});

describe('cuerpo malformado', () => {
  it('devuelve 400 y no un 500 cuando el JSON es inválido', async () => {
    const response = await request(buildApp())
      .post('/api/promotions')
      .set('Content-Type', 'application/json')
      .send('{"name": ');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_JSON');
  });
});

describe('rutas desconocidas', () => {
  it('devuelven 404 con la forma de error estándar', async () => {
    const response = await request(buildApp()).get('/api/no-existe');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

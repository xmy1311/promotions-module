import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { CatalogService } from '../../src/application/catalog.service';
import { HealthService } from '../../src/application/health.service';
import { PromotionService } from '../../src/application/promotion.service';
import { createLogger } from '../../src/config/logger';
import { createFixedClock } from '../../src/domain/clock';
import { createApp } from '../../src/http/app';
import {
  InMemoryProductRepository,
  InMemoryPromotionRepository,
} from '../helpers/inMemoryRepositories';

function buildApp(ping: () => Promise<void>) {
  const promotions = new InMemoryPromotionRepository();
  const products = new InMemoryProductRepository();

  return createApp({
    promotionService: new PromotionService(promotions, products, createFixedClock('2026-06-15')),
    catalogService: new CatalogService(products),
    healthService: new HealthService({ ping }, 50),
    logger: createLogger('silent'),
    corsOrigins: [],
  });
}

describe('GET /health', () => {
  it('devuelve 200 cuando la base de datos responde', async () => {
    const response = await request(buildApp(async () => {})).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      checks: { database: { status: 'ok' } },
    });
  });

  it('devuelve 503 cuando la base de datos está caída', async () => {
    const response = await request(
      buildApp(async () => {
        throw new Error('ECONNREFUSED 10.0.0.5:1433 (usuario sa)');
      }),
    ).get('/health');

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      status: 'degraded',
      checks: { database: { status: 'down' } },
    });
  });

  it('no filtra el detalle del error de infraestructura al cliente', async () => {
    const response = await request(
      buildApp(async () => {
        throw new Error('ECONNREFUSED 10.0.0.5:1433 (usuario sa, password Secreta123!)');
      }),
    ).get('/health');

    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('ECONNREFUSED');
    expect(serialized).not.toContain('10.0.0.5');
    expect(serialized).not.toContain('Secreta123');
  });
});

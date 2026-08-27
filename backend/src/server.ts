import type sql from 'mssql';
import { CatalogService } from './application/catalog.service';
import { HealthService } from './application/health.service';
import { PromotionService } from './application/promotion.service';
import { loadEnv } from './config/env';
import { createLogger, type Logger } from './config/logger';
import { createSystemClock } from './domain/clock';
import { createApp } from './http/app';
import {
  createDatabaseProbe,
  createPool,
  ensureDatabaseExists,
} from './infrastructure/db/pool';
import { runMigrations } from './infrastructure/db/migrator';
import { SqlProductRepository } from './infrastructure/product.repository';
import { SqlPromotionRepository } from './infrastructure/promotion.repository';

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env.LOG_LEVEL);

  // El esquema se prepara antes de abrir el puerto: si algo falla aquí, el
  // proceso muere y /health nunca llega a responder 200 en falso.
  await ensureDatabaseExists(env, logger);
  const pool = await createPool(env, logger);
  await runMigrations(pool, logger);

  const promotionRepository = new SqlPromotionRepository(pool);
  const productRepository = new SqlProductRepository(pool);
  const clock = createSystemClock(env.APP_TIMEZONE);

  const app = createApp({
    promotionService: new PromotionService(promotionRepository, productRepository, clock),
    catalogService: new CatalogService(productRepository),
    healthService: new HealthService(
      createDatabaseProbe(pool),
      env.HEALTH_DB_TIMEOUT_MS,
      (error) => logger.error({ err: error }, 'La sonda de base de datos falló'),
    ),
    logger,
    corsOrigins: env.corsOrigins,
  });

  const server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, timezone: env.APP_TIMEZONE, env: env.NODE_ENV },
      'API de promociones escuchando',
    );
  });

  registerShutdownHandlers(server, pool, logger);
}

function registerShutdownHandlers(
  server: { close: (callback: () => void) => void },
  pool: sql.ConnectionPool,
  logger: Logger,
): void {
  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Cerrando la aplicación');
    server.close(() => {
      void pool.close().finally(() => process.exit(0));
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error: unknown) => {
  // No hay logger si la configuración falló: console.error es la única salida
  // disponible y el mensaje debe decir exactamente qué falta.
  console.error('No fue posible iniciar la aplicación:');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

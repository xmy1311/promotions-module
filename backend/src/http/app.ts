import cors from 'cors';
import express, { type Express } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import type { CatalogService } from '../application/catalog.service';
import type { HealthService } from '../application/health.service';
import type { PromotionService } from '../application/promotion.service';
import type { Logger } from '../config/logger';
import { createCatalogRouter } from './controllers/catalog.controller';
import { createHealthRouter } from './controllers/health.controller';
import { createPromotionRouter } from './controllers/promotion.controller';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { requestContext } from './middleware/requestContext';

export interface AppDependencies {
  promotionService: PromotionService;
  catalogService: CatalogService;
  healthService: HealthService;
  logger: Logger;
  corsOrigins: string[];
}

/** Recibe dependencias ya construidas: los tests la montan sin base de datos. */
export function createApp(deps: AppDependencies): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      // Lista blanca explícita: sin orígenes configurados no se habilita CORS.
      origin: deps.corsOrigins.length > 0 ? deps.corsOrigins : false,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(requestContext(deps.logger));

  // /health queda fuera del rate limit: es la sonda de los orquestadores.
  app.use('/health', createHealthRouter(deps.healthService));

  app.use(
    '/api',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 600,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    }),
  );
  app.use('/api', createCatalogRouter(deps.catalogService));
  app.use('/api/promotions', createPromotionRouter(deps.promotionService));

  app.use(notFound);
  app.use(errorHandler(deps.logger));

  return app;
}

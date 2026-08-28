import { Router } from 'express';
import type { HealthService } from '../../application/health.service';
import { asyncHandler } from '../middleware/asyncHandler';

/**Responde 200 solo cuando la aplicación *y* su base de datos están operativas */
export function createHealthRouter(service: HealthService): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      const report = await service.check();
      res.status(report.status === 'ok' ? 200 : 503).json(report);
    }),
  );

  return router;
}

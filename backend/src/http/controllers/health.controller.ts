import { Router } from 'express';
import type { HealthService } from '../../application/health.service';
import { asyncHandler } from '../middleware/asyncHandler';

/**
 * Responde 200 solo cuando la aplicación *y* su base de datos están operativas.
 * Con la base caída devuelve 503: un 200 en ese escenario haría que el smoke
 * test y cualquier orquestador dieran por sana una aplicación que no puede
 * atender una sola petición útil.
 */
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

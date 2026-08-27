import { Router } from 'express';
import type { CatalogService } from '../../application/catalog.service';
import { asyncHandler } from '../middleware/asyncHandler';

export function createCatalogRouter(service: CatalogService): Router {
  const router = Router();

  router.get(
    '/products',
    asyncHandler(async (_req, res) => {
      res.json(await service.listProducts());
    }),
  );

  router.get(
    '/categories',
    asyncHandler(async (_req, res) => {
      res.json(await service.listCategories());
    }),
  );

  return router;
}

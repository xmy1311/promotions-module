import { Router } from 'express';
import type { PromotionService } from '../../application/promotion.service';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  idParamSchema,
  listQuerySchema,
  promotionBodySchema,
  toPromotionDraft,
  transitionBodySchema,
} from '../schemas/promotion.schemas';

export function createPromotionRouter(service: PromotionService): Router {
  const router = Router();

    router.get(
    '/summary',
    asyncHandler(async (_req, res) => {
      res.json(await service.summary());
    }),
  );

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const query = listQuerySchema.parse(req.query);
      res.json(await service.list(query));
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      res.json(await service.getById(id));
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const body = promotionBodySchema.parse(req.body);
      const promotion = await service.create(toPromotionDraft(body));
      res.status(201).json(promotion);
    }),
  );

  router.put(
    '/:id',
    asyncHandler(async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      const body = promotionBodySchema.parse(req.body);
      res.json(await service.replace(id, toPromotionDraft(body)));
    }),
  );

  /** Sub-recurso y no un campo editable: tiene reglas y errores propios (409). */
  router.post(
    '/:id/transitions',
    asyncHandler(async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      const { to } = transitionBodySchema.parse(req.body);
      res.json(await service.changeStatus(id, to));
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      await service.remove(id);
      res.status(204).send();
    }),
  );

  return router;
}

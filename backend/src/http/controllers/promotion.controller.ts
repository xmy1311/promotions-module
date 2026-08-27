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

/**
 * El controlador solo traduce: valida la forma del mensaje, llama al servicio y
 * elige el código de éxito. No contiene ni una regla de negocio.
 */
export function createPromotionRouter(service: PromotionService): Router {
  const router = Router();

  // Debe declararse antes de '/:id'; de lo contrario 'summary' entraría por la
  // ruta paramétrica y devolvería un error confuso en lugar del resumen.
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

  /**
   * La transición es un sub-recurso y no un PUT sobre el campo `status`:
   * tiene reglas propias y una familia de errores distinta (409), y modelarla
   * como edición mezclaría dos operaciones con semánticas incompatibles.
   */
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

import { z } from 'zod';
import { isIsoDate } from '../../domain/dates';
import {
  CATEGORY_MAX_LENGTH,
  NAME_MAX_LENGTH,
} from '../../domain/promotion.rules';
import {
  DISCOUNT_TYPES,
  PROMOTION_STATUSES,
  TARGET_TYPES,
  type PromotionDraft,
} from '../../domain/promotion.types';

const isoDate = z
  .string()
  .refine(isIsoDate, 'Debe tener formato YYYY-MM-DD y corresponder a una fecha real');

/** Valida la estructura del cuerpo de la solicitud */
export const promotionBodySchema = z
  .object({
    name: z.string({ required_error: 'El nombre es obligatorio' }).max(NAME_MAX_LENGTH),
    targetType: z.enum(TARGET_TYPES, {
      required_error: 'Debe indicar si la promoción aplica a un producto o a una categoría',
    }),
    productId: z.number().int().positive().optional(),
    category: z.string().max(CATEGORY_MAX_LENGTH).optional(),
    discountType: z.enum(DISCOUNT_TYPES, {
      required_error: 'El tipo de descuento es obligatorio',
    }),
    discountValue: z.number({ required_error: 'El valor del descuento es obligatorio' }),
    startDate: isoDate,
    endDate: isoDate,
  })
  .superRefine((body, ctx) => {
    if (body.targetType === 'PRODUCT' && body.productId === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['productId'],
        message: 'Debe seleccionar un producto',
      });
    }
    if (body.targetType === 'CATEGORY' && body.category === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['category'],
        message: 'Debe seleccionar una categoría',
      });
    }
  });

export type PromotionBody = z.infer<typeof promotionBodySchema>;

export function toPromotionDraft(body: PromotionBody): PromotionDraft {
  return {
    name: body.name,
    target:
      body.targetType === 'PRODUCT'
        ? { type: 'PRODUCT', productId: body.productId as number }
        : { type: 'CATEGORY', category: body.category as string },
    discountType: body.discountType,
    discountValue: body.discountValue,
    startDate: body.startDate,
    endDate: body.endDate,
  };
}

export const transitionBodySchema = z.object({
  to: z.enum(PROMOTION_STATUSES, {
    required_error: 'Debe indicar el estado destino',
  }),
});

export const listQuerySchema = z.object({
  status: z.enum(PROMOTION_STATUSES).optional(),
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive('El identificador debe ser un entero positivo'),
});

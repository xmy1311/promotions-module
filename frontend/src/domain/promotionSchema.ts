import { z } from 'zod';
import { DISCOUNT_TYPES, TARGET_TYPES, type PromotionPayload } from './types';

const PERCENTAGE_MIN = 1;
const PERCENTAGE_MAX = 100;

/**
 * Validación de formulario. Duplica a propósito las reglas del backend: el
 * servidor sigue siendo la autoridad final, pero el usuario merece saber que
 * un porcentaje de 150 es inválido sin esperar un viaje de red.
 *
 * Todos los campos son cadenas porque provienen de inputs nativos; la
 * conversión a los tipos de la API ocurre en `toPromotionPayload`.
 */
export const promotionFormSchema = z
  .object({
    name: z.string().trim().min(1, 'El nombre es obligatorio').max(120, 'Máximo 120 caracteres'),
    targetType: z.enum(TARGET_TYPES),
    productId: z.string(),
    category: z.string(),
    discountType: z.enum(DISCOUNT_TYPES),
    discountValue: z.string().min(1, 'El valor del descuento es obligatorio'),
    startDate: z.string().min(1, 'La fecha de inicio es obligatoria'),
    endDate: z.string().min(1, 'La fecha de fin es obligatoria'),
  })
  .superRefine((values, ctx) => {
    if (values.targetType === 'PRODUCT' && values.productId === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['productId'],
        message: 'Debe seleccionar un producto',
      });
    }

    if (values.targetType === 'CATEGORY' && values.category === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['category'],
        message: 'Debe seleccionar una categoría',
      });
    }

    const discountValue = Number(values.discountValue);
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['discountValue'],
        message: 'El valor debe ser un número mayor que cero',
      });
    } else if (
      values.discountType === 'PERCENTAGE' &&
      (discountValue < PERCENTAGE_MIN || discountValue > PERCENTAGE_MAX)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['discountValue'],
        message: `El porcentaje debe estar entre ${PERCENTAGE_MIN} y ${PERCENTAGE_MAX}`,
      });
    }

    // Comparación lexicográfica de cadenas ISO: equivale a la cronológica y no
    // introduce ninguna conversión de zona horaria.
    if (values.startDate !== '' && values.endDate !== '' && values.endDate <= values.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'La fecha de fin debe ser posterior a la fecha de inicio',
      });
    }
  });

export type PromotionFormValues = z.infer<typeof promotionFormSchema>;

export const EMPTY_FORM_VALUES: PromotionFormValues = {
  name: '',
  targetType: 'PRODUCT',
  productId: '',
  category: '',
  discountType: 'PERCENTAGE',
  discountValue: '',
  startDate: '',
  endDate: '',
};

export function toPromotionPayload(values: PromotionFormValues): PromotionPayload {
  return {
    name: values.name.trim(),
    targetType: values.targetType,
    ...(values.targetType === 'PRODUCT'
      ? { productId: Number(values.productId) }
      : { category: values.category }),
    discountType: values.discountType,
    discountValue: Number(values.discountValue),
    startDate: values.startDate,
    endDate: values.endDate,
  };
}

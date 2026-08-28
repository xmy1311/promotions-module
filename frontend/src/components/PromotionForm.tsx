import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { FieldIssue } from '../api/client';
import { DISCOUNT_TYPE_LABELS } from '../domain/labels';
import {
  EMPTY_FORM_VALUES,
  promotionFormSchema,
  type PromotionFormValues,
} from '../domain/promotionSchema';
import type { Product, Promotion } from '../domain/types';

interface Props {
  products: Product[];
  categories: string[];
  editing: Promotion | null;
  isSubmitting: boolean;
  serverIssues: FieldIssue[];
  onSubmit: (values: PromotionFormValues) => void;
  onCancel: () => void;
}

const inputClass =
  'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

function toFormValues(promotion: Promotion): PromotionFormValues {
  return {
    name: promotion.name,
    targetType: promotion.target.type,
    productId: promotion.target.type === 'PRODUCT' ? String(promotion.target.productId) : '',
    category: promotion.target.type === 'CATEGORY' ? promotion.target.category : '',
    discountType: promotion.discountType,
    discountValue: String(promotion.discountValue),
    startDate: promotion.startDate,
    endDate: promotion.endDate,
  };
}

export function PromotionForm({
  products,
  categories,
  editing,
  isSubmitting,
  serverIssues,
  onSubmit,
  onCancel,
}: Props) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors },
  } = useForm<PromotionFormValues>({
    resolver: zodResolver(promotionFormSchema),
    defaultValues: editing === null ? EMPTY_FORM_VALUES : toFormValues(editing),
  });

  useEffect(() => {
    reset(editing === null ? EMPTY_FORM_VALUES : toFormValues(editing));
  }, [editing, reset]);

  //Los errores se muestran sobre el campo correspondiente.
  useEffect(() => {
    for (const issue of serverIssues) {
      if (issue.field in EMPTY_FORM_VALUES) {
        setError(issue.field as keyof PromotionFormValues, {
          type: 'server',
          message: issue.message,
        });
      }
    }
  }, [serverIssues, setError]);

  const targetType = watch('targetType');

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div>
        <label htmlFor="name" className="text-sm font-medium text-slate-700">
          Nombre
        </label>
        <input id="name" type="text" className={inputClass} {...register('name')} />
        <FieldError message={errors.name?.message} />
      </div>

      <div>
        <label htmlFor="targetType" className="text-sm font-medium text-slate-700">
          Aplica a
        </label>
        <select id="targetType" className={inputClass} {...register('targetType')}>
          <option value="PRODUCT">Producto</option>
          <option value="CATEGORY">Categoría</option>
        </select>
      </div>

      {targetType === 'PRODUCT' ? (
        <div>
          <label htmlFor="productId" className="text-sm font-medium text-slate-700">
            Producto
          </label>
          <select id="productId" className={inputClass} {...register('productId')}>
            <option value="">Seleccione un producto…</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} ({product.sku})
              </option>
            ))}
          </select>
          <FieldError message={errors.productId?.message} />
        </div>
      ) : (
        <div>
          <label htmlFor="category" className="text-sm font-medium text-slate-700">
            Categoría
          </label>
          <select id="category" className={inputClass} {...register('category')}>
            <option value="">Seleccione una categoría…</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <FieldError message={errors.category?.message} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="discountType" className="text-sm font-medium text-slate-700">
            Tipo de descuento
          </label>
          <select id="discountType" className={inputClass} {...register('discountType')}>
            {Object.entries(DISCOUNT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="discountValue" className="text-sm font-medium text-slate-700">
            Valor
          </label>
          <input
            id="discountValue"
            type="number"
            step="0.01"
            className={inputClass}
            {...register('discountValue')}
          />
          <FieldError message={errors.discountValue?.message} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="startDate" className="text-sm font-medium text-slate-700">
            Fecha de inicio
          </label>
          <input id="startDate" type="date" className={inputClass} {...register('startDate')} />
          <FieldError message={errors.startDate?.message} />
        </div>
        <div>
          <label htmlFor="endDate" className="text-sm font-medium text-slate-700">
            Fecha de fin
          </label>
          <input id="endDate" type="date" className={inputClass} {...register('endDate')} />
          <FieldError message={errors.endDate?.message} />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Guardando…' : editing === null ? 'Crear promoción' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}

function FieldError({ message }: { message?: string }) {
  if (message === undefined) {
    return null;
  }
  return (
    <p role="alert" className="mt-1 text-sm text-red-600">
      {message}
    </p>
  );
}

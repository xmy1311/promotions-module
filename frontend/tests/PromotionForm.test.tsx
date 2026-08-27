import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PromotionForm } from '../src/components/PromotionForm';
import { CATEGORIES, PRODUCTS, makePromotion } from './factories';

function renderForm(overrides: Partial<Parameters<typeof PromotionForm>[0]> = {}) {
  const onSubmit = vi.fn();

  render(
    <PromotionForm
      products={PRODUCTS}
      categories={CATEGORIES}
      editing={null}
      isSubmitting={false}
      serverIssues={[]}
      onSubmit={onSubmit}
      onCancel={vi.fn()}
      {...overrides}
    />,
  );

  return { onSubmit };
}

const submit = async (): Promise<void> => {
  await userEvent.click(screen.getByRole('button', { name: /crear promoción/i }));
};

describe('PromotionForm', () => {
  it('exige el nombre', async () => {
    const { onSubmit } = renderForm();
    await submit();

    expect(await screen.findByText('El nombre es obligatorio')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('exige seleccionar un producto cuando el objetivo es un producto', async () => {
    renderForm();
    await submit();

    expect(await screen.findByText('Debe seleccionar un producto')).toBeInTheDocument();
  });

  it('rechaza un porcentaje fuera del rango 1-100', async () => {
    renderForm();

    await userEvent.type(screen.getByLabelText('Nombre'), 'Promo inválida');
    await userEvent.selectOptions(screen.getByLabelText('Producto'), '1');
    await userEvent.type(screen.getByLabelText('Valor'), '150');
    await submit();

    expect(
      await screen.findByText('El porcentaje debe estar entre 1 y 100'),
    ).toBeInTheDocument();
  });

  it('permite un monto fijo mayor a 100 porque el límite es solo del porcentaje', async () => {
    const { onSubmit } = renderForm();

    await userEvent.type(screen.getByLabelText('Nombre'), 'Promo monto fijo');
    await userEvent.selectOptions(screen.getByLabelText('Producto'), '1');
    await userEvent.selectOptions(screen.getByLabelText('Tipo de descuento'), 'FIXED_AMOUNT');
    await userEvent.type(screen.getByLabelText('Valor'), '5000');
    await userEvent.type(screen.getByLabelText('Fecha de inicio'), '2026-06-01');
    await userEvent.type(screen.getByLabelText('Fecha de fin'), '2026-06-30');
    await submit();

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('rechaza una fecha de fin igual o anterior a la de inicio', async () => {
    renderForm();

    await userEvent.type(screen.getByLabelText('Nombre'), 'Promo con fechas inválidas');
    await userEvent.selectOptions(screen.getByLabelText('Producto'), '1');
    await userEvent.type(screen.getByLabelText('Valor'), '10');
    await userEvent.type(screen.getByLabelText('Fecha de inicio'), '2026-06-30');
    await userEvent.type(screen.getByLabelText('Fecha de fin'), '2026-06-30');
    await submit();

    expect(
      await screen.findByText('La fecha de fin debe ser posterior a la fecha de inicio'),
    ).toBeInTheDocument();
  });

  it('cambia el selector cuando el objetivo pasa a categoría', async () => {
    renderForm();

    await userEvent.selectOptions(screen.getByLabelText('Aplica a'), 'CATEGORY');

    expect(screen.getByLabelText('Categoría')).toBeInTheDocument();
    expect(screen.queryByLabelText('Producto')).not.toBeInTheDocument();
  });

  it('proyecta los errores de validación del backend sobre el campo correspondiente', async () => {
    renderForm({
      serverIssues: [{ field: 'discountValue', message: 'El porcentaje debe estar entre 1 y 100' }],
    });

    expect(
      await screen.findByText('El porcentaje debe estar entre 1 y 100'),
    ).toBeInTheDocument();
  });

  it('precarga los datos al editar una promoción existente', () => {
    renderForm({ editing: makePromotion({ name: 'Promo existente' }) });

    expect(screen.getByLabelText('Nombre')).toHaveValue('Promo existente');
    expect(screen.getByLabelText('Categoría')).toHaveValue('Bebidas');
  });
});

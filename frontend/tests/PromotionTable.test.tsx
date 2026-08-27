import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PromotionTable } from '../src/components/PromotionTable';
import { makePromotion } from './factories';

function renderTable(promotions = [makePromotion()]) {
  const handlers = {
    onEdit: vi.fn(),
    onTransition: vi.fn(),
    onDelete: vi.fn(),
  };

  render(<PromotionTable promotions={promotions} busyId={null} {...handlers} />);
  return handlers;
}

describe('PromotionTable', () => {
  it('muestra los datos principales de la promoción', () => {
    renderTable([makePromotion({ name: 'Viernes negro' })]);

    expect(screen.getByText('Viernes negro')).toBeInTheDocument();
    expect(screen.getByText('Categoría: Bebidas')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
    expect(screen.getByText('2026-06-01 → 2026-06-30')).toBeInTheDocument();
    expect(screen.getByText('Programada')).toBeInTheDocument();
  });

  it('muestra el nombre del producto cuando la promoción aplica a un producto', () => {
    renderTable([
      makePromotion({
        target: { type: 'PRODUCT', productId: 1 },
        productName: 'Gaseosa 1.5 L',
      }),
    ]);

    expect(screen.getByText('Gaseosa 1.5 L')).toBeInTheDocument();
  });

  it('formatea el monto fijo como moneda y no como porcentaje', () => {
    renderTable([makePromotion({ discountType: 'FIXED_AMOUNT', discountValue: 5000 })]);

    expect(screen.queryByText('5000%')).not.toBeInTheDocument();
    expect(screen.getByText(/5\.000/)).toBeInTheDocument();
  });

  describe('acciones según el estado', () => {
    it('en Programada ofrece activar, editar y eliminar', () => {
      renderTable([makePromotion({ status: 'SCHEDULED' })]);
      const row = screen.getAllByRole('row')[1] as HTMLElement;

      expect(within(row).getByRole('button', { name: 'Activar' })).toBeInTheDocument();
      expect(within(row).getByRole('button', { name: 'Editar' })).toBeInTheDocument();
      expect(within(row).getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
    });

    it('en Activa ofrece finalizar y editar, pero no eliminar', () => {
      renderTable([makePromotion({ status: 'ACTIVE' })]);
      const row = screen.getAllByRole('row')[1] as HTMLElement;

      expect(within(row).getByRole('button', { name: 'Finalizar' })).toBeInTheDocument();
      expect(within(row).getByRole('button', { name: 'Editar' })).toBeInTheDocument();
      expect(within(row).queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument();
    });

    it('en Finalizada no ofrece ninguna acción', () => {
      renderTable([makePromotion({ status: 'FINISHED' })]);
      const row = screen.getAllByRole('row')[1] as HTMLElement;

      expect(within(row).queryAllByRole('button')).toHaveLength(0);
    });
  });

  it('invoca la transición con la promoción de la fila', async () => {
    const handlers = renderTable([makePromotion({ id: 7, status: 'SCHEDULED' })]);

    await userEvent.click(screen.getByRole('button', { name: 'Activar' }));

    expect(handlers.onTransition).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }));
  });

  it('deshabilita las acciones de la fila en curso', () => {
    render(
      <PromotionTable
        promotions={[makePromotion({ id: 7 })]}
        busyId={7}
        onEdit={vi.fn()}
        onTransition={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Activar' })).toBeDisabled();
  });
});

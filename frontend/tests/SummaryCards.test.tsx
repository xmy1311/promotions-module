import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SummaryCards } from '../src/components/SummaryCards';

const SUMMARY = {
  scheduled: 3,
  active: 5,
  finished: 2,
  activeToday: 4,
  today: '2026-06-15',
};

describe('SummaryCards', () => {
  it('muestra los cuatro contadores del enunciado', () => {
    render(<SummaryCards summary={SUMMARY} isLoading={false} />);

    expect(screen.getByText('Programadas').nextElementSibling).toHaveTextContent('3');
    expect(screen.getByText('Activas').nextElementSibling).toHaveTextContent('5');
    expect(screen.getByText('Finalizadas').nextElementSibling).toHaveTextContent('2');
    expect(screen.getByText('Vigentes hoy').nextElementSibling).toHaveTextContent('4');
  });

  it('explicita el criterio de "vigentes hoy" para que no se confunda con "activas"', () => {
    render(<SummaryCards summary={SUMMARY} isLoading={false} />);

    expect(screen.getByText('Activas y dentro del rango de fechas')).toBeInTheDocument();
  });

  it('muestra la fecha de referencia usada por el backend', () => {
    render(<SummaryCards summary={SUMMARY} isLoading={false} />);

    expect(screen.getByText(/2026-06-15/)).toBeInTheDocument();
  });

  it('no muestra valores mientras carga', () => {
    render(<SummaryCards summary={undefined} isLoading />);

    expect(screen.getAllByText('—')).toHaveLength(4);
  });
});

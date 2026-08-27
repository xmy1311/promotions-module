import type { PromotionSummary } from '../domain/types';

interface Props {
  summary: PromotionSummary | undefined;
  isLoading: boolean;
}

interface Card {
  label: string;
  hint?: string;
  value: number;
  accent: string;
}

export function SummaryCards({ summary, isLoading }: Props) {
  const cards: Card[] = [
    { label: 'Programadas', value: summary?.scheduled ?? 0, accent: 'text-amber-600' },
    { label: 'Activas', value: summary?.active ?? 0, accent: 'text-emerald-600' },
    { label: 'Finalizadas', value: summary?.finished ?? 0, accent: 'text-slate-600' },
    {
      label: 'Vigentes hoy',
      // El criterio se rotula de forma explícita porque es una decisión de
      // interpretación del enunciado, no una obviedad.
      hint: 'Activas y dentro del rango de fechas',
      value: summary?.activeToday ?? 0,
      accent: 'text-indigo-600',
    },
  ];

  return (
    <section aria-label="Resumen de promociones" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <article
          key={card.label}
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <p className="text-sm font-medium text-slate-600">{card.label}</p>
          <p className={`mt-2 text-3xl font-semibold tabular-nums ${card.accent}`}>
            {isLoading ? '—' : card.value}
          </p>
          {card.hint !== undefined && (
            <p className="mt-1 text-xs text-slate-400">{card.hint}</p>
          )}
        </article>
      ))}
      {summary !== undefined && (
        <p className="col-span-full text-xs text-slate-400">
          Fecha de referencia del cálculo: {summary.today} (zona horaria de negocio)
        </p>
      )}
    </section>
  );
}

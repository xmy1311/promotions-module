import { formatDiscount, formatTarget, nextTransitionLabel } from '../domain/labels';
import type { Promotion } from '../domain/types';
import { StatusBadge } from './StatusBadge';

interface Props {
  promotions: Promotion[];
  busyId: number | null;
  onEdit: (promotion: Promotion) => void;
  onTransition: (promotion: Promotion) => void;
  onDelete: (promotion: Promotion) => void;
}

const actionClass =
  'rounded px-2 py-1 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40';

/**
 * Componente de presentación puro: recibe datos y callbacks. Esto lo hace
 * trivial de probar sin proveedores de consulta ni servidor simulado.
 *
 * Las acciones se muestran según el estado en lugar de renderizarse siempre
 * deshabilitadas: una promoción finalizada simplemente no ofrece acciones.
 */
export function PromotionTable({ promotions, busyId, onEdit, onTransition, onDelete }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <caption className="sr-only">Listado de promociones</caption>
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th scope="col" className="px-4 py-3">Nombre</th>
            <th scope="col" className="px-4 py-3">Aplica a</th>
            <th scope="col" className="px-4 py-3">Descuento</th>
            <th scope="col" className="px-4 py-3">Vigencia</th>
            <th scope="col" className="px-4 py-3">Estado</th>
            <th scope="col" className="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {promotions.map((promotion) => {
            const transitionLabel = nextTransitionLabel(promotion.status);
            const isBusy = busyId === promotion.id;

            return (
              <tr key={promotion.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{promotion.name}</td>
                <td className="px-4 py-3 text-slate-600">{formatTarget(promotion)}</td>
                <td className="px-4 py-3 tabular-nums text-slate-800">
                  {formatDiscount(promotion)}
                </td>
                <td className="px-4 py-3 tabular-nums text-slate-600">
                  {promotion.startDate} → {promotion.endDate}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={promotion.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    {transitionLabel !== null && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onTransition(promotion)}
                        className={`${actionClass} text-emerald-700 hover:bg-emerald-50`}
                      >
                        {transitionLabel}
                      </button>
                    )}
                    {promotion.status !== 'FINISHED' && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onEdit(promotion)}
                        className={`${actionClass} text-slate-700 hover:bg-slate-100`}
                      >
                        Editar
                      </button>
                    )}
                    {promotion.status === 'SCHEDULED' && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onDelete(promotion)}
                        className={`${actionClass} text-red-700 hover:bg-red-50`}
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

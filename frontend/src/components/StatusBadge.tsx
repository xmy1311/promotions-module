import { STATUS_LABELS, STATUS_STYLES } from '../domain/labels';
import type { PromotionStatus } from '../domain/types';

export function StatusBadge({ status }: { status: PromotionStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

interface StateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function Spinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-slate-500" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ title, description, action }: StateProps) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <p className="text-base font-medium text-slate-700">{title}</p>
      {description !== undefined && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      {action !== undefined && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ title, description, action }: StateProps) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-6 py-8 text-center"
    >
      <p className="text-base font-medium text-red-800">{title}</p>
      {description !== undefined && <p className="mt-1 text-sm text-red-700">{description}</p>}
      {action !== undefined && <div className="mt-4">{action}</div>}
    </div>
  );
}

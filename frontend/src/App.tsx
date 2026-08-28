import { useState } from 'react';
import { ApiError, type FieldIssue } from './api/client';
import { PromotionForm } from './components/PromotionForm';
import { PromotionTable } from './components/PromotionTable';
import { SidePanel } from './components/SidePanel';
import { SummaryCards } from './components/SummaryCards';
import { Toast, type ToastMessage } from './components/Toast';
import { EmptyState, ErrorState, Spinner } from './components/feedback';
import { STATUS_LABELS, nextStatus } from './domain/labels';
import { toPromotionPayload, type PromotionFormValues } from './domain/promotionSchema';
import {
  useCategories,
  useCreatePromotion,
  useDeletePromotion,
  useProducts,
  usePromotions,
  useSummary,
  useTransitionPromotion,
  useUpdatePromotion,
} from './hooks/usePromotions';
import { PROMOTION_STATUSES, type Promotion, type PromotionStatus } from './domain/types';

type StatusFilter = PromotionStatus | 'ALL';

export function App() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [serverIssues, setServerIssues] = useState<FieldIssue[]>([]);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const promotionsQuery = usePromotions(statusFilter === 'ALL' ? undefined : statusFilter);
  const summaryQuery = useSummary();
  const productsQuery = useProducts();
  const categoriesQuery = useCategories();

  const createMutation = useCreatePromotion();
  const updateMutation = useUpdatePromotion();
  const transitionMutation = useTransitionPromotion();
  const deleteMutation = useDeletePromotion();

  const notifyError = (error: unknown, fallback: string): void => {
    if (error instanceof ApiError) {
      setServerIssues(error.details);
      setToast({ kind: 'error', text: error.message });
      return;
    }
    setToast({ kind: 'error', text: fallback });
  };

  const openCreate = (): void => {
    setEditing(null);
    setServerIssues([]);
    setPanelOpen(true);
  };

  const openEdit = (promotion: Promotion): void => {
    setEditing(promotion);
    setServerIssues([]);
    setPanelOpen(true);
  };

  const handleSubmit = async (values: PromotionFormValues): Promise<void> => {
    const payload = toPromotionPayload(values);
    setServerIssues([]);

    try {
      if (editing === null) {
        await createMutation.mutateAsync(payload);
        setToast({ kind: 'success', text: 'Promoción creada' });
      } else {
        await updateMutation.mutateAsync({ id: editing.id, payload });
        setToast({ kind: 'success', text: 'Promoción actualizada' });
      }
      setPanelOpen(false);
    } catch (error) {
      notifyError(error, 'No fue posible guardar la promoción');
    }
  };

  const handleTransition = async (promotion: Promotion): Promise<void> => {
    const to = nextStatus(promotion.status);
    if (to === null) {
      return;
    }

    setBusyId(promotion.id);
    try {
      await transitionMutation.mutateAsync({ id: promotion.id, to });
      setToast({ kind: 'success', text: `Promoción marcada como ${STATUS_LABELS[to]}` });
    } catch (error) {
      notifyError(error, 'No fue posible cambiar el estado');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (promotion: Promotion): Promise<void> => {
    // Nativa: una dependencia menos para una acción destructiva puntual.
    if (!window.confirm(`¿Eliminar la promoción "${promotion.name}"?`)) {
      return;
    }

    setBusyId(promotion.id);
    try {
      await deleteMutation.mutateAsync(promotion.id);
      setToast({ kind: 'success', text: 'Promoción eliminada' });
    } catch (error) {
      notifyError(error, 'No fue posible eliminar la promoción');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Gestión de promociones</h1>
            <p className="text-sm text-slate-500">
              Control de vigencia y estado de los descuentos del punto de venta
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Nueva promoción
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <SummaryCards summary={summaryQuery.data} isLoading={summaryQuery.isLoading} />

        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-slate-600">Filtrar por estado:</span>
            {(['ALL', ...PROMOTION_STATUSES] as StatusFilter[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={`rounded-full px-3 py-1 text-sm transition ${
                  statusFilter === value
                    ? 'bg-slate-800 text-white'
                    : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
                }`}
              >
                {value === 'ALL' ? 'Todas' : STATUS_LABELS[value]}
              </button>
            ))}
          </div>

          {promotionsQuery.isLoading ? (
            <Spinner label="Cargando promociones…" />
          ) : promotionsQuery.isError ? (
            <ErrorState
              title="No fue posible cargar las promociones"
              description="Revisa que el backend y la base de datos estén disponibles."
              action={
                <button
                  type="button"
                  onClick={() => void promotionsQuery.refetch()}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                >
                  Reintentar
                </button>
              }
            />
          ) : promotionsQuery.data !== undefined && promotionsQuery.data.length === 0 ? (
            <EmptyState
              title="Todavía no hay promociones"
              description={
                statusFilter === 'ALL'
                  ? 'Crea la primera promoción para empezar a controlar su vigencia.'
                  : 'No hay promociones en este estado.'
              }
            />
          ) : (
            <PromotionTable
              promotions={promotionsQuery.data ?? []}
              busyId={busyId}
              onEdit={openEdit}
              onTransition={(promotion) => void handleTransition(promotion)}
              onDelete={(promotion) => void handleDelete(promotion)}
            />
          )}
        </section>
      </main>

      {panelOpen && (
        <SidePanel
          title={editing === null ? 'Nueva promoción' : 'Editar promoción'}
          onClose={() => setPanelOpen(false)}
        >
          <PromotionForm
            products={productsQuery.data ?? []}
            categories={categoriesQuery.data ?? []}
            editing={editing}
            isSubmitting={createMutation.isPending || updateMutation.isPending}
            serverIssues={serverIssues}
            onSubmit={(values) => void handleSubmit(values)}
            onCancel={() => setPanelOpen(false)}
          />
        </SidePanel>
      )}

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

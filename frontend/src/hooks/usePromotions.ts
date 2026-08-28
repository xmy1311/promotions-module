import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/promotions.api';
import type { PromotionPayload, PromotionStatus } from '../domain/types';

const PROMOTIONS_KEY = 'promotions';
const SUMMARY_KEY = 'summary';

export function usePromotions(status?: PromotionStatus) {
  return useQuery({
    queryKey: [PROMOTIONS_KEY, status ?? 'ALL'],
    queryFn: () => api.listPromotions(status),
  });
}

export function useSummary() {
  return useQuery({ queryKey: [SUMMARY_KEY], queryFn: api.getSummary });
}

export function useProducts() {
  return useQuery({ queryKey: ['products'], queryFn: api.listProducts });
}

export function useCategories() {
  return useQuery({ queryKey: ['categories'], queryFn: api.listCategories });
}

/** se  refresca la lista y los contadores */
function useInvalidateOnSuccess() {
  const queryClient = useQueryClient();

  return async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [PROMOTIONS_KEY] }),
      queryClient.invalidateQueries({ queryKey: [SUMMARY_KEY] }),
    ]);
  };
}

export function useCreatePromotion() {
  const onSuccess = useInvalidateOnSuccess();
  return useMutation({ mutationFn: api.createPromotion, onSuccess });
}

export function useUpdatePromotion() {
  const onSuccess = useInvalidateOnSuccess();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: PromotionPayload }) =>
      api.updatePromotion(id, payload),
    onSuccess,
  });
}

export function useTransitionPromotion() {
  const onSuccess = useInvalidateOnSuccess();
  return useMutation({
    mutationFn: ({ id, to }: { id: number; to: PromotionStatus }) =>
      api.transitionPromotion(id, to),
    onSuccess,
  });
}

export function useDeletePromotion() {
  const onSuccess = useInvalidateOnSuccess();
  return useMutation({ mutationFn: api.deletePromotion, onSuccess });
}

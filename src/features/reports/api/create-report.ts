import { QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';

import { productKeys } from '@/features/products/api/keys';
import type { ProductDetail } from '@/features/products/types/product';
import type { CreateReportInput } from '@/features/reports/types/report';
import { http } from '@/lib/http';
import { getApiErrorStatus } from '@/utils/api-error';

const ALREADY_REPORTED_STATUS = 409;

export async function createReport(productId: string, input: CreateReportInput) {
  await http.post(`/products/${encodeURIComponent(productId)}/reports`, input);
}

function markAsReported(queryClient: QueryClient, productId: string, viewerId: string | null) {
  queryClient.setQueryData<ProductDetail>(productKeys.detail(productId, viewerId), (current) =>
    current ? { ...current, viewer: { ...current.viewer, hasReported: true } } : current,
  );
}

/** Reports a listing and records `hasReported` in the cached detail. */
export function useCreateReport(productId: string, viewerId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateReportInput) => createReport(productId, input),
    onSuccess: () => markAsReported(queryClient, productId, viewerId),
    onError: (error) => {
      // A duplicate report means the server already has one from this viewer.
      if (getApiErrorStatus(error) === ALREADY_REPORTED_STATUS) {
        markAsReported(queryClient, productId, viewerId);
      }
    },
  });
}

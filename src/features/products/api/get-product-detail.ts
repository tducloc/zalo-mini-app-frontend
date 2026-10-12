import { queryOptions, useQuery } from '@tanstack/react-query';

import { productKeys } from '@/features/products/api/keys';
import type { ProductDetail } from '@/features/products/types/product';
import { http } from '@/lib/http';
import { LISTING_GC_TIME_MS, LISTING_STALE_TIME_MS } from '@/lib/query-client';

export async function getProductDetail(productId: string, signal?: AbortSignal) {
  const response = await http.get<{ data: ProductDetail }>(
    `/products/${encodeURIComponent(productId)}`,
    { signal },
  );
  return response.data.data;
}

export function productDetailQueryOptions(productId: string, viewerId: string | null) {
  return queryOptions({
    queryKey: productKeys.detail(productId, viewerId),
    queryFn: ({ signal }) => getProductDetail(productId, signal),
    enabled: Boolean(productId),
    staleTime: LISTING_STALE_TIME_MS,
    gcTime: LISTING_GC_TIME_MS,
    // Keep showing the anonymous copy of the SAME product while the signed-in
    // copy (with viewer fields) loads; never show another product's data.
    placeholderData: (previousData) => (previousData?.id === productId ? previousData : undefined),
  });
}

export function useProductDetail(productId: string, viewerId: string | null) {
  return useQuery(productDetailQueryOptions(productId, viewerId));
}

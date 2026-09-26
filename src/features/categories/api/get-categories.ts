import { queryOptions, useQuery } from '@tanstack/react-query';

import { categoryKeys } from '@/features/categories/api/keys';
import type { CategoryResponse } from '@/features/categories/types/category';
import { presentCategories } from '@/features/categories/utils/presentation';
import { apiClient } from '@/lib/api-client';

// The category list is fixed per backend release.
const CATEGORIES_STALE_TIME_MS = 60 * 60_000;

export async function getCategories(signal?: AbortSignal) {
  const response = await apiClient.get<{ data: CategoryResponse[] }>('/categories', { signal });
  return response.data.data;
}

export function categoriesQueryOptions() {
  return queryOptions({
    queryKey: categoryKeys.all,
    queryFn: ({ signal }) => getCategories(signal),
    staleTime: CATEGORIES_STALE_TIME_MS,
    retry: 1,
  });
}

/** Categories with Vietnamese labels and icons, in display order. */
export function useCategories() {
  return useQuery({ ...categoriesQueryOptions(), select: presentCategories });
}

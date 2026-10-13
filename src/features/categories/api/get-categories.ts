import { useQuery } from '@tanstack/react-query';

import type { CategoryResponse } from '@/features/categories/types/category';
import { presentCategories } from '@/features/categories/utils/presentation';
import { apiClient } from '@/lib/api-client';
import { readNativeCache, writeNativeCache } from '@/lib/native-cache';

const CACHE_KEY = 'categories';
const CACHE_VERSION = 1;
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export async function getCategories(signal?: AbortSignal) {
  const response = await apiClient.get<{ data: CategoryResponse[] }>('/categories', { signal });
  return response.data.data;
}

/**
 * Categories with Vietnamese labels and icons, in display order. The copy saved on the
 * device shows at once while the request still runs once per session.
 */
export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async ({ signal }) => {
      const categories = await getCategories(signal);
      writeNativeCache(CACHE_KEY, categories, CACHE_VERSION);
      return categories;
    },
    placeholderData: () =>
      readNativeCache<CategoryResponse[]>(CACHE_KEY, {
        version: CACHE_VERSION,
        maxAgeMs: CACHE_MAX_AGE_MS,
      })?.data,
    staleTime: Infinity,
    gcTime: Infinity,
    select: presentCategories,
  });
}

import { useQuery } from '@tanstack/react-query';

import type { LocationResponse } from '@/features/locations/types/location';
import { apiClient } from '@/lib/api-client';
import { readNativeCache, writeNativeCache } from '@/lib/native-cache';

const CACHE_KEY = 'locations';
// Bump when `LocationResponse` changes shape, so old saved copies are dropped.
const CACHE_VERSION = 1;
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export async function getLocations(signal?: AbortSignal) {
  const response = await apiClient.get<{ data: LocationResponse[] }>('/locations', { signal });
  return response.data.data;
}

// Module-level so React Query keeps its result across renders instead of reading again.
function readSavedLocations() {
  const saved = readNativeCache<unknown>(CACHE_KEY, {
    version: CACHE_VERSION,
    maxAgeMs: CACHE_MAX_AGE_MS,
  })?.data;
  return Array.isArray(saved) ? (saved as LocationResponse[]) : undefined;
}

export function useLocations({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery<LocationResponse[]>({
    queryKey: ['locations'],
    queryFn: async ({ signal }) => {
      const locations = await getLocations(signal);
      writeNativeCache(CACHE_KEY, locations, CACHE_VERSION);
      return locations;
    },
    placeholderData: readSavedLocations,
    staleTime: Infinity,
    gcTime: Infinity,
    enabled,
  });
}

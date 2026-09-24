import { queryOptions, useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';

import { locationKeys } from './keys';
import type { LocationResponse } from '../types';

// The versioned province list changes only with a backend release.
const LOCATIONS_STALE_TIME_MS = 60 * 60_000;

export async function getLocations(signal?: AbortSignal) {
  const response = await apiClient.get<{ data: LocationResponse[] }>('/locations', { signal });
  return response.data.data;
}

export function locationsQueryOptions() {
  return queryOptions({
    queryKey: locationKeys.all,
    queryFn: ({ signal }) => getLocations(signal),
    staleTime: LOCATIONS_STALE_TIME_MS,
    retry: 1,
  });
}

export function useLocations({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({ ...locationsQueryOptions(), enabled });
}

import { useQuery } from '@tanstack/react-query';

import type { LocationResponse } from '@/features/locations/types/location';
import { apiClient } from '@/lib/api-client';

export async function getLocations(signal?: AbortSignal) {
  const response = await apiClient.get<{ data: LocationResponse[] }>('/locations', { signal });
  return response.data.data;
}

export function useLocations({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['locations'],
    queryFn: ({ signal }) => getLocations(signal),
    staleTime: Infinity,
    gcTime: Infinity,
    enabled,
  });
}

import { apiClient } from '@/lib/api-client';

export interface CategoryResponse {
  id: string;
  name: string;
  slug: string;
}

export async function getCategories(signal?: AbortSignal) {
  const response = await apiClient.get<{ data: CategoryResponse[] }>('/categories', { signal });
  return response.data.data;
}

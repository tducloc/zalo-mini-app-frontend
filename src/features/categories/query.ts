import { useQuery } from '@tanstack/react-query';
import { getCategories } from './api/categories';

export function useCategories(enabled = true) {
  return useQuery({
    queryKey: ['categories'],
    queryFn: ({ signal }) => getCategories(signal),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    enabled,
  });
}

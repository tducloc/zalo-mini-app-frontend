import { useQuery } from '@tanstack/react-query';
import { getCategories } from './CategoriesApi';

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: ({ signal }) => getCategories(signal),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

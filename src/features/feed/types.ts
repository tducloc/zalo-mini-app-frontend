import type { ProductCondition } from '@/features/products/types';

import type { FILTER_KEYS, SORT_OPTIONS } from './constants';

export type SortOption = (typeof SORT_OPTIONS)[number];

export type FilterKey = (typeof FILTER_KEYS)[number];

export interface FeedFilters {
  categoryId?: string;
  locationId?: string;
  condition?: ProductCondition;
  minPrice?: number;
  maxPrice?: number;
  sort: SortOption;
}

export interface FilterChip {
  key: FilterKey;
  label: string;
}

import type { FILTER_KEYS, SORT_OPTIONS } from '@/features/feed/constants/filters';
import type { ProductCondition } from '@/features/products/types/product';

export type SortOption = (typeof SORT_OPTIONS)[number];

export type FilterKey = (typeof FILTER_KEYS)[number];

export interface FeedFilters {
  categoryId?: string;
  locationId?: string;
  condition?: ProductCondition;
  /** Only listings with a video; undefined means all listings. */
  hasVideo?: true;
  minPrice?: number;
  maxPrice?: number;
  sort: SortOption;
}

export interface FilterChip {
  key: FilterKey;
  label: string;
}

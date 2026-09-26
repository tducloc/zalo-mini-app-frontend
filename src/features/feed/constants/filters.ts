import type { FeedFilters, SortOption } from '@/features/feed/types/filters';
import type { ProductFeedParams } from '@/features/products/types/product';

export const SEARCH_MAX_LENGTH = 100;

/** Sort choices, in display order. */
export const SORT_OPTIONS = ['newest', 'oldest', 'price-asc', 'price-desc'] as const;

export const DEFAULT_SORT = 'newest' satisfies SortOption;

export const sortOptionConfig: Record<
  SortOption,
  { label: string; sortBy: ProductFeedParams['sortBy']; order: ProductFeedParams['order'] }
> = {
  newest: { label: 'Mới nhất', sortBy: 'publishedAt', order: 'desc' },
  oldest: { label: 'Cũ nhất', sortBy: 'publishedAt', order: 'asc' },
  'price-asc': { label: 'Giá thấp đến cao', sortBy: 'price', order: 'asc' },
  'price-desc': { label: 'Giá cao đến thấp', sortBy: 'price', order: 'desc' },
};

/** Applied-filter kinds, in chip order. */
export const FILTER_KEYS = [
  'locationId',
  'categoryId',
  'condition',
  'hasVideo',
  'price',
  'sort',
] as const;

export const HAS_VIDEO_LABEL = 'Có video';

export const DEFAULT_FILTERS: FeedFilters = { sort: DEFAULT_SORT };

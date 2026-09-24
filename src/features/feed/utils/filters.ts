import type { CategoryOption } from '@/features/categories/types';
import type { LocationResponse } from '@/features/locations/types';
import { conditionLabels } from '@/features/products/constants';
import type { ProductFeedParams } from '@/features/products/types';
import { formatVnd } from '@/utils/format';

import { DEFAULT_SORT, FILTER_KEYS, SEARCH_MAX_LENGTH, sortOptionConfig } from '../constants';
import type { FeedFilters, FilterChip, FilterKey } from '../types';

export const DEFAULT_FILTERS: FeedFilters = { sort: DEFAULT_SORT };

/** Trimmed search term, or undefined when there is nothing to search for. */
export function normalizeSearch(input: string) {
  // Collapsed spaces keep "sofa  góc" and "sofa góc" one query (and cache key).
  const term = input.replace(/\s+/g, ' ').trim().slice(0, SEARCH_MAX_LENGTH).trim();
  return term || undefined;
}

/**
 * Builds the request params. Only defined keys are included so the object is a
 * stable React Query key: equal filters always produce an equal key.
 */
export function toFeedQueryParams(filters: FeedFilters, search: string): ProductFeedParams {
  const { sortBy, order } = sortOptionConfig[filters.sort];
  const q = normalizeSearch(search);
  const { categoryId, locationId, condition, minPrice, maxPrice } = filters;

  return {
    ...(q && { q }),
    ...(categoryId && { categoryId }),
    ...(locationId && { locationId }),
    ...(condition && { condition }),
    ...(minPrice !== undefined && { minPrice }),
    ...(maxPrice !== undefined && { maxPrice }),
    sortBy,
    order,
  };
}

/**
 * Single-choice toggle: picking a new option selects it; picking the current
 * one clears it, unless a value is required (e.g. sort).
 */
export function nextChoice<T>(current: T | undefined, picked: T, isRequired = false) {
  if (picked !== current) {
    return picked;
  }

  return isRequired ? current : undefined;
}

export function toggleCategory(filters: FeedFilters, categoryId: string): FeedFilters {
  return { ...filters, categoryId: nextChoice(filters.categoryId, categoryId) };
}

export function removeFilter(filters: FeedFilters, key: FilterKey): FeedFilters {
  if (key === 'price') {
    return { ...filters, minPrice: undefined, maxPrice: undefined };
  }

  if (key === 'sort') {
    return { ...filters, sort: DEFAULT_SORT };
  }

  return { ...filters, [key]: undefined };
}

/** Applied (non-default) filters, in chip order. Single source for chips and the badge. */
export function getActiveFilterKeys(filters: FeedFilters): FilterKey[] {
  const isActive: Record<FilterKey, boolean> = {
    locationId: Boolean(filters.locationId),
    categoryId: Boolean(filters.categoryId),
    condition: Boolean(filters.condition),
    price: filters.minPrice !== undefined || filters.maxPrice !== undefined,
    sort: filters.sort !== DEFAULT_SORT,
  };

  return FILTER_KEYS.filter((key) => isActive[key]);
}

function formatPriceRange(minPrice?: number, maxPrice?: number) {
  if (minPrice !== undefined && maxPrice !== undefined) {
    return `${formatVnd(minPrice)} – ${formatVnd(maxPrice)}`;
  }

  if (minPrice !== undefined) {
    return `Từ ${formatVnd(minPrice)}`;
  }

  return `Đến ${formatVnd(maxPrice ?? 0)}`;
}

export function getFilterChips(
  filters: FeedFilters,
  lookups: { categories: CategoryOption[]; locations: LocationResponse[] },
): FilterChip[] {
  const labels: Record<FilterKey, () => string> = {
    locationId: () =>
      lookups.locations.find((item) => item.id === filters.locationId)?.name ?? 'Khu vực đã chọn',
    categoryId: () =>
      lookups.categories.find((item) => item.id === filters.categoryId)?.label ??
      'Danh mục đã chọn',
    condition: () => (filters.condition ? conditionLabels[filters.condition] : ''),
    price: () => formatPriceRange(filters.minPrice, filters.maxPrice),
    sort: () => sortOptionConfig[filters.sort].label,
  };

  return getActiveFilterKeys(filters).map((key) => ({ key, label: labels[key]() }));
}

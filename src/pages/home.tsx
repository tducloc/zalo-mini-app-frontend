import { useEffect, useRef, useState } from 'react';
import { Page, useNavigate } from 'zmp-ui';
import { useShallow } from 'zustand/react/shallow';

import { pageClass } from '@/components/layout/styles';
import { useCategories } from '@/features/categories/api/get-categories';
import CategoryStrip from '@/features/categories/components/category-strip';
import FilterChips from '@/features/feed/components/filters/filter-chips';
import FilterSheet from '@/features/feed/components/filters/filter-sheet';
import HomeHeader from '@/features/feed/components/home-header';
import ProductFeed from '@/features/feed/components/grid/product-feed';
import type { FeedFilters, FilterChip, FilterKey } from '@/features/feed/types/filters';
import { useLocations } from '@/features/locations/api/get-locations';
import { useProductFeed } from '@/features/products/api/get-product-feed';
import { useHomeFeedStore } from '@/stores/home-feed';
import type { CategoryOption } from '@/features/categories/types/category';
import {
  DEFAULT_SORT,
  FILTER_KEYS,
  HAS_VIDEO_LABEL,
  SEARCH_MAX_LENGTH,
  sortOptionConfig,
} from '@/features/feed/constants/filters';
import { nextChoice } from '@/features/feed/utils/filters';
import type { LocationResponse } from '@/features/locations/types/location';
import { conditionLabels } from '@/features/products/constants/product';
import type { ProductFeedParams } from '@/features/products/types/product';
import { formatVnd } from '@/utils/format';

const SEARCH_DEBOUNCE_MS = 300;

// Safe-area-aware fixed header (HomeHeader reads these); the content starts below it.
const homePageVarsClass =
  '[--home-safe-top:max(24px,var(--zaui-safe-area-inset-top,env(safe-area-inset-top,0px)))] [--home-header-height:calc(var(--home-safe-top)_+_108px)]';
const homeContentClass = 'px-4 pb-4 pt-[calc(var(--home-header-height)_+_20px)]';
const sectionHeadingClass = 'mb-3 text-lg font-bold leading-6';

export default function HomePage() {
  const navigate = useNavigate();

  // search and filters (store survives navigation to detail)
  // Shallow, so a commitSearch that changes nothing (as on mount) does not re-render.
  const {
    searchInput,
    searchTerm,
    filters,
    setSearchInput,
    commitSearch,
    clearSearch,
    setFilters,
    resetFilters,
  } = useHomeFeedStore(useShallow((state) => state));

  // local UI state
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  // queries
  const feedParams = toFeedQueryParams(filters, searchTerm);
  const feedKey = JSON.stringify(feedParams);
  const previousFeedKeyRef = useRef(feedKey);
  const feed = useProductFeed(feedParams);
  const categoriesQuery = useCategories();
  // Needed only for the sheet and the location chip label.
  const locationsQuery = useLocations({ enabled: isFilterOpen || Boolean(filters.locationId) });

  useEffect(() => {
    const timer = setTimeout(commitSearch, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, commitSearch]);

  // New search/filters start at page one, so the list starts at the top too.
  // Not on remount: returning from detail restores the previous position.
  useEffect(() => {
    if (previousFeedKeyRef.current === feedKey) {
      return;
    }

    previousFeedKeyRef.current = feedKey;
    pageRef.current?.scrollTo({ top: 0 });
  }, [feedKey]);

  const chips = getFilterChips(filters, {
    categories: categoriesQuery.data ?? [],
    locations: locationsQuery.data ?? [],
  });
  const hasActiveCriteria = chips.length > 0 || Boolean(normalizeSearch(searchTerm));

  const handleApplyFilters = (nextFilters: FeedFilters) => {
    setFilters(nextFilters);
    setIsFilterOpen(false);
  };

  const handleResetFilters = () => {
    resetFilters();
    setIsFilterOpen(false);
  };

  const handleClearCriteria = () => {
    clearSearch();
    resetFilters();
  };

  const handleRemoveChip = (key: FilterKey) => setFilters(removeFilter(filters, key));

  const handleSelectCategory = (categoryId: string) =>
    setFilters(toggleCategory(filters, categoryId));

  return (
    <Page ref={pageRef} className={`${pageClass} ${homePageVarsClass}`} restoreScroll>
      <HomeHeader
        headerRef={headerRef}
        activeFilterCount={chips.length}
        searchValue={searchInput}
        onOpenFilters={() => setIsFilterOpen(true)}
        onSearchChange={setSearchInput}
        onSearchClear={clearSearch}
        onSearchSubmit={commitSearch}
      />

      <main className={homeContentClass}>
        <h2 className={`${sectionHeadingClass} mt-0`}>Danh mục</h2>
        <CategoryStrip
          query={categoriesQuery}
          selectedId={filters.categoryId}
          onSelect={handleSelectCategory}
        />

        <h2 className={`${sectionHeadingClass} mt-[17px]`}>
          {hasActiveCriteria ? 'Kết quả' : 'Tin đăng mới'}
        </h2>
        <FilterChips chips={chips} onClearAll={resetFilters} onRemove={handleRemoveChip} />
        <ProductFeed
          feed={feed}
          hasActiveCriteria={hasActiveCriteria}
          isAutoplayPaused={isFilterOpen}
          scrollerRef={pageRef}
          headerRef={headerRef}
          onClearCriteria={handleClearCriteria}
          onOpenProduct={(productId) => navigate(`/products/${productId}`)}
        />
      </main>

      <FilterSheet
        categories={categoriesQuery}
        filters={filters}
        locations={locationsQuery}
        visible={isFilterOpen}
        onApply={handleApplyFilters}
        onClose={() => setIsFilterOpen(false)}
        onReset={handleResetFilters}
      />
    </Page>
  );
}

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
  const { categoryId, locationId, condition, hasVideo, minPrice, maxPrice } = filters;

  return {
    ...(q && { q }),
    ...(categoryId && { categoryId }),
    ...(locationId && { locationId }),
    ...(condition && { condition }),
    ...(hasVideo && { hasVideo }),
    ...(minPrice !== undefined && { minPrice }),
    ...(maxPrice !== undefined && { maxPrice }),
    sortBy,
    order,
  };
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
    hasVideo: Boolean(filters.hasVideo),
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
    hasVideo: () => HAS_VIDEO_LABEL,
    price: () => formatPriceRange(filters.minPrice, filters.maxPrice),
    sort: () => sortOptionConfig[filters.sort].label,
  };

  return getActiveFilterKeys(filters).map((key) => ({ key, label: labels[key]() }));
}

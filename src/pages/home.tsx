import { useEffect, useRef, useState } from 'react';
import { Page, useNavigate } from 'zmp-ui';
import { useShallow } from 'zustand/react/shallow';

import CategoryStrip from '@/features/categories/components/category-strip';
import { useCategories } from '@/features/categories/api/get-categories';
import FilterChips from '@/features/feed/components/filter-chips';
import FilterSheet from '@/features/feed/components/filter-sheet';
import HomeHeader from '@/features/feed/components/home-header';
import ProductFeed from '@/features/feed/components/product-feed';
import { useHomeFeedStore } from '@/features/feed/store';
import { homeContentClass, homePageVarsClass, sectionHeadingClass } from '@/features/feed/styles';
import type { FeedFilters, FilterKey } from '@/features/feed/types';
import {
  getFilterChips,
  normalizeSearch,
  removeFilter,
  toFeedQueryParams,
  toggleCategory,
} from '@/features/feed/utils/filters';
import { useLocations } from '@/features/locations/api/get-locations';
import { useProductFeed } from '@/features/products/api/get-product-feed';

const SEARCH_DEBOUNCE_MS = 300;

export default function HomePage({ initialFilterOpen = false }: { initialFilterOpen?: boolean }) {
  const navigate = useNavigate();

  // search and filters (store survives navigation to detail)
  const { searchInput, searchTerm, filters } = useHomeFeedStore(
    useShallow(({ searchInput, searchTerm, filters }) => ({ searchInput, searchTerm, filters })),
  );
  const { setSearchInput, commitSearch, clearSearch, setFilters, resetFilters } = useHomeFeedStore(
    useShallow(({ setSearchInput, commitSearch, clearSearch, setFilters, resetFilters }) => ({
      setSearchInput,
      commitSearch,
      clearSearch,
      setFilters,
      resetFilters,
    })),
  );

  // local UI state
  const [isFilterOpen, setIsFilterOpen] = useState(initialFilterOpen);
  const pageRef = useRef<HTMLDivElement>(null);

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
    <Page ref={pageRef} className={`marketplace-page ${homePageVarsClass}`} restoreScroll>
      <HomeHeader
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
          categories={categoriesQuery.data}
          isError={categoriesQuery.isError}
          isPending={categoriesQuery.isPending}
          selectedId={filters.categoryId}
          onRetry={() => categoriesQuery.refetch()}
          onSelect={handleSelectCategory}
        />

        <h2 className={`${sectionHeadingClass} mt-[17px]`}>
          {hasActiveCriteria ? 'Kết quả' : 'Tin đăng mới'}
        </h2>
        <FilterChips chips={chips} onClearAll={resetFilters} onRemove={handleRemoveChip} />
        <ProductFeed
          feed={feed}
          hasActiveCriteria={hasActiveCriteria}
          onClearCriteria={handleClearCriteria}
          onOpenProduct={(productId) => navigate(`/products/${productId}`)}
        />
      </main>

      <FilterSheet
        categories={{
          data: categoriesQuery.data,
          isError: categoriesQuery.isError,
          onRetry: () => categoriesQuery.refetch(),
        }}
        filters={filters}
        locations={{
          data: locationsQuery.data,
          isError: locationsQuery.isError,
          onRetry: () => locationsQuery.refetch(),
        }}
        visible={isFilterOpen}
        onApply={handleApplyFilters}
        onClose={() => setIsFilterOpen(false)}
        onReset={handleResetFilters}
      />
    </Page>
  );
}

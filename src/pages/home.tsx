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
import type { FeedFilters, FilterKey } from '@/features/feed/types/filters';
import {
  getFilterChips,
  normalizeSearch,
  removeFilter,
  toFeedQueryParams,
  toggleCategory,
} from '@/features/feed/utils/filters';
import { useLocations } from '@/features/locations/api/get-locations';
import { useProductFeed } from '@/features/products/api/get-product-feed';
import { useHomeFeedStore } from '@/stores/home-feed';

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

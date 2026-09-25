import { create } from 'zustand';

import type { FeedFilters } from '@/features/feed/types';
import { DEFAULT_FILTERS } from '@/features/feed/utils/filters';

// Home unmounts when a route is pushed, so the search and filters live here to
// survive a round trip to product detail.
interface HomeFeedState {
  /** What is typed in the search box. */
  searchInput: string;
  /** The term the feed is queried with (debounced or submitted). */
  searchTerm: string;
  filters: FeedFilters;
  setSearchInput: (searchInput: string) => void;
  commitSearch: () => void;
  clearSearch: () => void;
  setFilters: (filters: FeedFilters) => void;
  resetFilters: () => void;
}

export const useHomeFeedStore = create<HomeFeedState>((set) => ({
  searchInput: '',
  searchTerm: '',
  filters: DEFAULT_FILTERS,
  setSearchInput: (searchInput) => set({ searchInput }),
  commitSearch: () => set((state) => ({ searchTerm: state.searchInput })),
  clearSearch: () => set({ searchInput: '', searchTerm: '' }),
  setFilters: (filters) => set({ filters }),
  resetFilters: () => set({ filters: DEFAULT_FILTERS }),
}));

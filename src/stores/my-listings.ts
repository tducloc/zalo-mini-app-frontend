import { create } from 'zustand';

import { DEFAULT_TAB } from '@/features/my-listings/constants/tabs';
import type { MyListingsTab } from '@/features/my-listings/types/my-listing';
import { getTabForStatus } from '@/features/my-listings/utils/my-listing';
import type { ProductStatus } from '@/features/products/types/product';

// My listings unmounts when a route is pushed (a listing, its edit page), so the open tab
// lives here to survive the round trip.
interface MyListingsState {
  tab: MyListingsTab;
  /**
   * The listing the seller just posted or saved. The media worker can move it on before
   * the tab's list loads, so the page keeps to it (`useFollowListing`).
   */
  followedId: string | null;
  /** Opens a tab, and stops following. */
  selectTab: (tab: MyListingsTab) => void;
  /** Opens the tab of a listing just posted or saved, and follows it. */
  follow: (listingId: string, status: ProductStatus) => void;
}

export const useMyListingsStore = create<MyListingsState>((set) => ({
  tab: DEFAULT_TAB,
  followedId: null,
  selectTab: (tab) => set({ tab, followedId: null }),
  follow: (listingId, status) => set({ tab: getTabForStatus(status), followedId: listingId }),
}));

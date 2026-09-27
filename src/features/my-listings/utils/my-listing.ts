import { tabConfigs } from '@/features/my-listings/constants/tabs';
import {
  ListingAction,
  type ListingCounts,
  type MyListingsTab,
} from '@/features/my-listings/types/my-listing';
import type { ProductStatus } from '@/features/products/types/product';

/** How many listings a tab holds, once the counts are known. */
export function getTabTotal(tab: MyListingsTab, counts: ListingCounts | undefined) {
  return counts?.[tabConfigs[tab].status] ?? 0;
}

const actionsByStatus: Record<ProductStatus, ListingAction[]> = {
  PUBLISHED: [ListingAction.Edit, ListingAction.MarkSold, ListingAction.Archive],
  PROCESSING: [ListingAction.Edit],
  FAILED: [ListingAction.Edit],
  ARCHIVED: [ListingAction.Unarchive],
  // Sold is final.
  SOLD: [],
};

/** The "•••" sheet's actions (api-spec, "State transitions"; PATCH takes PROCESSING, FAILED, PUBLISHED). */
export const getListingActions = (status: ProductStatus) => actionsByStatus[status];

import type { MyListingsTab } from '@/features/my-listings/types/my-listing';

/**
 * Every my-listings query starts with `['my-listings']`: invalidate that root after anything
 * changes a listing of the owner's (a post, an edit, a status change).
 */
export const myListingKeys = {
  all: () => ['my-listings'] as const,
  list: (tab: MyListingsTab, viewerId: string | null) =>
    ['my-listings', 'list', tab, { viewerId }] as const,
  /** Filled by the list queries; never fetched on its own. */
  counts: (viewerId: string | null) => ['my-listings', 'counts', { viewerId }] as const,
};

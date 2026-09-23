import type { ProductFeedParams } from '../types';

// Hierarchical keys (broad → specific) so mutations can invalidate a whole
// branch, e.g. every feed after a listing is sold: productKeys.feeds().
export const productKeys = {
  all: ['products'] as const,
  feeds: () => [...productKeys.all, 'feed'] as const,
  feed: (params: ProductFeedParams) => [...productKeys.feeds(), params] as const,
  details: () => [...productKeys.all, 'detail'] as const,
  // The viewer changes owner/report fields, so it is part of the key.
  detail: (productId: string, viewerId: string | null) =>
    [...productKeys.details(), productId, { viewerId }] as const,
};

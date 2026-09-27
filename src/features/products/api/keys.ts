import type { ProductFeedParams } from '@/features/products/types/product';

export const productKeys = {
  /** Every feed query, whatever its search and filters. */
  feeds: () => ['products', 'feed'] as const,
  feed: (params: ProductFeedParams) => ['products', 'feed', params] as const,
  // The viewer changes owner/report fields, so it is part of the key.
  detail: (productId: string, viewerId: string | null) =>
    ['products', 'detail', productId, { viewerId }] as const,
  /** One product's detail for every viewer. */
  detailForAllViewers: (productId: string) => ['products', 'detail', productId] as const,
};

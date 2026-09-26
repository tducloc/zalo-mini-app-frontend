import type { ProductFeedParams } from '@/features/products/types/product';

export const productKeys = {
  feed: (params: ProductFeedParams) => ['products', 'feed', params] as const,
  // The viewer changes owner/report fields, so it is part of the key.
  detail: (productId: string, viewerId: string | null) =>
    ['products', 'detail', productId, { viewerId }] as const,
};

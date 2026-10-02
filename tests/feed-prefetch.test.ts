// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getProductFeed } from '@/features/products/api/get-product-feed';
import type { ProductFeedPage } from '@/features/products/types/product';
import { apiClient } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
  apiClient: { get: vi.fn() },
}));

const defaults = { sortBy: 'publishedAt' as const, order: 'desc' as const };

const page: ProductFeedPage = {
  data: [],
  meta: { nextCursor: null, hasNextPage: false },
};

describe('getProductFeed prefetch', () => {
  beforeEach(() => {
    window.__feedPrefetch = undefined;
    vi.mocked(apiClient.get).mockReset();
  });

  it('uses the early feed once, then asks the API', async () => {
    window.__feedPrefetch = Promise.resolve(page);

    await expect(getProductFeed(defaults, undefined)).resolves.toBe(page);
    expect(apiClient.get).not.toHaveBeenCalled();

    vi.mocked(apiClient.get).mockResolvedValue({ data: page });
    await getProductFeed(defaults, undefined);
    expect(apiClient.get).toHaveBeenCalledOnce();
  });

  it('does not use the early feed for a filtered page', async () => {
    window.__feedPrefetch = Promise.resolve(page);
    vi.mocked(apiClient.get).mockResolvedValue({ data: page });

    await getProductFeed({ ...defaults, q: 'ghe' }, undefined);
    expect(window.__feedPrefetch).toBeDefined();
    expect(apiClient.get).toHaveBeenCalledOnce();
  });
});

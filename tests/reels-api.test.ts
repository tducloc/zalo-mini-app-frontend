import type { InternalAxiosRequestConfig } from 'axios';

import { getReels } from '@/features/reels/api/get-reels';
import type { ReelsPage } from '@/features/reels/types/reel';
import { apiClient } from '@/lib/api-client';

const originalAdapter = apiClient.defaults.adapter;
const page: ReelsPage = { data: [], meta: { nextCursor: 'next', hasNextPage: true } };

let requests: InternalAxiosRequestConfig[] = [];

beforeEach(() => {
  requests = [];
  apiClient.defaults.adapter = async (config) => {
    requests.push(config);
    return { status: 200, statusText: 'OK', headers: {}, config, data: page };
  };
});

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
});

it('asks for the first ten reels without a cursor or a token', async () => {
  await expect(getReels(undefined)).resolves.toEqual(page);

  expect(requests).toHaveLength(1);
  expect(requests[0].method).toBe('get');
  expect(requests[0].url).toBe('/reels');
  expect(requests[0].params).toEqual({ limit: 10, cursor: undefined });
  expect(requests[0].headers.Authorization).toBeUndefined();
});

it('passes the previous page’s cursor for the next page', async () => {
  await getReels('opaque-next-cursor');

  expect(requests[0].params).toEqual({ limit: 10, cursor: 'opaque-next-cursor' });
});

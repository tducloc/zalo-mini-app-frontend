import { QueryClient, QueryClientProvider, type UseQueryResult } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => new Map<string, string>());
const nativeStorage = vi.hoisted(() => ({
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => {
    store.set(key, value);
  },
  removeItem: (key: string) => {
    store.delete(key);
  },
}));

vi.mock('zmp-sdk', () => ({ nativeStorage }));

import { useCategories } from '@/features/categories/api/get-categories';
import { useLocations } from '@/features/locations/api/get-locations';
import { apiClient } from '@/lib/api-client';

const SAVED_VERSION = 1;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const savedCategories = [{ id: 'cat_fashion', name: 'Fashion', slug: 'fashion' }];
const freshCategories = [{ id: 'cat_vehicles', name: 'Vehicles', slug: 'vehicles' }];
const savedLocations = [{ id: 'loc_hn', code: 'HN', name: 'Hà Nội' }];
const freshLocations = [{ id: 'loc_hcm', code: 'HCM', name: 'TP.HCM' }];

const originalAdapter = apiClient.defaults.adapter;
let release: () => void;
let requests: string[];

function save(key: string, data: unknown, savedAt = Date.now(), v = SAVED_VERSION) {
  store.set(key, JSON.stringify({ v, savedAt, data }));
}

function serve(responses: Record<string, unknown>, status = 200) {
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  apiClient.defaults.adapter = async (config) => {
    requests.push(config.url ?? '');
    await gate;
    const data = { data: responses[config.url ?? ''] };
    return { status, statusText: '', headers: {}, config, data };
  };
}

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  store.clear();
  requests = [];
});

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
});

describe.each([
  {
    name: 'categories',
    url: '/categories',
    key: 'categories',
    saved: savedCategories,
    fresh: freshCategories,
    useHook: (): UseQueryResult<{ id: string }[]> => useCategories(),
    ids: (data: { id: string }[] | undefined) => data?.map((item) => item.id),
    savedIds: ['cat_fashion'],
    freshIds: ['cat_vehicles'],
  },
  {
    name: 'locations',
    url: '/locations',
    key: 'locations',
    saved: savedLocations,
    fresh: freshLocations,
    useHook: (): UseQueryResult<{ id: string }[]> => useLocations(),
    ids: (data: { id: string }[] | undefined) => data?.map((item) => item.id),
    savedIds: ['loc_hn'],
    freshIds: ['loc_hcm'],
  },
])('$name', ({ url, key, saved, fresh, useHook, ids, savedIds, freshIds }) => {
  it('shows the saved copy at once and still asks the server once', async () => {
    save(key, saved);
    serve({ [url]: fresh });

    const { result } = renderHook(useHook, { wrapper: wrapper() });

    expect(ids(result.current.data)).toEqual(savedIds);
    expect(result.current.isPending).toBe(false);
    expect(result.current.isPlaceholderData).toBe(true);

    release();
    await waitFor(() => expect(ids(result.current.data)).toEqual(freshIds));
    expect(result.current.isPlaceholderData).toBe(false);
    expect(requests).toEqual([url]);
  });

  it('saves the server answer for the next app open', async () => {
    serve({ [url]: fresh });
    const { result } = renderHook(useHook, { wrapper: wrapper() });

    release();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(JSON.parse(store.get(key) ?? 'null')).toMatchObject({ v: SAVED_VERSION, data: fresh });
  });

  it('behaves as before with nothing saved', async () => {
    serve({ [url]: fresh });
    const { result } = renderHook(useHook, { wrapper: wrapper() });

    expect(result.current.data).toBeUndefined();
    expect(result.current.isPending).toBe(true);

    release();
    await waitFor(() => expect(ids(result.current.data)).toEqual(freshIds));
    expect(requests).toEqual([url]);
  });

  it('ignores a copy older than seven days', () => {
    save(key, saved, Date.now() - SEVEN_DAYS_MS - 1000);
    serve({ [url]: fresh });

    const { result } = renderHook(useHook, { wrapper: wrapper() });

    expect(result.current.data).toBeUndefined();
    expect(result.current.isPending).toBe(true);
  });

  it('ignores a saved value that is not a list', () => {
    save(key, { [key]: saved });
    serve({ [url]: fresh });

    const { result } = renderHook(useHook, { wrapper: wrapper() });

    expect(result.current.data).toBeUndefined();
    expect(result.current.isPending).toBe(true);
  });

  it('reads the saved copy once while the request is pending', () => {
    save(key, saved);
    serve({ [url]: fresh });
    const getItem = vi.spyOn(nativeStorage, 'getItem');

    const { rerender } = renderHook(useHook, { wrapper: wrapper() });
    rerender();
    rerender();

    expect(getItem.mock.calls.filter(([read]) => read === key)).toHaveLength(1);
    getItem.mockRestore();
  });

  it('reports a failed request as an error, keeping the saved copy for the next open', async () => {
    save(key, saved);
    apiClient.defaults.adapter = async () => {
      throw new Error('offline');
    };

    const { result } = renderHook(useHook, { wrapper: wrapper() });
    expect(ids(result.current.data)).toEqual(savedIds);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(JSON.parse(store.get(key) ?? 'null')).toMatchObject({ data: saved });
  });
});

describe('categories placeholder', () => {
  it('goes through the same display mapping as server data', () => {
    save('categories', [
      { id: 'cat_vehicles', name: 'Vehicles', slug: 'vehicles' },
      { id: 'cat_electronics', name: 'Electronics', slug: 'electronics' },
    ]);
    serve({});

    const { result } = renderHook(() => useCategories(), { wrapper: wrapper() });

    expect(result.current.data?.map(({ label }) => label)).toEqual(['Điện tử', 'Xe cộ']);
  });
});

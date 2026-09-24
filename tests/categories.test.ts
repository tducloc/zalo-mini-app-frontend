import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { getCategories } from '@/features/categories/api/get-categories';
import { apiClient } from '@/lib/api-client';

it('exposes pending, success and cached data for categories without authentication', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let finish;
  apiClient.defaults.adapter = (config) =>
    new Promise((resolve) => {
      expect(config.headers.Authorization).toBeUndefined();
      finish = () =>
        resolve({
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          data: { data: [{ id: 'cat_electronics', name: 'Điện tử', slug: 'electronics' }] },
        });
    });
  const observer = new QueryObserver(client, {
    queryKey: ['categories'],
    queryFn: ({ signal }) => getCategories(signal),
    staleTime: 300000,
  });
  const unsubscribe = observer.subscribe(() => {});
  expect(observer.getCurrentResult().isPending).toBe(true);
  finish();
  await vi.waitFor(() => expect(observer.getCurrentResult().isSuccess).toBe(true));
  expect(client.getQueryData(['categories'])).toHaveLength(1);
  unsubscribe();
  client.clear();
});

it('supports retry after categories fail and accepts an empty list', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  apiClient.defaults.adapter = async () => {
    throw new Error('offline');
  };
  const observer = new QueryObserver(client, {
    queryKey: ['categories'],
    queryFn: () => getCategories(),
  });
  const unsubscribe = observer.subscribe(() => {});
  await vi.waitFor(() => expect(observer.getCurrentResult().isError).toBe(true));
  apiClient.defaults.adapter = async (config) => ({
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
    data: { data: [] },
  });
  await observer.refetch();
  expect(observer.getCurrentResult().data).toEqual([]);
  expect(observer.getCurrentResult().isError).toBe(false);
  unsubscribe();
  client.clear();
});

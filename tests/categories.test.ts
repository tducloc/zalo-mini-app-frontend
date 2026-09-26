import { getCategories } from '@/features/categories/api/get-categories';
import { apiClient } from '@/lib/api-client';

const originalAdapter = apiClient.defaults.adapter;

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
});

it('fetches categories without authentication and unwraps the data envelope', async () => {
  const categories = [{ id: 'cat_electronics', name: 'Điện tử', slug: 'electronics' }];
  apiClient.defaults.adapter = async (config) => {
    expect(config.headers.Authorization).toBeUndefined();
    return { status: 200, statusText: 'OK', headers: {}, config, data: { data: categories } };
  };

  await expect(getCategories()).resolves.toEqual(categories);
});

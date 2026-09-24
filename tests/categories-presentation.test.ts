import { DEFAULT_CATEGORY_ICON } from '@/features/categories/constants';
import { getCategoryLabel, presentCategories } from '@/features/categories/utils/presentation';

const apiCategories = [
  { id: 'cat_electronics', name: 'Electronics', slug: 'electronics' },
  { id: 'cat_fashion', name: 'Fashion', slug: 'fashion' },
  { id: 'cat_home_living', name: 'Home & Living', slug: 'home-living' },
  { id: 'cat_others', name: 'Others', slug: 'others' },
  { id: 'cat_vehicles', name: 'Vehicles', slug: 'vehicles' },
];

describe('presentCategories', () => {
  it('uses Vietnamese labels in the fixed display order, not the API order', () => {
    expect(presentCategories(apiCategories).map((category) => category.label)).toEqual([
      'Điện tử',
      'Nhà cửa',
      'Thời trang',
      'Xe cộ',
      'Khác',
    ]);
  });

  it('gives every backend category an icon', () => {
    expect(presentCategories(apiCategories).every((category) => category.icon)).toBe(true);
  });

  it('appends categories the app does not know with their API name', () => {
    const result = presentCategories([
      { id: 'cat_books', name: 'Books', slug: 'books' },
      apiCategories[0],
    ]);

    expect(result.map((category) => category.label)).toEqual(['Điện tử', 'Books']);
    expect(result[1].icon).toBe(DEFAULT_CATEGORY_ICON);
  });

  it('drops presentation entries the API did not return', () => {
    expect(presentCategories([])).toEqual([]);
  });
});

it('labels a category by ID and falls back to its API name', () => {
  expect(getCategoryLabel({ id: 'cat_home_living', name: 'Home & Living' })).toBe('Nhà cửa');
  expect(getCategoryLabel({ id: 'cat_books', name: 'Books' })).toBe('Books');
});

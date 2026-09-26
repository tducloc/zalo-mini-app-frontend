import { SEARCH_MAX_LENGTH, DEFAULT_FILTERS } from '@/features/feed/constants/filters';
import type { FeedFilters } from '@/features/feed/types/filters';
import {
  getActiveFilterKeys,
  getFilterChips,
  nextChoice,
  normalizeSearch,
  removeFilter,
  toFeedQueryParams,
  toggleCategory,
} from '@/features/feed/utils/filters';

const lookups = {
  categories: [{ id: 'cat_vehicles', label: 'Xe cộ', icon: 'zi-auto' as const }],
  locations: [{ id: 'loc_hanoi', code: 'hanoi', name: 'Hà Nội' }],
};

describe('normalizeSearch', () => {
  it('trims input and treats whitespace-only as no search', () => {
    expect(normalizeSearch('  iphone  ')).toBe('iphone');
    expect(normalizeSearch('sofa  \n góc')).toBe('sofa góc');
    expect(normalizeSearch('   ')).toBeUndefined();
    expect(normalizeSearch('')).toBeUndefined();
  });

  it('caps the term at the search length limit', () => {
    expect(normalizeSearch('a'.repeat(SEARCH_MAX_LENGTH + 50))).toHaveLength(SEARCH_MAX_LENGTH);
  });
});

describe('toFeedQueryParams', () => {
  it('maps every sort option to the API sort and order', () => {
    const sorts = {
      newest: ['publishedAt', 'desc'],
      oldest: ['publishedAt', 'asc'],
      'price-asc': ['price', 'asc'],
      'price-desc': ['price', 'desc'],
    } as const;

    for (const [sort, [sortBy, order]] of Object.entries(sorts)) {
      expect(toFeedQueryParams({ sort: sort as FeedFilters['sort'] }, '')).toEqual({
        sortBy,
        order,
      });
    }
  });

  it('omits empty values so equal filters produce an equal query key', () => {
    const withUndefined = toFeedQueryParams(
      { sort: 'newest', categoryId: undefined, minPrice: undefined },
      '  ',
    );
    expect(withUndefined).toEqual(toFeedQueryParams(DEFAULT_FILTERS, ''));
    expect(Object.keys(withUndefined)).toEqual(['sortBy', 'order']);
  });

  it('keeps a zero minimum price', () => {
    expect(toFeedQueryParams({ sort: 'newest', minPrice: 0 }, '').minPrice).toBe(0);
  });

  it('includes search and every applied filter', () => {
    expect(
      toFeedQueryParams(
        {
          sort: 'price-asc',
          categoryId: 'cat_vehicles',
          locationId: 'loc_hanoi',
          condition: 'USED',
          hasVideo: true,
          minPrice: 1_000_000,
          maxPrice: 5_000_000,
        },
        ' honda ',
      ),
    ).toEqual({
      q: 'honda',
      categoryId: 'cat_vehicles',
      locationId: 'loc_hanoi',
      condition: 'USED',
      hasVideo: true,
      minPrice: 1_000_000,
      maxPrice: 5_000_000,
      sortBy: 'price',
      order: 'asc',
    });
  });
});

describe('category and chip helpers', () => {
  it('toggles a category on and off', () => {
    const selected = toggleCategory(DEFAULT_FILTERS, 'cat_vehicles');
    expect(selected.categoryId).toBe('cat_vehicles');
    expect(toggleCategory(selected, 'cat_vehicles').categoryId).toBeUndefined();
  });

  it('builds removable chips with display labels', () => {
    const filters: FeedFilters = {
      sort: 'price-desc',
      categoryId: 'cat_vehicles',
      locationId: 'loc_hanoi',
      condition: 'LIKE_NEW',
      hasVideo: true,
      minPrice: 0,
    };

    expect(getFilterChips(filters, lookups).map((chip) => chip.label)).toEqual([
      'Hà Nội',
      'Xe cộ',
      'Như mới',
      'Có video',
      `Từ ${new Intl.NumberFormat('vi-VN').format(0)} đ`,
      'Giá cao đến thấp',
    ]);
    expect(getActiveFilterKeys(filters)).toHaveLength(6);
  });

  it('shows no chips for the default filters', () => {
    expect(getFilterChips(DEFAULT_FILTERS, lookups)).toEqual([]);
    expect(getActiveFilterKeys(DEFAULT_FILTERS)).toEqual([]);
  });

  it('removes a chip without touching the other filters', () => {
    const filters: FeedFilters = {
      sort: 'oldest',
      locationId: 'loc_hanoi',
      minPrice: 10,
      maxPrice: 20,
    };

    expect(removeFilter(filters, 'price')).toEqual({
      sort: 'oldest',
      locationId: 'loc_hanoi',
      minPrice: undefined,
      maxPrice: undefined,
    });
    expect(removeFilter(filters, 'sort').sort).toBe('newest');
    expect(removeFilter(filters, 'locationId').locationId).toBeUndefined();
    expect(removeFilter({ ...filters, hasVideo: true }, 'hasVideo').hasVideo).toBeUndefined();
  });
});

describe('nextChoice', () => {
  it('selects a new option and clears the current one on a second tap', () => {
    expect(nextChoice(undefined, 'NEW')).toBe('NEW');
    expect(nextChoice('NEW', 'USED')).toBe('USED');
    expect(nextChoice('NEW', 'NEW')).toBeUndefined();
  });

  it('keeps a required choice selected', () => {
    expect(nextChoice('newest', 'newest', true)).toBe('newest');
  });
});

describe('chip edge cases', () => {
  const price = (value: number) => `${new Intl.NumberFormat('vi-VN').format(value)} đ`;

  it('labels an upper-bound-only price range and counts it once', () => {
    const filters: FeedFilters = { sort: 'newest', maxPrice: 5_000_000 };

    expect(getFilterChips(filters, lookups)).toEqual([
      { key: 'price', label: `Đến ${price(5_000_000)}` },
    ]);
    expect(getActiveFilterKeys(filters)).toEqual(['price']);
  });

  it('labels a full price range with both bounds', () => {
    const [chip] = getFilterChips({ sort: 'newest', minPrice: 1, maxPrice: 2 }, lookups);
    expect(chip.label).toBe(`${price(1)} – ${price(2)}`);
  });

  it('falls back to generic labels while lookups are not loaded', () => {
    const filters: FeedFilters = { sort: 'newest', locationId: 'loc_x', categoryId: 'cat_x' };

    expect(
      getFilterChips(filters, { categories: [], locations: [] }).map((chip) => chip.label),
    ).toEqual(['Khu vực đã chọn', 'Danh mục đã chọn']);
  });
});

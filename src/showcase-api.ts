import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';

import { apiClient } from '@/lib/api-client';

// Showcase-only fake backend: the real pages render against these responses,
// so the design review never needs auth or a running API.
export const SHOWCASE_FEED_STATES = ['default', 'loading', 'empty', 'error'] as const;
export type ShowcaseFeedState = (typeof SHOWCASE_FEED_STATES)[number];

export function isShowcaseFeedState(value: string | null): value is ShowcaseFeedState {
  return SHOWCASE_FEED_STATES.some((state) => state === value);
}

const HOUR_MS = 3_600_000;

const photo = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=400&h=400&q=70`;

const hoursAgo = (hours: number) => new Date(Date.now() - hours * HOUR_MS).toISOString();

const hanoi = { id: 'loc_hanoi', name: 'Hà Nội' };
const hcm = { id: 'loc_ho_chi_minh', name: 'TP. Hồ Chí Minh' };

const products = [
  {
    title: 'iPhone 13 128GB',
    price: 6_990_000,
    categoryId: 'cat_electronics',
    photoId: '1592750475338-74b7b21085ab',
    location: hanoi,
    ageHours: 2,
    hasVideo: false,
  },
  {
    title: 'Ghế văn phòng công thái học',
    price: 1_200_000,
    categoryId: 'cat_home_living',
    photoId: '1586023492125-27b2c045efd7',
    location: hcm,
    ageHours: 4,
    hasVideo: false,
  },
  {
    title: 'Giày thể thao Nike Air',
    price: 850_000,
    categoryId: 'cat_fashion',
    photoId: '1542291026-7eec264c27ff',
    location: hanoi,
    ageHours: 6,
    hasVideo: true,
  },
  {
    title: 'MacBook Air M1 256GB',
    price: 8_500_000,
    categoryId: 'cat_electronics',
    photoId: '1517336714731-489689fd1ca8',
    location: hcm,
    ageHours: 26,
    hasVideo: false,
  },
];

const feedPage = {
  data: products.map((product, index) => ({
    id: `prd_showcase_${index}`,
    title: product.title,
    price: product.price,
    condition: 'LIKE_NEW',
    category: { id: product.categoryId, name: product.categoryId, slug: product.categoryId },
    thumbnailUrl: photo(product.photoId),
    hasVideo: product.hasVideo,
    location: product.location,
    publishedAt: hoursAgo(product.ageHours),
  })),
  meta: { nextCursor: null, hasNextPage: false },
};

const emptyFeedPage = { data: [], meta: { nextCursor: null, hasNextPage: false } };

const responses: Record<string, unknown> = {
  '/categories': {
    data: [
      { id: 'cat_electronics', name: 'Electronics', slug: 'electronics' },
      { id: 'cat_fashion', name: 'Fashion', slug: 'fashion' },
      { id: 'cat_home_living', name: 'Home & Living', slug: 'home-living' },
      { id: 'cat_others', name: 'Others', slug: 'others' },
      { id: 'cat_vehicles', name: 'Vehicles', slug: 'vehicles' },
    ],
  },
  '/locations': {
    data: [
      { ...hanoi, code: 'hanoi' },
      { ...hcm, code: 'ho-chi-minh' },
    ],
  },
};

function respond(config: InternalAxiosRequestConfig, data: unknown) {
  return Promise.resolve({ status: 200, statusText: 'OK', headers: {}, config, data });
}

export function installShowcaseApi(feedState: ShowcaseFeedState) {
  const adapter: AxiosAdapter = (config) => {
    if (config.url !== '/products') {
      return respond(config, responses[config.url ?? ''] ?? { data: [] });
    }

    if (feedState === 'loading') {
      return new Promise(() => {});
    }

    if (feedState === 'error') {
      return Promise.reject(new Error('Showcase network error'));
    }

    return respond(config, feedState === 'empty' ? emptyFeedPage : feedPage);
  };

  apiClient.defaults.adapter = adapter;
}

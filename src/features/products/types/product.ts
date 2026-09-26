import type { productConditions } from '@/features/products/constants/product';

export type ProductCondition = (typeof productConditions)[number];

export type MediaType = 'IMAGE' | 'VIDEO';

/** `id` is null for legacy rows whose free-text location is not mapped yet. */
export interface ProductLocation {
  id: string | null;
  name: string;
}

export type ProductDetail = {
  id: string;
  title: string;
  description: string;
  price: number;
  condition: ProductCondition;
  status: 'PROCESSING' | 'FAILED' | 'PUBLISHED' | 'SOLD' | 'ARCHIVED';
  location: ProductLocation;
  category: {
    id: string;
    name: string;
    slug: string;
  };
  media: Array<{
    id: string;
    role: 'MAIN' | 'GALLERY';
    type: MediaType;
    thumbnailUrl: string | null;
    mediumUrl: string | null;
    durationMs: number | null;
    sortOrder: number;
  }>;
  seller: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
    contact: {
      zaloProfileId: string;
      phoneNumber: string | null;
    } | null;
  };
  viewer: {
    isOwner: boolean;
    hasReported: boolean;
  };
  createdAt: string;
  publishedAt: string | null;
};

export interface ProductCard {
  id: string;
  title: string;
  price: number;
  condition: ProductCondition;
  category: { id: string; name: string; slug: string };
  thumbnailUrl: string | null;
  hasVideo: boolean;
  location: ProductLocation;
  publishedAt: string;
}

export interface ProductFeedParams {
  q?: string;
  categoryId?: string;
  locationId?: string;
  condition?: ProductCondition;
  hasVideo?: true;
  minPrice?: number;
  maxPrice?: number;
  sortBy: 'publishedAt' | 'price';
  order: 'asc' | 'desc';
}

export interface ProductFeedPage {
  data: ProductCard[];
  meta: { nextCursor: string | null; hasNextPage: boolean };
}

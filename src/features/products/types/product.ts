import type { productConditions } from '@/features/products/constants/product';

export type ProductCondition = (typeof productConditions)[number];

export type MediaType = 'IMAGE' | 'VIDEO';

/** A listing's status (api-spec, "State transitions"). */
export type ProductStatus = 'PROCESSING' | 'FAILED' | 'PUBLISHED' | 'SOLD' | 'ARCHIVED';

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
  status: ProductStatus;
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
    /** Buyers get READY media only; the owner sees every item (api-spec, GET /products/:id). */
    status?: 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED';
    /** The FAILED reason (a `GET /media` code), else null. */
    error?: string | null;
    thumbnailUrl: string | null;
    mediumUrl: string | null;
    placeholder?: string | null;
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
  /** A 3 s muted square clip of the listing's video, for the card; null without one. */
  previewUrl: string | null;
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

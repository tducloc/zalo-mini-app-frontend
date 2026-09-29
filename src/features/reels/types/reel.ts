import type { ProductLocation } from '@/features/products/types/product';

export interface ReelItem {
  id: string;
  title: string;
  price: number;
  location: ProductLocation;
  publishedAt: string;
  seller: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  };
  video: {
    id: string;
    url: string;
    posterUrl: string | null;
    placeholder: string | null;
    width: number | null;
    height: number | null;
    durationMs: number | null;
  };
}

export interface ReelsPage {
  data: ReelItem[];
  meta: { nextCursor: string | null; hasNextPage: boolean };
}

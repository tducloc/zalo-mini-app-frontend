import type { ProductLocation } from '@/features/products/types/product';

/** One item of `GET /reels`: a published listing and its ready video (api-spec). */
export interface ReelItem {
  /** The product ID; the detail is `GET /products/:id`. */
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
    posterUrl: string;
    /** Base64 ThumbHash of the poster; null for media stored before the worker wrote it. */
    placeholder: string | null;
    /** As played (rotation applied); null like `placeholder`, and then treated as portrait. */
    width: number | null;
    height: number | null;
    durationMs: number | null;
  };
}

export interface ReelsPage {
  data: ReelItem[];
  meta: { nextCursor: string | null; hasNextPage: boolean };
}

import type { ProductCondition } from '@/features/products/types/product';

/** The form's values as the seller typed them; the form schema checks and converts them. */
export interface DraftFields {
  title: string;
  description: string;
  /** As typed ("6.990.000"); a number only once the schema accepts it. */
  price: string;
  categoryId: string;
  condition: ProductCondition | '';
  locationId: string;
}

/** Why Post cannot go yet. */
export enum PostBlocker {
  /** A file failed (the tile's "!"): retry or remove it. */
  NeedsAttention = 'NEEDS_ATTENTION',
  /** The cover is required (the listing card shows it). */
  NoPhoto = 'NO_PHOTO',
  /** Files are still being checked, optimized or uploaded. */
  Working = 'WORKING',
}

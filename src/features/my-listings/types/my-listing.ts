/** The owner's listings: the shapes of `GET /me/products` (api-spec.md), and what the page does with them. */

import type { MY_LISTINGS_TABS } from '@/features/my-listings/constants/tabs';
import type { MediaType, ProductStatus } from '@/features/products/types/product';

export type MyListingsTab = (typeof MY_LISTINGS_TABS)[number];

export interface FailedMedia {
  id: string;
  type: MediaType;
  /** A string: a newer server may send a code this app does not know. */
  error: string | null;
}

export interface MyListing {
  id: string;
  title: string;
  price: number;
  status: ProductStatus;
  thumbnailUrl: string | null;
  hasVideo: boolean;
  failedMedia: FailedMedia[];
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  soldAt: string | null;
  archivedAt: string | null;
}

/** The owner's number of listings per status, whatever the filter. */
export type ListingCounts = Record<ProductStatus, number>;

export interface MyListingsPage {
  data: MyListing[];
  meta: { nextCursor: string | null; hasNextPage: boolean; counts: ListingCounts };
}

/** What the owner can do with a listing from its "•••" sheet. */
export enum ListingAction {
  Edit = 'EDIT',
  MarkSold = 'MARK_SOLD',
  Archive = 'ARCHIVE',
  Unarchive = 'UNARCHIVE',
}

/** The actions that change the listing's status on the server. */
export type StatusChange = Exclude<ListingAction, ListingAction.Edit>;

export enum StatusTone {
  Muted = 'MUTED',
  Progress = 'PROGRESS',
  Danger = 'DANGER',
}

/** The line under a card's price that says where the listing stands. */
export interface StatusLine {
  label: string;
  tone: StatusTone;
  /** A second line: what to do about a failed file. */
  hint?: string;
}

export interface TabBadge {
  count: number;
  /** A listing failed: the seller has something to fix. */
  isAlert: boolean;
}

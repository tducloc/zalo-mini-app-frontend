import type { ListingFieldValues } from '@/features/listings/schemas';
import type { DraftFields } from '@/features/listings/types/listing-draft';
import type { RefusedMedia } from '@/features/listings/types/post-error';

/** `PATCH /products/:id`: only what changed; `mediaIds` is the whole media set in order. */
export interface UpdateListingInput extends Partial<ListingFieldValues> {
  mediaIds?: string[];
}

/** How `PATCH /products/:id` failed, as api/update-listing.ts reads it. */
export enum SaveErrorKind {
  /** 400 on the listing's fields: the form points at them. */
  Fields = 'FIELDS',
  /** 400 on what the app built (`mediaIds`): the seller cannot fix it. */
  Invalid = 'INVALID',
  /** 409 naming files the server cannot use: their tiles ask for another file. */
  MediaConflict = 'MEDIA_CONFLICT',
  /** Sold, archived, removed or not the seller's any more (409 without files, 403, 404). */
  NotEditable = 'NOT_EDITABLE',
  /** The network or the server. */
  Other = 'OTHER',
}

export type SaveError =
  | { kind: SaveErrorKind.Fields; fields: (keyof DraftFields)[] }
  | { kind: SaveErrorKind.Invalid }
  | { kind: SaveErrorKind.MediaConflict; media: RefusedMedia[] }
  | { kind: SaveErrorKind.NotEditable }
  | { kind: SaveErrorKind.Other };

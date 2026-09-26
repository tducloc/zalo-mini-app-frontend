import type { DraftFields } from '@/features/listings/types/listing-draft';

/** How `POST /products` failed, as api/create-listing.ts reads it. */
export enum PostErrorKind {
  /** 400 on the listing's fields: the form points at them. */
  Fields = 'FIELDS',
  /** 400 on what the app built (`mediaIds`, the key): the seller cannot fix it. */
  Invalid = 'INVALID',
  /** 409: a file the server cannot use (removed, or on another listing). */
  MediaConflict = 'MEDIA_CONFLICT',
  /** 422: the draft's key already made a listing, whose answer was lost. */
  AlreadyPosted = 'ALREADY_POSTED',
  /** The network or the server. */
  Other = 'OTHER',
}

export type PostError =
  | { kind: PostErrorKind.Fields; fields: (keyof DraftFields)[] }
  | { kind: PostErrorKind.Invalid }
  | { kind: PostErrorKind.MediaConflict }
  | { kind: PostErrorKind.AlreadyPosted; productId: string }
  | { kind: PostErrorKind.Other };

/** What a refused `POST /products` or `PATCH /products/:id` names (api-spec, error envelope). */

import { z } from 'zod';

import { listingFieldsSchema } from '@/features/listings/schemas';
import type { RefusedMedia } from '@/features/listings/types/post-error';
import { MediaError } from '@/features/media/types/upload';
import { toMediaError } from '@/features/media/utils/media-error';

const draftField = listingFieldsSchema.keyof();
const fieldDetails = z.array(z.object({ field: z.string() }));
// Strings, not enums: a reason or code this app does not know still marks the file.
const conflictDetails = z.array(
  z.object({ mediaId: z.string(), reason: z.string(), errorCode: z.string().optional() }),
);

/** The listing's fields a 400 names; the rest (`mediaIds`, the key) the seller cannot fix. */
export const refusedFieldsOf = (details: unknown) =>
  (fieldDetails.safeParse(details).data ?? []).flatMap(
    ({ field }) => draftField.safeParse(field).data ?? [],
  );

/**
 * The media a 409 names, each with what its tile tells the seller: FAILED keeps the
 * processing error; NOT_FOUND, ATTACHED and UPLOADING all mean the file must be picked
 * again. None for a wrong listing status.
 */
export const refusedMediaOf = (details: unknown): RefusedMedia[] =>
  (conflictDetails.safeParse(details).data ?? []).map(({ mediaId, reason, errorCode }) => ({
    mediaId,
    error:
      reason === 'FAILED'
        ? (toMediaError(errorCode) ?? MediaError.ProcessingFailed)
        : MediaError.Missing,
  }));

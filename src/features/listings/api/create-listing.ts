/**
 * `POST /products` (api-spec): posting the draft, and what an error means for it, read
 * from its status and error envelope (pure, so each case is unit-tested).
 */

import { z } from 'zod';

import { refusedFieldsOf, refusedMediaOf } from '@/features/listings/api/listing-errors';
import type { ListingFieldValues } from '@/features/listings/schemas';
import { PostErrorKind, type PostError } from '@/features/listings/types/post-error';
import { http } from '@/lib/http';
import { getApiErrorDetails, getApiErrorStatus, HttpStatus } from '@/utils/api-error';

/**
 * Posts the listing; `idempotencyKey` is the draft's, the same on every retry, so a post
 * whose answer was lost is not made twice. Resolves true when it is published at once
 * (201: every file was ready), false while it waits for its media (202).
 */
export async function createListing(
  fields: ListingFieldValues,
  mediaIds: string[],
  idempotencyKey: string,
) {
  const response = await http.post<{ data?: { status?: string } }>(
    '/products',
    { ...fields, mediaIds },
    { headers: { 'Idempotency-Key': idempotencyKey } },
  );
  return response.data.data?.status === 'PUBLISHED';
}

const reusedDetails = z.object({ productId: z.string() });

const INVALID: PostError = { kind: PostErrorKind.Invalid };
const OTHER: PostError = { kind: PostErrorKind.Other };

function fieldsError(details: unknown): PostError {
  const fields = refusedFieldsOf(details);
  return fields.length > 0 ? { kind: PostErrorKind.Fields, fields } : INVALID;
}

function conflictError(details: unknown): PostError {
  return { kind: PostErrorKind.MediaConflict, mediaIds: refusedMediaOf(details) };
}

function reusedError(details: unknown): PostError {
  const parsed = reusedDetails.safeParse(details);
  return parsed.success
    ? { kind: PostErrorKind.AlreadyPosted, productId: parsed.data.productId }
    : OTHER;
}

export function readPostError(error: unknown): PostError {
  const details = getApiErrorDetails(error);

  switch (getApiErrorStatus(error)) {
    case HttpStatus.BadRequest:
      return fieldsError(details);
    case HttpStatus.Conflict:
      return conflictError(details);
    case HttpStatus.UnprocessableEntity:
      return reusedError(details);
    default:
      return OTHER;
  }
}

/**
 * `PATCH /products/:id` (api-spec): saving an edit, and what an error means for the form,
 * read from its status and error envelope (pure, so each case is unit-tested).
 */

import {
  HttpStatus,
  refusedFieldsOf,
  refusedMediaOf,
} from '@/features/listings/api/create-listing';
import {
  type SaveError,
  SaveErrorKind,
  type UpdateListingInput,
} from '@/features/listings/types/update-listing';
import type { ProductDetail } from '@/features/products/types/product';
import { http } from '@/lib/http';
import { getApiErrorDetails, getApiErrorStatus } from '@/utils/api-error';

/** Saves the changes; resolves with the listing as saved (PROCESSING while new media is). */
export async function updateListing(productId: string, changes: UpdateListingInput) {
  const response = await http.patch<{ data: ProductDetail }>(
    `/products/${encodeURIComponent(productId)}`,
    changes,
  );
  return response.data.data;
}

const NOT_EDITABLE: SaveError = { kind: SaveErrorKind.NotEditable };

function badRequestError(details: unknown): SaveError {
  const fields = refusedFieldsOf(details);
  return fields.length > 0
    ? { kind: SaveErrorKind.Fields, fields }
    : { kind: SaveErrorKind.Invalid };
}

/** A 409 names the media it refuses; without any, the listing's status forbids the edit. */
function conflictError(details: unknown): SaveError {
  const mediaIds = refusedMediaOf(details);
  return mediaIds.length > 0 ? { kind: SaveErrorKind.MediaConflict, mediaIds } : NOT_EDITABLE;
}

export function readSaveError(error: unknown): SaveError {
  const details = getApiErrorDetails(error);

  switch (getApiErrorStatus(error)) {
    case HttpStatus.BadRequest:
      return badRequestError(details);
    case HttpStatus.Conflict:
      return conflictError(details);
    case HttpStatus.Forbidden:
    case HttpStatus.NotFound:
      return NOT_EDITABLE;
    default:
      return { kind: SaveErrorKind.Other };
  }
}

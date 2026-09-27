/** What a refused `POST /products` or `PATCH /products/:id` names (api-spec, error envelope). */

import { z } from 'zod';

import { listingFieldsSchema } from '@/features/listings/schemas';

const draftField = listingFieldsSchema.keyof();
const fieldDetails = z.array(z.object({ field: z.string() }));
const conflictDetails = z.array(z.object({ mediaId: z.string() }));

/** The listing's fields a 400 names; the rest (`mediaIds`, the key) the seller cannot fix. */
export const refusedFieldsOf = (details: unknown) =>
  (fieldDetails.safeParse(details).data ?? []).flatMap(
    ({ field }) => draftField.safeParse(field).data ?? [],
  );

/** The media a 409 names (`{ mediaId, reason }` entries); none for a wrong listing status. */
export const refusedMediaOf = (details: unknown) =>
  (conflictDetails.safeParse(details).data ?? []).map(({ mediaId }) => mediaId);

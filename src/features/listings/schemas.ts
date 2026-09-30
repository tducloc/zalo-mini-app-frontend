/**
 * The create-listing form's rules, the same as `POST /products` (api-spec.md;
 * backend/src/products/create/create-listing.dto.ts). Takes the draft's fields as typed
 * (DraftFields) and gives what the API takes: trimmed text and a whole-đồng price.
 */

import { z } from 'zod';

import {
  TITLE_MIN_LENGTH,
  TITLE_MAX_LENGTH,
  DESCRIPTION_MIN_LENGTH,
  DESCRIPTION_MAX_LENGTH,
} from '@/features/listings/constants/listing-fields';
import { listingFormMessages } from '@/features/listings/constants/messages';
import type { DraftFields } from '@/features/listings/types/listing-draft';
import { MAX_PRICE_VND } from '@/features/products/constants/product';
import { productConditions } from '@/features/products/constants/product';

/**
 * The field keeps only digits, grouped on screen as they are typed, so "1.5" shows as "15"
 * before it is posted.
 */
const PRICE_DIGITS = /^\d+$/;

const text = (min: number, max: number, message: string) =>
  z.string().trim().min(min, message).max(max, message);

const price = z.string().regex(PRICE_DIGITS, listingFormMessages.price).transform(Number).pipe(
  z
    .number()
    // The regex lets only digits through, so a failed int is a number too big to be exact.
    .int(listingFormMessages.priceTooHigh)
    .min(1, listingFormMessages.price)
    .max(MAX_PRICE_VND, listingFormMessages.priceTooHigh),
);

export const listingFieldsSchema = z.object({
  title: text(TITLE_MIN_LENGTH, TITLE_MAX_LENGTH, listingFormMessages.title),
  description: text(
    DESCRIPTION_MIN_LENGTH,
    DESCRIPTION_MAX_LENGTH,
    listingFormMessages.description,
  ),
  price,
  categoryId: z.string().min(1, listingFormMessages.categoryId),
  // '' until the seller picks one, as the draft stores it.
  condition: z
    .union([z.literal(''), z.enum(productConditions)])
    .pipe(z.enum(productConditions, { error: listingFormMessages.condition })),
  locationId: z.string().min(1, listingFormMessages.locationId),
  // The form's values are the draft's fields: this stops compiling if the two drift apart.
}) satisfies z.ZodType<unknown, DraftFields>;

/** What the form gives when valid: the fields of `POST /products` without the media. */
export type ListingFieldValues = z.output<typeof listingFieldsSchema>;

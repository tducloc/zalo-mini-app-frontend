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
 * Whole đồng, grouped in threes by one kind of separator as a seller types it
 * ("6.990.000", "6,990,000", "6 990 000"), or not at all. "1.5" or "25,5" are refused, not
 * read as 15 đ or 255 đ, and so is "1.000,000".
 */
const PRICE_FORMAT = /^\d{1,3}([.,\s])\d{3}(\1\d{3})*$|^\d+$/;
const PRICE_SEPARATORS = /[\s.,]/g;

const text = (min: number, max: number, message: string) =>
  z.string().trim().min(min, message).max(max, message);

const price = z
  .string()
  .trim()
  .regex(PRICE_FORMAT, listingFormMessages.price)
  .transform((typed) => Number(typed.replace(PRICE_SEPARATORS, '')))
  .pipe(
    z
      .number()
      .int()
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

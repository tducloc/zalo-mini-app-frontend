/**
 * The create-listing form's rules, the same as `POST /products` (api-spec.md;
 * backend/src/products/create/create-listing.dto.ts). Takes the draft's fields as typed
 * (DraftFields) and gives what the API takes: trimmed text and a whole-đồng price.
 */

import { z } from 'zod';

import type { DraftFields } from '@/features/listings/draft/listing-draft';
import { productConditions } from '@/features/products/constants';

export const TITLE_MIN_LENGTH = 3;
export const TITLE_MAX_LENGTH = 120;
export const DESCRIPTION_MIN_LENGTH = 10;
export const DESCRIPTION_MAX_LENGTH = 5000;
/** The server keeps prices in a 32-bit integer column. */
export const PRICE_MAX = 2_147_483_647;

export const listingFormMessages = {
  title: `Vui lòng nhập tiêu đề từ ${TITLE_MIN_LENGTH} đến ${TITLE_MAX_LENGTH} ký tự.`,
  description: `Vui lòng nhập mô tả từ ${DESCRIPTION_MIN_LENGTH} đến 5.000 ký tự.`,
  price: 'Vui lòng nhập giá bán là số lớn hơn 0.',
  priceTooHigh: 'Vui lòng nhập giá bán không quá 2.147.483.647 đ.',
  categoryId: 'Vui lòng chọn danh mục.',
  condition: 'Vui lòng chọn tình trạng.',
  locationId: 'Vui lòng chọn địa điểm.',
};

/** Separators a seller may type in a price: "6.990.000", "6,990,000", "6 990 000". */
const PRICE_SEPARATORS = /[\s.,]/g;

const text = (min: number, max: number, message: string) =>
  z.string().trim().min(min, message).max(max, message);

const price = z
  .string()
  .transform((typed) => typed.replace(PRICE_SEPARATORS, ''))
  .pipe(z.string().regex(/^\d+$/, listingFormMessages.price))
  .transform(Number)
  .pipe(
    z
      .number()
      .int()
      .min(1, listingFormMessages.price)
      .max(PRICE_MAX, listingFormMessages.priceTooHigh),
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
export type ListingFields = z.output<typeof listingFieldsSchema>;

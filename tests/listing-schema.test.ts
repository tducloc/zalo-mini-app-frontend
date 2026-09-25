import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';

import {
  listingFieldsSchema,
  listingFormMessages as messages,
  PRICE_MAX,
} from '@/features/listings/components/schemas';
import { type DraftFields, EMPTY_FIELDS } from '@/features/listings/draft/listing-draft';

const filled: DraftFields = {
  title: '  iPhone 13 128GB  ',
  description: 'Máy dùng tốt, pin 90%, đủ hộp.',
  price: '6990000',
  categoryId: 'cat_electronics',
  condition: 'LIKE_NEW',
  locationId: 'loc_hanoi',
};

/** The message the schema gives for `field`, or undefined when it passes. */
function errorFor(fields: Partial<DraftFields>, field: keyof DraftFields) {
  const result = listingFieldsSchema.safeParse({ ...filled, ...fields });
  return result.success
    ? undefined
    : result.error.issues.find((issue) => issue.path[0] === field)?.message;
}

describe('listingFieldsSchema', () => {
  it('takes the draft as typed and gives the API its fields', () => {
    expectTypeOf<z.input<typeof listingFieldsSchema>>().toEqualTypeOf<DraftFields>();

    expect(listingFieldsSchema.parse(filled)).toEqual({
      title: 'iPhone 13 128GB',
      description: 'Máy dùng tốt, pin 90%, đủ hộp.',
      price: 6_990_000,
      categoryId: 'cat_electronics',
      condition: 'LIKE_NEW',
      locationId: 'loc_hanoi',
    });
  });

  it('asks for every field of an empty draft, each with its own message', () => {
    const result = listingFieldsSchema.safeParse(EMPTY_FIELDS);
    expect(result.success).toBe(false);
    const byField = Object.fromEntries(
      result.error!.issues.map((issue) => [issue.path[0], issue.message]),
    );
    expect(byField).toEqual({
      title: messages.title,
      description: messages.description,
      price: messages.price,
      categoryId: messages.categoryId,
      condition: messages.condition,
      locationId: messages.locationId,
    });
  });

  it('counts the title and description after trimming', () => {
    expect(errorFor({ title: '  ab  ' }, 'title')).toBe(messages.title);
    expect(errorFor({ title: 'abc' }, 'title')).toBeUndefined();
    expect(errorFor({ title: 'a'.repeat(121) }, 'title')).toBe(messages.title);
    expect(errorFor({ description: 'short' }, 'description')).toBe(messages.description);
    expect(errorFor({ description: 'x'.repeat(5001) }, 'description')).toBe(messages.description);
  });

  it('reads a price typed with separators, and refuses one that is not a whole number above 0', () => {
    for (const typed of ['6.990.000', '6,990,000', '6 990 000']) {
      expect(listingFieldsSchema.parse({ ...filled, price: typed }).price).toBe(6_990_000);
    }
    for (const typed of ['0', '-5', '12k', '1.5e6', '']) {
      expect(errorFor({ price: typed }, 'price')).toBe(messages.price);
    }
    expect(errorFor({ price: String(PRICE_MAX) }, 'price')).toBeUndefined();
    expect(errorFor({ price: String(PRICE_MAX + 1) }, 'price')).toBe(messages.priceTooHigh);
  });
});

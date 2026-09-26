/** The create-listing form's field limits (the same as `POST /products`) and empty values. */

import type { DraftFields } from '@/features/listings/types/listing-draft';

export const TITLE_MIN_LENGTH = 3;
export const TITLE_MAX_LENGTH = 120;
export const DESCRIPTION_MIN_LENGTH = 10;
export const DESCRIPTION_MAX_LENGTH = 5000;

export const EMPTY_FIELDS: DraftFields = {
  title: '',
  description: '',
  price: '',
  categoryId: '',
  condition: '',
  locationId: '',
};

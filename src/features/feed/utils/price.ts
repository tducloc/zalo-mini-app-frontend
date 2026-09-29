import { MAX_PRICE_VND } from '@/features/products/constants/product';

/** Applied filter value → the digits shown in the input. */
export function priceToInputDigits(value?: number) {
  return value === undefined ? '' : String(value);
}

interface PriceRangeResult {
  minPrice?: number;
  maxPrice?: number;
  errors: { minPrice?: string; maxPrice?: string };
}

/** Empty means no bound; otherwise a whole VND amount within the backend range. */
export function parsePriceRange(minDigits: string, maxDigits: string): PriceRangeResult {
  const minPrice = minDigits ? Number(minDigits) : undefined;
  const maxPrice = maxDigits ? Number(maxDigits) : undefined;
  const tooLargeMessage = 'Vui lòng kiểm tra lại giá: số tiền quá lớn.';
  const errors: PriceRangeResult['errors'] = {};

  if (minPrice !== undefined && minPrice > MAX_PRICE_VND) {
    errors.minPrice = tooLargeMessage;
  }

  if (maxPrice !== undefined && maxPrice > MAX_PRICE_VND) {
    errors.maxPrice = tooLargeMessage;
  }

  if (!errors.maxPrice && minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    errors.maxPrice = 'Giá đến phải lớn hơn hoặc bằng giá từ.';
  }

  return { minPrice, maxPrice, errors };
}

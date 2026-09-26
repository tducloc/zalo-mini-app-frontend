import { MAX_PRICE_VND } from '@/features/products/constants/product';
import { formatNumber } from '@/utils/format';

// Longer than any valid price so an oversized paste shows the "too large"
// error instead of being silently cut down to a valid-looking number.
const MAX_INPUT_DIGITS = String(MAX_PRICE_VND).length + 1;

const NON_DIGIT = /\D/g;

interface PriceEdit {
  /** Digits to store ("1000000"). */
  digits: string;
  /** How many digits sit before the caret, so it can be restored after reformatting. */
  digitsBeforeCaret: number;
}

/**
 * Applies one edit of the formatted input ("1.000.000") and keeps the caret on
 * the same digit. Deleting just a thousands separator changes no digit, so the
 * digit next to it is deleted instead — otherwise backspace would be a no-op.
 */
export function applyPriceEdit({
  value,
  caret,
  previousDigits,
  inputType,
}: {
  value: string;
  caret: number;
  previousDigits: string;
  inputType?: string;
}): PriceEdit {
  let digits = value.replace(NON_DIGIT, '');
  let digitsBeforeCaret = value.slice(0, caret).replace(NON_DIGIT, '').length;

  if (digits === previousDigits && inputType?.startsWith('delete')) {
    const index = inputType === 'deleteContentForward' ? digitsBeforeCaret : digitsBeforeCaret - 1;
    if (index >= 0 && index < digits.length) {
      digits = digits.slice(0, index) + digits.slice(index + 1);
      digitsBeforeCaret = index;
    }
  }

  const leadingZeros = digits.match(/^0+(?=\d)/)?.[0].length ?? 0;
  digits = digits.slice(leadingZeros, leadingZeros + MAX_INPUT_DIGITS);
  digitsBeforeCaret = Math.min(Math.max(digitsBeforeCaret - leadingZeros, 0), digits.length);

  return { digits, digitsBeforeCaret };
}

/** Caret index in `formatted` that sits right after the n-th digit. */
export function caretAfterDigits(formatted: string, digitCount: number) {
  if (digitCount <= 0) {
    return 0;
  }

  let seen = 0;
  for (let index = 0; index < formatted.length; index += 1) {
    if (/\d/.test(formatted[index])) {
      seen += 1;
    }

    if (seen === digitCount) {
      return index + 1;
    }
  }

  return formatted.length;
}

/** Applied filter value → the digits shown in the input. */
export function priceToInputDigits(value?: number) {
  return value === undefined ? '' : String(value);
}

export function formatPriceDigits(digits: string) {
  return digits ? formatNumber(Number(digits)) : '';
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

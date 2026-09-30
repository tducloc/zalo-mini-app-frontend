import { MAX_PRICE_VND } from '@/features/products/constants/product';

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

/** "1000000" → "1.000.000", on the text: a number past 2^53 would come back rounded. */
export function formatPriceDigits(digits: string) {
  return digits.replace(/\B(?=(\d{3})+$)/g, '.');
}

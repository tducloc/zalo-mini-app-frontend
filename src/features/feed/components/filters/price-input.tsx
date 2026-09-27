import { ChangeEvent, useLayoutEffect, useRef } from 'react';

import { filterControlClass } from '@/features/feed/constants/styles';
import { MAX_PRICE_VND } from '@/features/products/constants/product';
import { formatNumber } from '@/utils/format';

interface PriceInputProps {
  id: string;
  label: string;
  placeholder: string;
  digits: string;
  error: string | undefined;
  onChange: (digits: string) => void;
}

export default function PriceInput({
  id,
  label,
  placeholder,
  digits,
  error,
  onChange,
}: PriceInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  // digits-before-caret to restore once the reformatted value renders
  const pendingCaretRef = useRef<number | null>(null);

  const errorId = `${id}-error`;
  const formatted = formatPriceDigits(digits);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (pendingCaretRef.current === null || !input || document.activeElement !== input) {
      return;
    }

    const caret = caretAfterDigits(formatted, pendingCaretRef.current);
    input.setSelectionRange(caret, caret);
    pendingCaretRef.current = null;
  }, [formatted]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { value, selectionStart } = event.target;
    const inputType =
      event.nativeEvent instanceof InputEvent ? event.nativeEvent.inputType : undefined;
    const edit = applyPriceEdit({
      value,
      caret: selectionStart ?? value.length,
      previousDigits: digits,
      inputType,
    });

    pendingCaretRef.current = edit.digitsBeforeCaret;
    onChange(edit.digits);
  };

  return (
    <div className="min-w-0 flex-1">
      <input
        ref={inputRef}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={Boolean(error)}
        aria-label={label}
        className={`${filterControlClass} aria-[invalid=true]:border-marketplace-danger`}
        id={id}
        inputMode="numeric"
        placeholder={placeholder}
        value={formatted}
        onChange={handleChange}
      />
      {error && (
        <small className="my-1.5 block text-xs leading-5 text-marketplace-danger" id={errorId}>
          {error}
        </small>
      )}
    </div>
  );
}

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

export function formatPriceDigits(digits: string) {
  return digits ? formatNumber(Number(digits)) : '';
}

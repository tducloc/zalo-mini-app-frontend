import { type ChangeEvent, useLayoutEffect, useRef } from 'react';

import { applyPriceEdit, caretAfterDigits, formatPriceDigits } from '@/utils/price-input';

/**
 * A price input that groups thousands as the seller types ("1.000.000") and keeps the
 * caret on the same digit. Takes and gives the bare digits ("1000000").
 */
export function usePriceInput(digits: string, onChange: (digits: string) => void) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  // digits-before-caret to restore once the reformatted value renders
  const pendingCaretRef = useRef<number | null>(null);

  const value = formatPriceDigits(digits);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (pendingCaretRef.current === null || !input || document.activeElement !== input) {
      return;
    }

    const caret = caretAfterDigits(value, pendingCaretRef.current);
    input.setSelectionRange(caret, caret);
    pendingCaretRef.current = null;
  }, [value]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { value: typed, selectionStart } = event.target;
    const inputType =
      event.nativeEvent instanceof InputEvent ? event.nativeEvent.inputType : undefined;
    const edit = applyPriceEdit({
      value: typed,
      caret: selectionStart ?? typed.length,
      previousDigits: digits,
      inputType,
    });

    pendingCaretRef.current = edit.digitsBeforeCaret;
    onChange(edit.digits);
  };

  return { inputRef, value, onChange: handleChange };
}

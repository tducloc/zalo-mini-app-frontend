import { ChangeEvent, useLayoutEffect, useRef } from 'react';

import { filterControlClass } from '@/features/feed/constants/styles';
import { applyPriceEdit, caretAfterDigits, formatPriceDigits } from '@/features/feed/utils/price';

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
        <small className="field-error block" id={errorId}>
          {error}
        </small>
      )}
    </div>
  );
}

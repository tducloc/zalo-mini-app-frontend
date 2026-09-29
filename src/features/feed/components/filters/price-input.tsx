import { filterControlClass } from '@/features/feed/constants/styles';
import { usePriceInput } from '@/hooks/use-price-input';

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
  const price = usePriceInput(digits, onChange);

  const errorId = `${id}-error`;

  return (
    <div className="min-w-0 flex-1">
      <input
        ref={price.inputRef}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={Boolean(error)}
        aria-label={label}
        className={`${filterControlClass} aria-[invalid=true]:border-marketplace-danger`}
        id={id}
        inputMode="numeric"
        placeholder={placeholder}
        value={price.value}
        onChange={price.onChange}
      />
      {error && (
        <small className="my-1.5 block text-xs leading-5 text-marketplace-danger" id={errorId}>
          {error}
        </small>
      )}
    </div>
  );
}

import {
  filterLabelClass,
  filterSectionClass,
  surfaceClass,
} from '@/features/feed/constants/styles';
import { nextChoice } from '@/features/feed/utils/filters';

const choicePillClass = `min-h-9 rounded-[18px] px-3.5 text-sm text-marketplace-ink ${surfaceClass} aria-pressed:border-marketplace-blue aria-pressed:bg-marketplace-tint aria-pressed:font-semibold aria-pressed:text-marketplace-blue`;

interface ChoiceGroupProps<T extends string> {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T | undefined;
  isRequired?: boolean;
  onChange: (value: T | undefined) => void;
}

/** Single-choice pills; tapping the selected pill clears it unless required. */
export default function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  isRequired = false,
  onChange,
}: ChoiceGroupProps<T>) {
  return (
    <fieldset className={filterSectionClass}>
      <legend className={filterLabelClass}>{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            aria-pressed={option.value === value}
            className={choicePillClass}
            key={option.value}
            type="button"
            onClick={() => onChange(nextChoice(value, option.value, isRequired))}
          >
            <StableWeightLabel label={option.label} />
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * The selected pill turns semibold; an invisible semibold copy reserves that
 * width up front so selecting never widens the pill and reflows the row.
 */
function StableWeightLabel({ label }: { label: string }) {
  return (
    <span className="grid justify-items-center">
      <span aria-hidden className="invisible col-start-1 row-start-1 font-semibold">
        {label}
      </span>
      <span className="col-start-1 row-start-1">{label}</span>
    </span>
  );
}

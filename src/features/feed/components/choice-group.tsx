import { choicePillClass, filterLabelClass, filterSectionClass } from '../styles';
import { nextChoice } from '../utils/filters';

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
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

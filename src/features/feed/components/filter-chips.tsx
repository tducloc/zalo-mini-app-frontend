import { Icon } from 'zmp-ui';

import { chipClass, hiddenScrollbarClass } from '../styles';
import type { FilterChip, FilterKey } from '../types';

export default function FilterChips({
  chips,
  onRemove,
  onClearAll,
}: {
  chips: FilterChip[];
  onRemove: (key: FilterKey) => void;
  onClearAll: () => void;
}) {
  if (!chips.length) {
    return null;
  }

  return (
    <div
      className={`-mt-1 mb-3 flex gap-2 overflow-x-auto ${hiddenScrollbarClass}`}
      role="group"
      aria-label="Bộ lọc đang áp dụng"
    >
      {chips.map((chip) => (
        <button
          aria-label={`Bỏ lọc ${chip.label}`}
          className={`${chipClass} border-marketplace-tint-strong bg-marketplace-tint pl-3 pr-2.5 text-marketplace-blue`}
          key={chip.key}
          type="button"
          onClick={() => onRemove(chip.key)}
        >
          <span>{chip.label}</span>
          <Icon icon="zi-close" size={14} />
        </button>
      ))}
      {chips.length > 1 && (
        <button
          className={`${chipClass} border-transparent bg-transparent px-3 text-marketplace-muted`}
          type="button"
          onClick={onClearAll}
        >
          Xoá tất cả
        </button>
      )}
    </div>
  );
}

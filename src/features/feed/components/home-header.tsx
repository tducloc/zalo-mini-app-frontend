import { FormEvent, useRef } from 'react';
import { Icon } from 'zmp-ui';

import { SEARCH_MAX_LENGTH } from '../constants';
import { filterBadgeClass } from '../styles';

// The fixed header height and safe-area inset are CSS variables set on the
// Home page (`homePageClass`), so the content padding can follow them.
const headerClass =
  'fixed inset-x-0 top-0 z-30 h-[var(--home-header-height)] bg-marketplace-blue px-4 pb-3 pt-[var(--home-safe-top)] text-white';
// Leaves room on the right for Zalo's native capsule controls.
const titleClass =
  'm-0 mb-2 flex h-11 items-center pr-24 text-[22px] font-bold leading-7 tracking-[-0.3px]';
// The focus ring sits on the whole pill; the global input outline would be
// clipped inside it.
const searchFormClass =
  'flex h-11 min-w-0 flex-1 items-center gap-[9px] rounded-[10px] bg-white px-[13px] text-marketplace-muted focus-within:ring-2 focus-within:ring-white/70 focus-within:ring-offset-2 focus-within:ring-offset-marketplace-blue';
const searchInputClass =
  'min-w-0 flex-1 border-0 bg-transparent py-[11px] font-[inherit] text-marketplace-ink outline-none focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden';
const iconButtonClass =
  'relative grid size-[42px] flex-none place-items-center border-0 bg-transparent p-0 text-white';

interface HomeHeaderProps {
  searchValue: string;
  activeFilterCount: number;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  onSearchClear: () => void;
  onOpenFilters: () => void;
}

export default function HomeHeader({
  searchValue,
  activeFilterCount,
  onSearchChange,
  onSearchSubmit,
  onSearchClear,
  onOpenFilters,
}: HomeHeaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSearchSubmit();
    // Dismiss the on-screen keyboard so results are visible.
    inputRef.current?.blur();
  };

  const handleClear = () => {
    onSearchClear();
    inputRef.current?.focus();
  };

  const filterLabel = activeFilterCount
    ? `Mở bộ lọc, đang áp dụng ${activeFilterCount} bộ lọc`
    : 'Mở bộ lọc';

  return (
    <header className={headerClass}>
      <h1 className={titleClass}>Chợ Zalo</h1>
      <div className="flex items-center gap-2">
        <form className={searchFormClass} role="search" onSubmit={handleSubmit}>
          <Icon icon="zi-search" />
          <input
            ref={inputRef}
            aria-label="Tìm kiếm tin đăng"
            className={searchInputClass}
            enterKeyHint="search"
            maxLength={SEARCH_MAX_LENGTH}
            placeholder="Tìm kiếm"
            type="search"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
          />
          {searchValue && (
            <button
              aria-label="Xoá từ khoá"
              className="-mr-2 grid size-8 place-items-center border-0 bg-transparent p-0 text-marketplace-subtle"
              type="button"
              onClick={handleClear}
            >
              <Icon icon="zi-close-circle-solid" size={18} />
            </button>
          )}
        </form>
        <button
          aria-label={filterLabel}
          className={iconButtonClass}
          type="button"
          onClick={onOpenFilters}
        >
          <Icon icon="zi-filter" size={24} />
          {activeFilterCount > 0 && (
            <span className={filterBadgeClass} aria-hidden="true">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}

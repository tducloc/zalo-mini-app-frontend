import { useState } from 'react';
import { Button } from 'zmp-ui';

import AppSheet from '@/components/app-sheet';
import InlineRetry from '@/components/inline-retry';
import type { CategoryOption } from '@/features/categories/types/category';
import ChoiceGroup from '@/features/feed/components/choice-group';
import PriceInput from '@/features/feed/components/price-input';
import {
  HAS_VIDEO_LABEL,
  SORT_OPTIONS,
  sortOptionConfig,
  DEFAULT_FILTERS,
} from '@/features/feed/constants/filters';
import {
  filterControlClass,
  filterLabelClass,
  filterSectionClass,
  filterSectionSpacingClass,
} from '@/features/feed/constants/styles';
import type { FeedFilters } from '@/features/feed/types/filters';
import { parsePriceRange, priceToInputDigits } from '@/features/feed/utils/price';
import type { LocationResponse } from '@/features/locations/types/location';
import { conditionLabels, productConditions } from '@/features/products/constants/product';

const conditionChoices = productConditions.map((condition) => ({
  value: condition,
  label: conditionLabels[condition],
}));
const mediaChoices = [{ value: 'video' as const, label: HAS_VIDEO_LABEL }];
const sortChoices = SORT_OPTIONS.map((sort) => ({
  value: sort,
  label: sortOptionConfig[sort].label,
}));

/** A lookup list the sheet needs, with its own load/error state. */
interface SheetOptions<T> {
  data: T[] | undefined;
  isError: boolean;
  onRetry: () => void;
}

interface FilterSheetProps {
  visible: boolean;
  filters: FeedFilters;
  categories: SheetOptions<CategoryOption>;
  locations: SheetOptions<LocationResponse>;
  onApply: (filters: FeedFilters) => void;
  onReset: () => void;
  onClose: () => void;
}

export default function FilterSheet({ visible, onClose, ...formProps }: FilterSheetProps) {
  // AppSheet remounts the form per opening, so the draft starts from `filters`.
  return (
    <AppSheet visible={visible} title="Lọc tin đăng" autoHeight onClose={onClose}>
      <FilterForm {...formProps} />
    </AppSheet>
  );
}

function FilterForm({
  filters,
  categories,
  locations,
  onApply,
  onReset,
}: Omit<FilterSheetProps, 'visible' | 'onClose'>) {
  const [draft, setDraft] = useState(filters);

  // price inputs keep digits only; display adds thousand separators
  const [minDigits, setMinDigits] = useState(priceToInputDigits(filters.minPrice));
  const [maxDigits, setMaxDigits] = useState(priceToInputDigits(filters.maxPrice));
  const [hasTriedApply, setHasTriedApply] = useState(false);

  const priceRange = parsePriceRange(minDigits, maxDigits);
  const hasPriceErrors = Boolean(priceRange.errors.minPrice || priceRange.errors.maxPrice);
  const shouldShowPriceErrors = hasTriedApply && hasPriceErrors;

  const updateDraft = (patch: Partial<FeedFilters>) =>
    setDraft((current) => ({ ...current, ...patch }));

  const handleApply = () => {
    setHasTriedApply(true);

    if (hasPriceErrors) {
      return;
    }

    onApply({ ...draft, minPrice: priceRange.minPrice, maxPrice: priceRange.maxPrice });
  };

  return (
    <div className="px-4 pb-4 pt-1">
      <div>
        <label className={filterLabelClass} htmlFor="filter-location">
          Khu vực
        </label>
        {locations.isError && !locations.data ? (
          <InlineRetry message="Không tải được khu vực." onRetry={locations.onRetry} />
        ) : (
          <select
            className={filterControlClass}
            disabled={!locations.data}
            id="filter-location"
            value={draft.locationId ?? ''}
            onChange={(event) => updateDraft({ locationId: event.target.value || undefined })}
          >
            <option value="">{locations.data ? 'Toàn quốc' : 'Đang tải khu vực…'}</option>
            {locations.data?.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {categories.isError && !categories.data ? (
        <InlineRetry
          className={filterSectionSpacingClass}
          message="Không tải được danh mục."
          onRetry={categories.onRetry}
        />
      ) : (
        <ChoiceGroup
          label="Danh mục"
          options={(categories.data ?? []).map(({ id, label }) => ({ value: id, label }))}
          value={draft.categoryId}
          onChange={(categoryId) => updateDraft({ categoryId })}
        />
      )}

      <ChoiceGroup
        label="Tình trạng"
        options={conditionChoices}
        value={draft.condition}
        onChange={(condition) => updateDraft({ condition })}
      />

      <ChoiceGroup
        label="Loại tin"
        options={mediaChoices}
        value={draft.hasVideo ? 'video' : undefined}
        onChange={(choice) => updateDraft({ hasVideo: choice === 'video' || undefined })}
      />

      <fieldset className={filterSectionClass}>
        <legend className={filterLabelClass}>Khoảng giá (đ)</legend>
        <div className="flex gap-2">
          <PriceInput
            digits={minDigits}
            error={shouldShowPriceErrors ? priceRange.errors.minPrice : undefined}
            id="filter-min-price"
            label="Giá từ"
            placeholder="Từ"
            onChange={setMinDigits}
          />
          <PriceInput
            digits={maxDigits}
            error={shouldShowPriceErrors ? priceRange.errors.maxPrice : undefined}
            id="filter-max-price"
            label="Giá đến"
            placeholder="Đến"
            onChange={setMaxDigits}
          />
        </div>
      </fieldset>

      <ChoiceGroup
        isRequired
        label="Sắp xếp"
        options={sortChoices}
        value={draft.sort}
        onChange={(sort) => updateDraft({ sort: sort ?? DEFAULT_FILTERS.sort })}
      />

      <div className="mt-6 flex gap-3">
        <Button fullWidth variant="tertiary" onClick={onReset}>
          Xoá lọc
        </Button>
        <Button fullWidth disabled={shouldShowPriceErrors} onClick={handleApply}>
          Áp dụng
        </Button>
      </div>
    </div>
  );
}

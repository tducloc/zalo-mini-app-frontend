import type { ReactNode } from 'react';
import {
  Controller,
  type ControllerFieldState,
  type ControllerRenderProps,
  type UseFormReturn,
} from 'react-hook-form';

import InlineRetry from '@/components/feedback/inline-retry';
import { useCategories } from '@/features/categories/api/get-categories';
import RequiredMark from '@/features/listings/components/form/required-mark';
import {
  TITLE_MIN_LENGTH,
  TITLE_MAX_LENGTH,
  DESCRIPTION_MIN_LENGTH,
  DESCRIPTION_MAX_LENGTH,
} from '@/features/listings/constants/listing-fields';
import { formSectionTitleClass } from '@/features/listings/constants/styles';
import type { ListingFieldValues } from '@/features/listings/schemas';
import type { DraftFields } from '@/features/listings/types/listing-draft';
import { useLocations } from '@/features/locations/api/get-locations';
import { conditionLabels, productConditions } from '@/features/products/constants/product';
import { usePriceInput } from '@/hooks/use-price-input';
import type { ListQuery } from '@/lib/list-query';
import { formatNumber } from '@/utils/format';
import { formatPriceDigits } from '@/utils/price-input';

interface Option {
  id: string;
  label: string;
}

const controlClass =
  'mt-2 block w-full rounded-[10px] border border-solid border-marketplace-field-line bg-white p-3 text-base font-normal text-marketplace-ink aria-[invalid=true]:border-marketplace-danger';
const conditionChipClass =
  'block rounded-[22px] border border-solid px-3.5 py-2.5 peer-checked:border-marketplace-blue peer-checked:bg-marketplace-highlight peer-checked:text-marketplace-blue peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-marketplace-blue';

/**
 * The listing's fields on the form's React Hook Form state: the form restores them from
 * the draft and writes every change back. Category and location are the API's IDs, as
 * `POST /products` takes them.
 */
export default function ListingFields({
  form,
}: {
  form: UseFormReturn<DraftFields, unknown, ListingFieldValues>;
}) {
  const categories = useCategories();
  const locations = useLocations();

  const {
    register,
    control,
    formState: { errors },
  } = form;

  const categoryOptions: Option[] = categories.data ?? [];
  const locationOptions: Option[] = (locations.data ?? []).map(({ id, name }) => ({
    id,
    label: name,
  }));

  return (
    <section className="mb-6">
      <h2 className={formSectionTitleClass}>Thông tin tin đăng</h2>

      <Controller
        control={control}
        name="categoryId"
        render={({ field, fieldState }) => (
          <SelectField
            id="listing-category"
            label="Danh mục"
            placeholder="Chọn danh mục"
            options={categoryOptions}
            query={categories}
            field={field}
            fieldState={fieldState}
          />
        )}
      />

      <FieldShell
        id="listing-title"
        label="Tiêu đề"
        error={errors.title?.message}
        hint={`Từ ${TITLE_MIN_LENGTH} đến ${TITLE_MAX_LENGTH} ký tự`}
      >
        <input
          id="listing-title"
          className={controlClass}
          {...register('title')}
          maxLength={TITLE_MAX_LENGTH}
          placeholder="Ví dụ: iPhone 13 128GB còn đẹp"
          aria-invalid={!!errors.title}
          aria-describedby="listing-title-note"
        />
      </FieldShell>

      <FieldShell
        id="listing-description"
        label="Mô tả"
        error={errors.description?.message}
        hint={`Từ ${DESCRIPTION_MIN_LENGTH} đến ${formatNumber(DESCRIPTION_MAX_LENGTH)} ký tự`}
      >
        <textarea
          id="listing-description"
          className={controlClass}
          {...register('description')}
          rows={4}
          maxLength={DESCRIPTION_MAX_LENGTH}
          placeholder="Tình trạng, phụ kiện đi kèm, lý do bán…"
          aria-invalid={!!errors.description}
          aria-describedby="listing-description-note"
        />
      </FieldShell>

      <Controller
        control={control}
        name="price"
        render={({ field, fieldState }) => (
          <FieldShell id="listing-price" label="Giá bán (VNĐ)" error={fieldState.error?.message}>
            <PriceControl field={field} isInvalid={!!fieldState.error} />
          </FieldShell>
        )}
      />

      <fieldset className="my-5 border-0 p-0" aria-describedby="listing-condition-note">
        <legend className="mb-2.5 font-semibold">
          Tình trạng <RequiredMark />
        </legend>
        {productConditions.map((condition) => (
          <label key={condition} className="relative mb-2 me-1.5 inline-block">
            <input
              type="radio"
              value={condition}
              aria-invalid={!!errors.condition}
              className="peer absolute opacity-0"
              {...register('condition')}
            />
            <span
              className={`${conditionChipClass} ${errors.condition ? 'border-marketplace-danger' : 'border-marketplace-field-line'}`}
            >
              {conditionLabels[condition]}
            </span>
          </label>
        ))}
        <FieldNote id="listing-condition-note" className="mt-2" error={errors.condition?.message} />
      </fieldset>

      <Controller
        control={control}
        name="locationId"
        render={({ field, fieldState }) => (
          <SelectField
            id="listing-location"
            label="Địa điểm"
            placeholder="Chọn tỉnh, thành phố"
            options={locationOptions}
            query={locations}
            field={field}
            fieldState={fieldState}
          />
        )}
      />
    </section>
  );
}

/**
 * A required field: its label, the control, and one line under it that the control
 * points at (`${id}-note`). The line is outside the label, so it is not read as the name.
 */
function FieldShell({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="my-[18px] font-semibold">
      <label htmlFor={id}>
        {label} <RequiredMark />
      </label>
      {children}
      <FieldNote id={`${id}-note`} className="mt-[5px] font-normal" error={error} hint={hint} />
    </div>
  );
}

/** A field's error, else its hint; `className` places it. */
function FieldNote({
  id,
  className,
  error,
  hint,
}: {
  id: string;
  className: string;
  error?: string;
  hint?: string;
}) {
  if (!error && !hint) {
    return null;
  }

  const toneClass = error ? 'mb-1.5 text-marketplace-danger' : 'mb-2 text-marketplace-muted';
  return (
    <small id={id} className={`block text-xs leading-normal ${toneClass} ${className}`}>
      {error ?? hint}
    </small>
  );
}

/**
 * The price, grouped as the seller types it ("6.990.000"), like the filter's. The form
 * keeps it grouped, as the edit form starts it, so retyping the saved price is no change.
 */
function PriceControl({
  field,
  isInvalid,
}: {
  field: ControllerRenderProps<DraftFields, 'price'>;
  isInvalid: boolean;
}) {
  const price = usePriceInput(field.value.replace(/\D/g, ''), (digits) =>
    field.onChange(formatPriceDigits(digits)),
  );

  return (
    <input
      ref={(element) => {
        price.inputRef.current = element;
        field.ref(element);
      }}
      id="listing-price"
      className={controlClass}
      name={field.name}
      value={price.value}
      onChange={price.onChange}
      onBlur={field.onBlur}
      // Text, not number: a number input cannot show the grouping dots.
      inputMode="numeric"
      autoComplete="off"
      placeholder="Ví dụ: 150.000"
      aria-invalid={isInvalid}
      aria-describedby="listing-price-note"
    />
  );
}

interface SelectFieldProps {
  id: string;
  label: string;
  placeholder: string;
  options: Option[];
  query: ListQuery<unknown>;
  field: ControllerRenderProps<DraftFields, 'categoryId' | 'locationId'>;
  fieldState: ControllerFieldState;
}

/** A required choice from a list the API gives, with its loading and failed states. */
function SelectField({
  id,
  label,
  placeholder,
  options,
  query,
  field,
  fieldState,
}: SelectFieldProps) {
  return (
    <FieldShell id={id} label={label} error={fieldState.error?.message}>
      <select
        ref={field.ref}
        id={id}
        className={controlClass}
        name={field.name}
        value={field.value}
        onChange={(event) => field.onChange(event.target.value)}
        onBlur={field.onBlur}
        aria-invalid={!!fieldState.error}
        aria-describedby={`${id}-note`}
      >
        <option value="">{query.isPending ? 'Đang tải…' : placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      {query.isError && (
        <InlineRetry message="Chưa tải được danh sách." onRetry={() => query.refetch()} />
      )}
    </FieldShell>
  );
}

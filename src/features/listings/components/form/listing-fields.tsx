import type { ReactNode } from 'react';
import {
  Controller,
  type ControllerFieldState,
  type ControllerRenderProps,
  type UseFormReturn,
} from 'react-hook-form';

import { useCategories } from '@/features/categories/api/get-categories';
import {
  TITLE_MIN_LENGTH,
  TITLE_MAX_LENGTH,
  DESCRIPTION_MIN_LENGTH,
  DESCRIPTION_MAX_LENGTH,
} from '@/features/listings/constants/listing-fields';
import type { ListingFieldValues } from '@/features/listings/schemas';
import type { DraftFields } from '@/features/listings/types/listing-draft';
import { useLocations } from '@/features/locations/api/get-locations';
import { conditionLabels, productConditions } from '@/features/products/constants/product';
import { formatNumber } from '@/utils/format';

interface Option {
  id: string;
  label: string;
}

/** The part of a react-query result a select needs. */
interface OptionsQuery {
  isPending: boolean;
  isError: boolean;
  refetch: () => unknown;
}

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
    <section className="form-section">
      <h2>Thông tin tin đăng</h2>

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
          {...register('description')}
          rows={4}
          maxLength={DESCRIPTION_MAX_LENGTH}
          placeholder="Tình trạng, phụ kiện đi kèm, lý do bán…"
          aria-invalid={!!errors.description}
          aria-describedby="listing-description-note"
        />
      </FieldShell>

      <FieldShell id="listing-price" label="Giá bán (VNĐ)" error={errors.price?.message}>
        <input
          id="listing-price"
          {...register('price')}
          // Text, not number: a number input drops the "6.990.000" a seller types.
          inputMode="numeric"
          autoComplete="off"
          placeholder="Ví dụ: 150.000"
          aria-invalid={!!errors.price}
          aria-describedby="listing-price-note"
        />
      </FieldShell>

      <fieldset
        className={`condition-field ${errors.condition ? 'invalid' : ''}`}
        aria-describedby="listing-condition-note"
      >
        <legend>
          Tình trạng <em>*</em>
        </legend>
        {productConditions.map((condition) => (
          <label key={condition}>
            <input
              type="radio"
              value={condition}
              aria-invalid={!!errors.condition}
              {...register('condition')}
            />
            <span>{conditionLabels[condition]}</span>
          </label>
        ))}
        <FieldNote id="listing-condition-note" error={errors.condition?.message} />
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
    <div className="ui-field">
      <label htmlFor={id}>
        {label} <em>*</em>
      </label>
      {children}
      <FieldNote id={`${id}-note`} error={error} hint={hint} />
    </div>
  );
}

/** A field's error, else its hint. */
function FieldNote({ id, error, hint }: { id: string; error?: string; hint?: string }) {
  if (!error && !hint) {
    return null;
  }

  return (
    <small id={id} className={error ? 'field-error' : 'ui-muted'}>
      {error ?? hint}
    </small>
  );
}

interface SelectFieldProps {
  id: string;
  label: string;
  placeholder: string;
  options: Option[];
  query: OptionsQuery;
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
      {query.isError && <LoadFailed onRetry={query.refetch} />}
    </FieldShell>
  );
}

/** The list did not load; the seller asks again. */
function LoadFailed({ onRetry }: { onRetry: () => unknown }) {
  const handleRetry = () => void onRetry();

  return (
    <p className="field-error" role="alert">
      Chưa tải được danh sách.{' '}
      <button
        type="button"
        className="border-0 bg-transparent p-0 font-semibold text-marketplace-blue underline"
        onClick={handleRetry}
      >
        Tải lại
      </button>
    </p>
  );
}

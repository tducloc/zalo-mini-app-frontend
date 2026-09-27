import { zodResolver } from '@hookform/resolvers/zod';
import { useRef } from 'react';
import { type FieldErrors, useForm } from 'react-hook-form';
import { useStore } from 'zustand';

import { listingFormMessages } from '@/features/listings/constants/messages';
import { type ListingFieldValues, listingFieldsSchema } from '@/features/listings/schemas';
import { type DraftFields, PostBlocker } from '@/features/listings/types/listing-draft';
import { postBlocker } from '@/features/listings/utils/listing-draft';
import type { ListingDraftStore } from '@/stores/listing-draft';

/** The fields top to bottom, to bring the first one with an error into view. */
const FIELDS_ON_SCREEN: (keyof DraftFields)[] = [
  'categoryId',
  'title',
  'description',
  'price',
  'condition',
  'locationId',
];

/**
 * What the sell form and the edit form share: the fields on React Hook Form with the
 * listing's schema, and the gate of the submit button on both the fields and the files.
 * A tap with something to fix scrolls to the first section that needs it, which says what.
 */
export function useListingForm(store: ListingDraftStore, defaultValues: DraftFields) {
  const media = useStore(store, (state) => state.media);
  const isPosting = useStore(store, (state) => state.isPosting);

  const mediaRef = useRef<HTMLDivElement>(null);
  const form = useForm<DraftFields, unknown, ListingFieldValues>({
    resolver: zodResolver(listingFieldsSchema),
    mode: 'onSubmit',
    // The media section comes first; showFirstProblem picks what to show.
    shouldFocusError: false,
    defaultValues,
  });

  const scrollToMedia = () =>
    mediaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  /** The server refused these fields (400): the form marks them. */
  const markRefusedFields = (fields: (keyof DraftFields)[]) => {
    fields.forEach((field, index) => {
      form.setError(field, { message: listingFormMessages[field] }, { shouldFocus: index === 0 });
    });
  };

  const blocker = postBlocker(media);
  const isWorking = blocker === PostBlocker.Working;
  const { isSubmitting, isSubmitted, isValid, errors } = form.formState;
  // A field the server refused passes the schema, so its error counts until it changes.
  const hasFieldErrors = !isValid || Object.keys(errors).length > 0;
  // Enabled until the first tap, so the seller finds out what is missing; then only once
  // it is all fixed. Never while files are still on their way: there is nothing to fix.
  const isSubmitDisabled =
    isSubmitting || isPosting || isWorking || (isSubmitted && (hasFieldErrors || blocker !== null));

  /** Scrolls to the photos when they block the submit, else focuses the first field in error. */
  const showFirstProblem = (fieldErrors: FieldErrors<DraftFields>) => {
    if (postBlocker(store.getState().media) !== null) {
      scrollToMedia();
      return;
    }

    const firstField = FIELDS_ON_SCREEN.find((field) => fieldErrors[field]);
    if (firstField) {
      form.setFocus(firstField);
    }
  };

  /** The submit handler: checks the fields and the files, then sends the checked values. */
  const submitWith = (send: (values: ListingFieldValues) => Promise<void>) =>
    form.handleSubmit(async (values) => {
      if (postBlocker(store.getState().media) !== null) {
        scrollToMedia();
        return;
      }
      await send(values);
    }, showFirstProblem);

  return {
    form,
    mediaRef,
    isPosting,
    isWorking,
    isSubmitDisabled,
    /** The submit was tapped without a photo. */
    isPhotoMissing: isSubmitted && blocker === PostBlocker.NoPhoto,
    scrollToMedia,
    markRefusedFields,
    submitWith,
  };
}

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef } from 'react';
import { type FieldErrors, useForm } from 'react-hook-form';

import DiscardDraftButton from '@/features/listings/components/discard-draft-button';
import ListingFields from '@/features/listings/components/listing-fields';
import MediaSection from '@/features/listings/components/media-section';
import { EMPTY_FIELDS } from '@/features/listings/constants/listing-fields';
import {
  discardMessages,
  listingFormMessages,
  postMessages,
} from '@/features/listings/constants/messages';
import { usePostListing } from '@/features/listings/hooks/use-post-listing';
import { type ListingFieldValues, listingFieldsSchema } from '@/features/listings/schemas';
import { discardDraft } from '@/features/listings/services/add-media';
import { type DraftFields, PostBlocker } from '@/features/listings/types/listing-draft';
import { hasDraft, postBlocker } from '@/features/listings/utils/listing-draft';
import { useToast } from '@/hooks/use-toast';
import { useListingDraftStore } from '@/stores/listing-draft';

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
 * The sell page's form, on the listing draft (plans/create-listing.md, "L6 in phases"):
 * the files and fields stay in the draft store while the seller is on other pages, and
 * Post sends them once every file is uploaded. A tap on Post with something to fix
 * scrolls to the first section that needs it, which says what.
 */
export default function CreateListingForm() {
  const { showSuccess } = useToast();

  // draft
  // A boolean, so typing does not re-render the whole form through the store.
  const isDraftStarted = useListingDraftStore((state) => hasDraft(state.fields, state.media));
  const media = useListingDraftStore((state) => state.media);
  const isPosting = useListingDraftStore((state) => state.isPosting);
  const setFields = useListingDraftStore((state) => state.setFields);

  const mediaRef = useRef<HTMLDivElement>(null);
  const form = useForm<DraftFields, unknown, ListingFieldValues>({
    resolver: zodResolver(listingFieldsSchema),
    mode: 'onSubmit',
    // The media section comes first; handlePost picks what to show.
    shouldFocusError: false,
    // Read once: the form owns the values from here and writes them back below.
    defaultValues: useListingDraftStore.getState().fields,
  });

  const handleServerFieldErrors = (fields: (keyof DraftFields)[]) => {
    fields.forEach((field, index) => {
      form.setError(field, { message: listingFormMessages[field] }, { shouldFocus: index === 0 });
    });
  };
  const scrollToMedia = () =>
    mediaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const postListing = usePostListing({
    onFieldErrors: handleServerFieldErrors,
    onMediaErrors: scrollToMedia,
  });

  useEffect(() => {
    const subscription = form.watch((values) => setFields(values));
    return () => subscription.unsubscribe();
  }, [form, setFields]);

  const blocker = postBlocker(media);
  const isWorking = blocker === PostBlocker.Working;
  const { isSubmitting, isSubmitted, isValid, errors } = form.formState;
  // A field the server refused passes the schema, so its error counts until it changes.
  const hasFieldErrors = !isValid || Object.keys(errors).length > 0;
  // Enabled until the first tap, so the seller finds out what is missing; then only once
  // it is all fixed. Never while files are still on their way: there is nothing to fix.
  const isPostDisabled =
    isSubmitting || isPosting || isWorking || (isSubmitted && (hasFieldErrors || blocker !== null));

  /** Scrolls to the photos when they block Post, else focuses the first field in error. */
  const showFirstProblem = (fieldErrors: FieldErrors<DraftFields>) => {
    if (postBlocker(useListingDraftStore.getState().media) !== null) {
      scrollToMedia();
      return;
    }

    const firstField = FIELDS_ON_SCREEN.find((field) => fieldErrors[field]);
    if (firstField) {
      form.setFocus(firstField);
    }
  };

  const handlePost = form.handleSubmit(async (values) => {
    if (postBlocker(useListingDraftStore.getState().media) !== null) {
      showFirstProblem({});
      return;
    }
    await postListing(values);
  }, showFirstProblem);

  const handleDiscard = () => {
    discardDraft();
    form.reset(EMPTY_FIELDS);
    showSuccess(discardMessages.discarded);
  };

  return (
    <form className="listing-form" aria-label="Tin đăng mới" noValidate onSubmit={handlePost}>
      {/* The draft stays as sent while the post is on its way. */}
      <fieldset disabled={isPosting} className="m-0 min-w-0 border-0 p-0">
        <div ref={mediaRef} className="scroll-mt-16">
          <MediaSection isPhotoMissing={isSubmitted && blocker === PostBlocker.NoPhoto} />
        </div>
        <ListingFields form={form} />
      </fieldset>

      <div className="form-actions">
        <button className="ui-button" type="submit" disabled={isPostDisabled}>
          {isPosting ? 'Đang đăng…' : 'Đăng tin'}
        </button>
        {isWorking && (
          <p role="status" className="ui-muted">
            {postMessages.working}
          </p>
        )}
        {isDraftStarted && <DiscardDraftButton isDisabled={isPosting} onDiscard={handleDiscard} />}
      </div>
    </form>
  );
}

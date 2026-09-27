import { useEffect } from 'react';

import ActionButton from '@/components/action-button';
import DiscardDraftButton from '@/features/listings/components/form/discard-draft-button';
import ListingFields from '@/features/listings/components/form/listing-fields';
import MediaSection from '@/features/listings/components/media/media-section';
import { EMPTY_FIELDS } from '@/features/listings/constants/listing-fields';
import { discardMessages, postMessages } from '@/features/listings/constants/messages';
import { formNoteClass } from '@/features/listings/constants/styles';
import { useListingForm } from '@/features/listings/hooks/use-listing-form';
import { usePostListing } from '@/features/listings/hooks/use-post-listing';
import { discardDraft } from '@/features/listings/services/add-media';
import { draftPipeline } from '@/features/listings/services/media-pipeline';
import { useToast } from '@/hooks/use-toast';
import { useHasDraft, useListingDraftStore } from '@/stores/listing-draft';

/**
 * The sell page's form, on the listing draft (plans/create-listing.md, "L6 in phases"):
 * the files and fields stay in the draft store while the seller is on other pages, and
 * Post sends them once every file is uploaded. A tap on Post with something to fix
 * scrolls to the first section that needs it, which says what.
 */
export default function CreateListingForm() {
  const { showSuccess } = useToast();

  const isDraftStarted = useHasDraft();
  const setFields = useListingDraftStore((state) => state.setFields);

  const {
    form,
    mediaRef,
    isPosting,
    isWorking,
    isSubmitDisabled,
    isPhotoMissing,
    scrollToMedia,
    markRefusedFields,
    submitWith,
  } = useListingForm(
    useListingDraftStore,
    // Read once: the form owns the values from here and writes them back below.
    useListingDraftStore.getState().fields,
  );
  const postListing = usePostListing({
    onFieldErrors: markRefusedFields,
    onMediaErrors: scrollToMedia,
  });

  useEffect(() => {
    const subscription = form.watch((values) => setFields(values));
    return () => subscription.unsubscribe();
  }, [form, setFields]);

  const handlePost = submitWith(postListing);

  const handleDiscard = () => {
    discardDraft();
    form.reset(EMPTY_FIELDS);
    showSuccess(discardMessages.discarded);
  };

  return (
    <form
      // A focused field stops below the page header with its label in view (80px).
      className="text-sm leading-normal [&_:is(input,select,textarea)]:scroll-mt-20"
      aria-label="Tin đăng mới"
      noValidate
      onSubmit={handlePost}
    >
      {/* The draft stays as sent while the post is on its way. */}
      <fieldset disabled={isPosting} className="m-0 min-w-0 border-0 p-0">
        <div ref={mediaRef} className="scroll-mt-16">
          <MediaSection pipeline={draftPipeline} isPhotoMissing={isPhotoMissing} />
        </div>
        <ListingFields form={form} />
      </fieldset>

      <div className="mt-6">
        <ActionButton type="submit" disabled={isSubmitDisabled}>
          {isPosting ? 'Đang đăng…' : 'Đăng tin'}
        </ActionButton>
        {isWorking && (
          <p role="status" className={formNoteClass}>
            {postMessages.working}
          </p>
        )}
        {isDraftStarted && <DiscardDraftButton isDisabled={isPosting} onDiscard={handleDiscard} />}
      </div>
    </form>
  );
}

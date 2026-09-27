import { useEffect } from 'react';

import ActionButton from '@/components/action-button';
import DiscardDraftButton from '@/features/listings/components/form/discard-draft-button';
import ListingFields from '@/features/listings/components/form/listing-fields';
import MediaSection from '@/features/listings/components/media/media-section';
import { EMPTY_FIELDS } from '@/features/listings/constants/listing-fields';
import { discardMessages, postMessages } from '@/features/listings/constants/messages';
import { formNoteClass } from '@/features/listings/constants/styles';
import { useListingForm } from '@/features/listings/hooks/use-listing-form';
import { discardDraft, forgetPostedDraft } from '@/features/listings/services/add-media';
import { draftPipeline } from '@/features/listings/services/media-pipeline';
import { useToast } from '@/hooks/use-toast';
import { useHasDraft, useListingDraftStore } from '@/stores/listing-draft';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'zmp-ui';

import { createListing, readPostError } from '@/features/listings/api/create-listing';
import type { ListingFieldValues } from '@/features/listings/schemas';
import type { DraftFields } from '@/features/listings/types/listing-draft';
import { type PostError, PostErrorKind } from '@/features/listings/types/post-error';
import { mediaIdsForPost, postBlocker } from '@/features/listings/utils/listing-draft';
import { myListingKeys } from '@/features/my-listings/api/keys';
import { productKeys } from '@/features/products/api/keys';
import type { MyListingsTab } from '@/features/my-listings/types/my-listing';
import { warnInDev } from '@/utils/dev-log';

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

/**
 * Posts the draft with its key and ends it: to My listings once posted, or back to the
 * form with what to fix. A failed post keeps the draft and its key, so posting again
 * cannot make a second listing. `isPosting` lives in the store, so a second visit to the
 * page cannot post the same draft twice.
 */
function usePostListing({
  onFieldErrors,
  onMediaErrors,
}: {
  /** The server refused these fields; the form marks them. */
  onFieldErrors: (fields: (keyof DraftFields)[]) => void;
  /** The server refused files, now marked on their tiles; the form shows them. */
  onMediaErrors: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showError, showInfo, showSuccess } = useToast();

  const handleError = (error: PostError) => {
    switch (error.kind) {
      case PostErrorKind.Fields:
        onFieldErrors(error.fields);
        showError(postMessages.fields);
        return;
      case PostErrorKind.AlreadyPosted:
        forgetPostedDraft();
        showInfo(postMessages.alreadyPosted);
        navigate(`/products/${encodeURIComponent(error.productId)}`, { replace: true });
        return;
      case PostErrorKind.MediaConflict:
        draftPipeline.markUnusableMedia(error.mediaIds);
        showError(postMessages.mediaConflict);
        onMediaErrors();
        return;
      case PostErrorKind.Invalid:
        showError(postMessages.invalid);
        return;
      case PostErrorKind.Other:
        showError(postMessages.failed);
    }
  };

  return async function postListing(fields: ListingFieldValues) {
    const { media, idempotencyKey, isPosting, setPosting } = useListingDraftStore.getState();
    if (isPosting || postBlocker(media) !== null) {
      return;
    }

    setPosting(true);
    let isPublished: boolean;
    try {
      isPublished = await createListing(fields, mediaIdsForPost(media), idempotencyKey);
    } catch (error) {
      warnInDev('post', 'posting the listing failed', error);
      handleError(readPostError(error));
      return;
    } finally {
      setPosting(false);
    }

    forgetPostedDraft();
    void queryClient.invalidateQueries({ queryKey: myListingKeys.all() });
    // Published at once (201): the home feed must show it too.
    void queryClient.invalidateQueries({ queryKey: productKeys.feeds() });
    showSuccess(isPublished ? postMessages.published : postMessages.processing);
    // On the tab that lists it. Back from My listings goes to where the seller came from,
    // not to an empty form.
    const tab: MyListingsTab = isPublished ? 'published' : 'processing';
    navigate('/my-listings', { replace: true, state: { tab } });
  };
}

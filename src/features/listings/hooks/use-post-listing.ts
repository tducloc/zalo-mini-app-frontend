import { useNavigate } from 'zmp-ui';

import { createListing, readPostError } from '@/features/listings/api/create-listing';
import { postMessages } from '@/features/listings/constants/messages';
import type { ListingFieldValues } from '@/features/listings/schemas';
import { forgetPostedDraft } from '@/features/listings/services/add-media';
import type { DraftFields } from '@/features/listings/types/listing-draft';
import { PostErrorKind, type PostError } from '@/features/listings/types/post-error';
import { mediaIdsForPost, postBlocker } from '@/features/listings/utils/listing-draft';
import { useToast } from '@/hooks/use-toast';
import { useListingDraftStore } from '@/stores/listing-draft';
import { warnInDev } from '@/utils/dev-log';

/**
 * Posts the draft with its key and ends it: to My listings once posted, or back to the
 * form with what to fix. A failed post keeps the draft and its key, so posting again
 * cannot make a second listing. `isPosting` lives in the store, so a second visit to the
 * page cannot post the same draft twice.
 */
export function usePostListing({
  onFieldErrors,
}: {
  /** The server refused these fields; the form marks them. */
  onFieldErrors: (fields: (keyof DraftFields)[]) => void;
}) {
  const navigate = useNavigate();
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
        showError(postMessages.mediaConflict);
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
    showSuccess(isPublished ? postMessages.published : postMessages.processing);
    // Back from My listings goes to where the seller came from, not to an empty form.
    navigate('/my-listings', { replace: true });
  };
}

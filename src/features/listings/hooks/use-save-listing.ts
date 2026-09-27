import { useQueryClient } from '@tanstack/react-query';

import { readSaveError, updateListing } from '@/features/listings/api/update-listing';
import { saveMessages } from '@/features/listings/constants/messages';
import type { ListingFieldValues } from '@/features/listings/schemas';
import type { MediaPipeline } from '@/features/listings/services/media-pipeline';
import type { DraftFields } from '@/features/listings/types/listing-draft';
import { type SaveError, SaveErrorKind } from '@/features/listings/types/update-listing';
import { type EditBaseline, listingChanges } from '@/features/listings/utils/edit-listing';
import { postBlocker } from '@/features/listings/utils/listing-draft';
import { myListingKeys } from '@/features/my-listings/api/keys';
import { productKeys } from '@/features/products/api/keys';
import type { ProductDetail } from '@/features/products/types/product';
import { useToast } from '@/hooks/use-toast';
import { warnInDev } from '@/utils/dev-log';

interface SaveListingOptions {
  productId: string;
  viewerId: string | null;
  pipeline: MediaPipeline;
  baseline: EditBaseline;
  /** The server refused these fields; the form marks them. */
  onFieldErrors: (fields: (keyof DraftFields)[]) => void;
  /** The server refused files, now marked on their tiles; the form shows them. */
  onMediaErrors: () => void;
  /** Saved, nothing to save, or the listing cannot be edited any more: close the page. */
  onDone: () => void;
}

/**
 * Saves an edit with `PATCH /products/:id`: only the fields that changed, and the media
 * set only when it changed. A failed save keeps the form as it is, to fix or send again.
 */
export function useSaveListing({
  productId,
  viewerId,
  pipeline,
  baseline,
  onFieldErrors,
  onMediaErrors,
  onDone,
}: SaveListingOptions) {
  const queryClient = useQueryClient();
  const { showError, showInfo, showSuccess } = useToast();

  const handleError = (error: SaveError) => {
    switch (error.kind) {
      case SaveErrorKind.Fields:
        onFieldErrors(error.fields);
        showError(saveMessages.fields);
        return;
      case SaveErrorKind.MediaConflict:
        pipeline.markUnusableMedia(error.mediaIds);
        showError(saveMessages.mediaConflict);
        onMediaErrors();
        return;
      case SaveErrorKind.NotEditable:
        showError(saveMessages.notEditable);
        void queryClient.invalidateQueries({ queryKey: myListingKeys.all() });
        onDone();
        return;
      case SaveErrorKind.Invalid:
        showError(saveMessages.invalid);
        return;
      case SaveErrorKind.Other:
        showError(saveMessages.failed);
    }
  };

  /** Every list and page that shows the listing gets the saved copy. */
  const refreshCaches = (saved: ProductDetail) => {
    queryClient.setQueryData(productKeys.detail(productId, viewerId), saved);
    void queryClient.invalidateQueries({ queryKey: productKeys.detailForAllViewers(productId) });
    void queryClient.invalidateQueries({ queryKey: myListingKeys.all() });
    void queryClient.invalidateQueries({ queryKey: productKeys.feeds() });
  };

  return async function saveListing(values: ListingFieldValues) {
    const { media, isPosting, setPosting } = pipeline.store.getState();
    if (isPosting || postBlocker(media) !== null) {
      return;
    }

    const changes = listingChanges(baseline, values, media);
    if (Object.keys(changes).length === 0) {
      showInfo(saveMessages.unchanged);
      onDone();
      return;
    }

    setPosting(true);
    let saved: ProductDetail;
    try {
      saved = await updateListing(productId, changes);
    } catch (error) {
      warnInDev('edit', 'saving the listing failed', error);
      handleError(readSaveError(error));
      return;
    } finally {
      setPosting(false);
    }

    // The listing has the new media now: closing the page must not delete it.
    pipeline.forgetAll();
    refreshCaches(saved);
    showSuccess(saved.status === 'PROCESSING' ? saveMessages.processing : saveMessages.saved);
    onDone();
  };
}

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useStore } from 'zustand';

import ActionButton from '@/components/action-button';
import ConfirmDialog, { ConfirmTone } from '@/components/feedback/confirm-dialog';
import MobilePageHeader from '@/components/layout/mobile-page-header';
import { pageContentClass } from '@/components/layout/styles';
import ListingFields from '@/features/listings/components/form/listing-fields';
import MediaSection from '@/features/listings/components/media/media-section';
import { readSaveError, updateListing } from '@/features/listings/api/update-listing';
import { leaveEditMessages, saveMessages } from '@/features/listings/constants/messages';
import { formNoteClass } from '@/features/listings/constants/styles';
import { useListingForm } from '@/features/listings/hooks/use-listing-form';
import { type ListingFieldValues, listingFieldsSchema } from '@/features/listings/schemas';
import {
  createMediaPipeline,
  type MediaPipeline,
} from '@/features/listings/services/media-pipeline';
import { DraftMediaStatus, type ListingMedia } from '@/features/listings/types/draft-media';
import type { DraftFields } from '@/features/listings/types/listing-draft';
import {
  type SaveError,
  SaveErrorKind,
  type UpdateListingInput,
} from '@/features/listings/types/update-listing';
import { mediaIdsForPost, postBlocker } from '@/features/listings/utils/listing-draft';
import { MediaKind } from '@/features/media/types/media';
import { MediaError, type ServerMedia, ServerMediaStatus } from '@/features/media/types/upload';
import { toMediaError } from '@/features/media/utils/media-error';
import { myListingKeys } from '@/features/my-listings/api/keys';
import { productKeys } from '@/features/products/api/keys';
import type { ProductDetail } from '@/features/products/types/product';
import { useGoBack } from '@/hooks/use-go-back';
import { useToast } from '@/hooks/use-toast';
import { warnInDev } from '@/utils/dev-log';
import { formatNumber } from '@/utils/format';
import { createListingDraftStore, type ListingDraftStart } from '@/stores/listing-draft';

/**
 * The edit page's header and form: the sell form's fields and media section, on a draft of
 * the page's own that starts with the listing (plans/create-listing.md: editing "keeps its
 * state on the page"), so a draft on the sell page is left alone. Closing the page stops
 * its uploads and deletes the new ones, unless they were saved; the listing's own media
 * is only removed by a save.
 */
export default function EditListingForm({
  product,
  viewerId,
}: {
  product: ProductDetail;
  viewerId: string | null;
}) {
  // Opened from a link, there is nothing to go back to: the listing's page, then.
  const leave = useGoBack(`/products/${encodeURIComponent(product.id)}`);

  // Started once from the listing; a later refetch of it does not reset the form.
  const [start] = useState(() => draftFromProduct(product));
  const [baseline] = useState(() => editBaseline(product));
  const [pipeline] = useState(() => createMediaPipeline(createListingDraftStore(start)));
  const [isLeaveAsked, setIsLeaveAsked] = useState(false);

  // Closing the page deletes the new uploads, unless a save kept them (`forgetAll`);
  // the listing's own media is only removed by a save.
  useEffect(() => {
    const stopListening = pipeline.start();
    return () => {
      pipeline.stopAll();
      stopListening();
    };
  }, [pipeline]);

  const media = useStore(pipeline.store, (state) => state.media);
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
  } = useListingForm(pipeline.store, start.fields);

  const saveListing = useSaveListing({
    productId: product.id,
    viewerId,
    pipeline,
    baseline,
    onFieldErrors: markRefusedFields,
    onMediaErrors: scrollToMedia,
    onDone: leave,
  });
  const handleSave = submitWith(saveListing);

  const hasChanges = form.formState.isDirty || isMediaChanged(baseline, media);
  const handleBack = () => {
    if (hasChanges) {
      setIsLeaveAsked(true);
      return;
    }
    leave();
  };

  return (
    <>
      <MobilePageHeader title="Sửa tin" showBack onBack={handleBack} />
      <main className={pageContentClass}>
        <form
          // A focused field stops below the page header with its label in view (80px).
          className="text-sm leading-normal [&_:is(input,select,textarea)]:scroll-mt-20"
          aria-label="Sửa tin đăng"
          noValidate
          onSubmit={handleSave}
        >
          {/* The edit stays as sent while the save is on its way. */}
          <fieldset disabled={isPosting} className="m-0 min-w-0 border-0 p-0">
            <div ref={mediaRef} className="scroll-mt-16">
              <MediaSection pipeline={pipeline} isPhotoMissing={isPhotoMissing} />
            </div>
            <ListingFields form={form} />
          </fieldset>

          <div className="mt-6">
            <ActionButton type="submit" disabled={isSubmitDisabled}>
              {isPosting ? 'Đang lưu…' : 'Lưu'}
            </ActionButton>
            {isWorking && (
              <p role="status" className={formNoteClass}>
                {saveMessages.working}
              </p>
            )}
          </div>
        </form>
      </main>
      <ConfirmDialog
        isVisible={isLeaveAsked}
        messages={leaveEditMessages}
        tone={ConfirmTone.Danger}
        onClose={() => setIsLeaveAsked(false)}
        onConfirm={leave}
      />
    </>
  );
}

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
function useSaveListing({
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

// ---- What the edit starts from and what Save sends (pure; tests/edit-listing.test.ts) ----

type ProductMedia = ProductDetail['media'][number];

/** The listing as saved, to tell what the seller changed. */
export interface EditBaseline {
  /** `locationId` is null for a legacy free-text location: the seller must pick one. */
  fields: Omit<ListingFieldValues, 'locationId'> & { locationId: string | null };
  /** In the order Save sends them: the photos (the cover first), then the video. */
  mediaIds: string[];
}

const FIELD_NAMES = listingFieldsSchema.keyof().options;

const serverStatuses: Record<NonNullable<ProductMedia['status']>, ServerMediaStatus> = {
  UPLOADING: ServerMediaStatus.Uploading,
  PROCESSING: ServerMediaStatus.Processing,
  READY: ServerMediaStatus.Ready,
  FAILED: ServerMediaStatus.Failed,
};

/** A FAILED item keeps a reason the app knows, so its tile says what to do. */
function serverMediaOf(item: ProductMedia): ServerMedia {
  // Older servers sent no status: only READY media then.
  const status = item.status ? serverStatuses[item.status] : ServerMediaStatus.Ready;
  const isFailedItem = status === ServerMediaStatus.Failed;
  return {
    status,
    thumbnailUrl: item.thumbnailUrl,
    placeholder: item.placeholder ?? null,
    error: isFailedItem ? (toMediaError(item.error) ?? MediaError.ProcessingFailed) : null,
  };
}

/** One of the listing's media as a tile that is already uploaded, with no local file. */
function tileOf(item: ProductMedia): ListingMedia {
  return {
    id: item.id,
    kind: item.type === 'VIDEO' ? MediaKind.Video : MediaKind.Image,
    file: null,
    status: DraftMediaStatus.Uploaded,
    reason: null,
    original: null,
    upload: null,
    previewUrl: null,
    progress: null,
    waitingFor: null,
    isRetryable: false,
    mediaId: item.id,
    server: serverMediaOf(item),
    mediumUrl: item.mediumUrl,
  };
}

/**
 * What the edit form starts with: the fields as the seller would type them (the price as
 * "6.990.000"), and the listing's media as tiles, the photos first in display order.
 */
export function draftFromProduct(product: ProductDetail): ListingDraftStart<ListingMedia> {
  const ordered = [...product.media].sort((a, b) => a.sortOrder - b.sortOrder);
  const photos = ordered.filter((item) => item.type === 'IMAGE');
  const videos = ordered.filter((item) => item.type === 'VIDEO');

  return {
    fields: {
      title: product.title,
      description: product.description,
      price: formatNumber(product.price),
      categoryId: product.category.id,
      condition: product.condition,
      locationId: product.location.id ?? '',
    },
    media: [...photos, ...videos].map(tileOf),
  };
}

export function editBaseline(product: ProductDetail): EditBaseline {
  return {
    fields: {
      title: product.title,
      description: product.description,
      price: product.price,
      categoryId: product.category.id,
      condition: product.condition,
      locationId: product.location.id,
    },
    mediaIds: mediaIdsForPost(draftFromProduct(product).media),
  };
}

/** The fields whose checked value differs from the saved one. */
export function changedFields(
  baseline: EditBaseline,
  values: ListingFieldValues,
): Partial<ListingFieldValues> {
  const changed = FIELD_NAMES.filter((key) => values[key] !== baseline.fields[key]);
  return Object.fromEntries(changed.map((key) => [key, values[key]]));
}

/**
 * Whether the tiles differ from the listing's media: one added, removed or moved. By
 * tile id, so a file still uploading counts too; a listing's media keeps its id as tile id.
 */
export function isMediaChanged(baseline: EditBaseline, media: ListingMedia[]) {
  const photos = media.filter((item) => item.kind === MediaKind.Image);
  const videos = media.filter((item) => item.kind === MediaKind.Video);
  const ids = [...photos, ...videos].map((item) => item.id);
  return (
    ids.length !== baseline.mediaIds.length || ids.some((id, i) => id !== baseline.mediaIds[i])
  );
}

/** The `PATCH` body: the changed fields, and `mediaIds` only when the media changed. */
export function listingChanges(
  baseline: EditBaseline,
  values: ListingFieldValues,
  media: ListingMedia[],
): UpdateListingInput {
  const fields = changedFields(baseline, values);
  return isMediaChanged(baseline, media) ? { ...fields, mediaIds: mediaIdsForPost(media) } : fields;
}

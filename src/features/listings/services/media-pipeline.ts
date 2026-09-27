/**
 * A draft store and the services working on its files, as the form's media section takes
 * them: the sell page's draft (one per app, always running), or an edit page's own, which
 * lives as long as the page (plans/create-listing.md: editing "keeps its state on the
 * page"). Both share the one-photo-at-a-time image queue and the upload slots.
 */

import {
  addDraftFiles,
  createMediaIntake,
  removeDraftMedia,
} from '@/features/listings/services/add-media';
import {
  createUploadService,
  markUnusableMedia,
  retryUpload,
} from '@/features/listings/services/upload-media';
import type { ListingMedia } from '@/features/listings/types/draft-media';
import type { RefusedFile } from '@/features/media/types/media';
import {
  createListingDraftStore,
  type ListingDraftStart,
  type ListingDraftStore,
  useListingDraftStore,
} from '@/stores/listing-draft';

export interface MediaPipeline {
  store: ListingDraftStore;
  addFiles: (files: File[]) => Promise<RefusedFile[]>;
  removeMedia: (id: string) => void;
  retryUpload: (id: string) => void;
  /** The server refused these media (409): their tiles ask for another file. */
  markUnusableMedia: (mediaIds: string[]) => void;
}

export interface EditMediaPipeline extends MediaPipeline {
  /**
   * Starts uploading picked files and asking about media still processing. Returns what
   * stops it all when the page closes: new uploads are deleted, the listing's media stays.
   */
  start: () => () => void;
  /** Saved: the listing has the new media now, so closing the page deletes nothing. */
  release: () => void;
}

/** The sell page's draft. */
export const draftPipeline: MediaPipeline = {
  store: useListingDraftStore,
  addFiles: addDraftFiles,
  removeMedia: removeDraftMedia,
  retryUpload,
  markUnusableMedia,
};

/** An edit page's own draft, starting with the listing's fields and media. */
export function createEditPipeline(start: ListingDraftStart<ListingMedia>): EditMediaPipeline {
  const store = createListingDraftStore(start);
  const uploads = createUploadService(store);
  const intake = createMediaIntake(store, uploads);

  return {
    store,
    addFiles: intake.addFiles,
    removeMedia: intake.removeMedia,
    retryUpload: uploads.retryUpload,
    markUnusableMedia: uploads.markUnusableMedia,
    start: () => {
      const stopListening = uploads.start();
      return () => {
        intake.stopAll();
        stopListening();
      };
    },
    release: intake.forgetAll,
  };
}

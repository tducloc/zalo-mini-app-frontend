/**
 * A draft store and the services working on its files, as the form's media section takes
 * them: the sell page's draft (one per app, always running), or an edit page's own, which
 * lives as long as the page (plans/create-listing.md: editing "keeps its state on the
 * page"). Both share the one-photo-at-a-time image queue and the upload slots.
 */

import {
  createMediaIntake,
  draftIntake,
  type MediaIntake,
} from '@/features/listings/services/add-media';
import {
  createUploadService,
  draftUploads,
  type UploadService,
} from '@/features/listings/services/upload-media';
import { type ListingDraftStore, useListingDraftStore } from '@/stores/listing-draft';

export interface MediaPipeline extends MediaIntake {
  store: ListingDraftStore;
  /**
   * Starts uploading picked files. Returns what stops listening; `stopAll` or `forgetAll`
   * decide what happens to the files.
   */
  start: () => () => void;
  retryUpload: (id: string) => void;
  /** The server refused these media (409): their tiles ask for another file. */
  markUnusableMedia: (mediaIds: string[]) => void;
}

function pipelineOf(
  store: ListingDraftStore,
  uploads: UploadService,
  intake: MediaIntake,
): MediaPipeline {
  return {
    ...intake,
    store,
    start: uploads.start,
    retryUpload: uploads.retryUpload,
    markUnusableMedia: uploads.markUnusableMedia,
  };
}

/** The sell page's draft, already started by its upload service. */
export const draftPipeline = pipelineOf(useListingDraftStore, draftUploads, draftIntake);

/** A pipeline of its own for this store, e.g. an edit page's draft. */
export function createMediaPipeline(store: ListingDraftStore): MediaPipeline {
  const uploads = createUploadService(store);
  return pipelineOf(store, uploads, createMediaIntake(store, uploads));
}

import PQueue from 'p-queue';

import {
  DraftMediaStatus,
  type UploadSource,
  type ListingMedia,
} from '@/features/listings/types/draft-media';
import type { RefusedMedia } from '@/features/listings/types/post-error';
import { deleteMedia } from '@/features/media/api/media-uploads';
import { browserTransport } from '@/features/media/services/browser-transport';
import { FileUpload } from '@/features/media/services/file-upload';
import {
  ServerMediaStatus,
  type UploadRequestFile,
  type UploadListener,
} from '@/features/media/types/upload';
import { type ListingDraftStore, useListingDraftStore } from '@/stores/listing-draft';
import { warnInDev } from '@/utils/dev-log';

/**
 * Files uploading at once. On a phone's uplink more would only split the bandwidth, and
 * finishing files one after another lets the server start processing the first sooner.
 */
const FILES_IN_FLIGHT = 2;

interface UploadEntry {
  upload: FileUpload;
  /** Aborted when the seller removes the file. */
  controller: AbortController;
}

/**
 * Files start in the order they became ready; a retried file joins the end. Shared by
 * every draft (the sell page's and an edit's): they use the same uplink.
 */
const uploadQueue = new PQueue({ concurrency: FILES_IN_FLIGHT });

const warn = (message: string, error: unknown) => warnInDev('upload', message, error);

function deleteQuietly(mediaId: string) {
  deleteMedia(mediaId).catch((error: unknown) => warn('could not delete media', error));
}

// ---- Uploading ----

function requestFor(media: ListingMedia, upload: UploadSource): UploadRequestFile {
  return {
    clientFileId: media.id,
    type: media.kind,
    contentType: upload.contentType,
    size: upload.blob.size,
    originalBytes: media.original?.bytes ?? upload.blob.size,
    originalWidth: media.original?.width ?? undefined,
    originalHeight: media.original?.height ?? undefined,
    optimized: upload.optimized,
  };
}

export type StopUploads = () => void;

export interface UploadService {
  start: () => StopUploads;
  retryUpload: (id: string) => void;
  cancelUpload: (id: string) => void;
  markUnusableMedia: (refused: RefusedMedia[]) => void;
  forgetUploads: () => void;
}

/** The uploads of one draft store's files. */
export function createUploadService(store: ListingDraftStore): UploadService {
  /** One per draft file that is ready to upload or further on, by draft id, until removed. */
  const entries = new Map<string, UploadEntry>();

  const draftMedia = () => store.getState().media;

  const update = (id: string, change: Partial<ListingMedia>) =>
    store.getState().updateMedia(id, change);

  /** Queues each file that became ready; it asks for its own upload URL when it starts. */
  function queueReady() {
    for (const media of draftMedia()) {
      if (
        media.status !== DraftMediaStatus.ReadyToUpload ||
        !media.upload ||
        entries.has(media.id)
      ) {
        continue;
      }
      const entry: UploadEntry = {
        upload: new FileUpload(
          requestFor(media, media.upload),
          media.upload.blob,
          browserTransport,
        ),
        controller: new AbortController(),
      };
      entries.set(media.id, entry);
      enqueue(media.id, entry);
    }
  }

  function enqueue(id: string, entry: UploadEntry) {
    // A file removed while waiting gives up its turn at once.
    void uploadQueue.add(() =>
      entry.controller.signal.aborted ? Promise.resolve() : runUpload(id, entry),
    );
  }

  function listenerFor(id: string, entry: UploadEntry): UploadListener {
    let shownPercent = -1;
    return {
      onRegistered: (mediaId) => {
        // Removed while asking for the URL: the server made the media anyway.
        if (entries.get(id) !== entry) {
          deleteQuietly(mediaId);
        }
      },
      onProgress: (fraction) => {
        // Progress comes every few KB; the tile only needs whole percents.
        const percent = Math.floor(fraction * 100);
        if (percent !== shownPercent) {
          shownPercent = percent;
          update(id, { status: DraftMediaStatus.Uploading, progress: percent / 100 });
        }
      },
      onWaiting: (waitingFor) => update(id, { status: DraftMediaStatus.Retrying, waitingFor }),
      onResumed: () => update(id, { status: DraftMediaStatus.Uploading, waitingFor: null }),
    };
  }

  async function runUpload(id: string, entry: UploadEntry) {
    const failed = (isRetryable: boolean) =>
      update(id, { status: DraftMediaStatus.UploadFailed, isRetryable, waitingFor: null });

    // A retried video keeps the share of its parts already in storage.
    const media = draftMedia().find((item) => item.id === id);
    update(id, { status: DraftMediaStatus.Uploading, progress: media?.progress ?? 0 });
    try {
      const result = await entry.upload.run(listenerFor(id, entry), entry.controller.signal);
      if (entry.controller.signal.aborted) {
        return;
      }
      if (result.kind === 'failed') {
        failed(result.isRetryable);
        return;
      }
      update(id, {
        status: DraftMediaStatus.Uploaded,
        mediaId: result.mediaId,
        server: { status: result.status, thumbnailUrl: null, error: null },
        waitingFor: null,
      });
    } catch (error) {
      // Rejects only when removed, apart from a bug; the seller can still retry that.
      if (!entry.controller.signal.aborted) {
        warn('upload stopped unexpectedly', error);
        failed(true);
      }
    }
  }

  // ---- What the draft and the form call ----

  /** The seller tapped Retry on a failed upload; a second tap finds it queued already. */
  function retryUpload(id: string) {
    const entry = entries.get(id);
    const media = draftMedia().find((item) => item.id === id);
    if (!entry || media?.status !== DraftMediaStatus.UploadFailed) {
      return;
    }
    entry.upload.markUrlsStale();
    update(id, { status: DraftMediaStatus.ReadyToUpload });
    enqueue(id, entry);
  }

  /** Stops the file's upload and deletes it on the server, if it got that far. */
  function cancelUpload(id: string) {
    const entry = entries.get(id);
    if (!entry) {
      return;
    }
    entries.delete(id);
    entry.controller.abort();
    if (entry.upload.mediaId) {
      deleteQuietly(entry.upload.mediaId);
    }
  }

  /** `POST /products` refused these media (409): their tiles ask for another file. */
  function markUnusableMedia(refused: RefusedMedia[]) {
    const errors = new Map(refused.map(({ mediaId, error }) => [mediaId, error]));
    for (const media of draftMedia()) {
      const error = media.mediaId ? errors.get(media.mediaId) : undefined;
      if (error) {
        update(media.id, {
          server: {
            thumbnailUrl: media.server?.thumbnailUrl ?? null,
            status: ServerMediaStatus.Failed,
            error,
          },
        });
      }
    }
  }

  /**
   * The listing was posted: its media is the server's now. Stops watching every file,
   * deleting nothing.
   */
  function forgetUploads() {
    for (const entry of entries.values()) {
      entry.controller.abort();
    }
    entries.clear();
  }

  function start() {
    const unsubscribe = store.subscribe(queueReady);
    queueReady();
    return unsubscribe;
  }

  return { start, retryUpload, cancelUpload, markUnusableMedia, forgetUploads };
}

/** The sell page's draft: uploads from the moment the app loads. */
export const draftUploads = createUploadService(useListingDraftStore);
/** For the media lab, which works on the sell page's draft. */
export const { retryUpload } = draftUploads;

const stopDraftUploads = draftUploads.start();

// Dev only: a hot reload would otherwise leave the old module uploading the same files too.
import.meta.hot?.dispose(stopDraftUploads);

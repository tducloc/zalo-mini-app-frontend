/**
 * Uploads the draft's files once they are ready (diagrams 04, 04b, 05), and asks the
 * server how processing goes until each is ready or failed. Module-level and driven by the
 * draft store, like add-media.ts, so uploads go on while the seller is on another page
 * (diagram 08). Importing this module starts it: it subscribes to the store at the bottom.
 */

import PQueue from 'p-queue';

import {
  DraftMediaStatus,
  type UploadSource,
  type DraftMedia,
} from '@/features/listings/types/draft-media';
import { isServerSettled } from '@/features/listings/utils/draft-media';
import { deleteMedia, fetchMediaStatuses } from '@/features/media/api/media-uploads';
import { browserTransport } from '@/features/media/services/browser-transport';
import { FileUpload } from '@/features/media/services/file-upload';
import {
  MediaError,
  type MediaStatusItem,
  type ServerMedia,
  ServerMediaStatus,
  type UploadRequestFile,
  type UploadListener,
} from '@/features/media/types/upload';
import { useListingDraftStore } from '@/stores/listing-draft';
import { warnInDev } from '@/utils/dev-log';

/**
 * Files uploading at once. On a phone's uplink more would only split the bandwidth, and
 * finishing files one after another lets the server start processing the first sooner.
 */
const FILES_IN_FLIGHT = 2;

/**
 * How often to ask the server about files it is processing: a photo takes a second or
 * two, a video up to a minute. One request covers every file.
 */
const POLL_INTERVAL_MS = 3_000;

/** Right after `complete`: no thumbnail or reason yet. */
const NOTHING_YET: ServerMedia = {
  status: ServerMediaStatus.Processing,
  thumbnailUrl: null,
  placeholder: null,
  error: null,
};

interface UploadEntry {
  upload: FileUpload;
  /** Aborted when the seller removes the file. */
  controller: AbortController;
}

/** One per draft file that is ready to upload or further on, by draft id, until removed. */
const entries = new Map<string, UploadEntry>();
/** Files start in the order they became ready; a retried file joins the end. */
const uploadQueue = new PQueue({ concurrency: FILES_IN_FLIGHT });

let pollTimer: ReturnType<typeof setTimeout> | undefined;
let isPolling = false;

const draftMedia = () => useListingDraftStore.getState().media;

const update = (id: string, change: Partial<DraftMedia>) =>
  useListingDraftStore.getState().updateMedia(id, change);

const warn = (message: string, error: unknown) => warnInDev('upload', message, error);

function deleteQuietly(mediaId: string) {
  // Best effort: media on no listing is removed by the hourly cleanup anyway (diagram 07).
  deleteMedia(mediaId).catch((error: unknown) => warn('could not delete media', error));
}

// ---- Uploading ----

function requestFor(media: DraftMedia, upload: UploadSource): UploadRequestFile {
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

/** Queues each file that became ready; it asks for its own upload URL when it starts. */
function queueReady() {
  for (const media of draftMedia()) {
    if (media.status !== DraftMediaStatus.ReadyToUpload || !media.upload || entries.has(media.id)) {
      continue;
    }
    const entry: UploadEntry = {
      upload: new FileUpload(requestFor(media, media.upload), media.upload.blob, browserTransport),
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
      server: { ...NOTHING_YET, status: result.status },
      waitingFor: null,
    });
    schedulePoll();
  } catch (error) {
    // Rejects only when removed, apart from a bug; the seller can still retry that.
    if (!entry.controller.signal.aborted) {
      warn('upload stopped unexpectedly', error);
      failed(true);
    }
  }
}

// ---- Processing status, until each file is ready or failed ----

const isMediaError = (code: string): code is MediaError =>
  Object.values<string>(MediaError).includes(code);

/** A FAILED gets a reason the app knows, so it settles and is not asked about forever. */
function serverMediaFrom(item: MediaStatusItem | undefined): ServerMedia {
  if (!item) {
    // No longer listed, e.g. removed by the hourly cleanup.
    return { ...NOTHING_YET, status: ServerMediaStatus.Failed, error: MediaError.Missing };
  }
  const { status, thumbnailUrl, placeholder, error } = item;
  if (status !== ServerMediaStatus.Failed) {
    return { status, thumbnailUrl, placeholder, error: null };
  }
  const reason = error && isMediaError(error) ? error : MediaError.ProcessingFailed;
  return { status, thumbnailUrl, placeholder, error: reason };
}

const mediaToPoll = () =>
  draftMedia().filter(
    (media) => media.status === DraftMediaStatus.Uploaded && !isServerSettled(media.server),
  );

/** One request at a time, every POLL_INTERVAL_MS while some file is still processing. */
function schedulePoll() {
  if (pollTimer !== undefined || isPolling || mediaToPoll().length === 0) {
    return;
  }
  pollTimer = setTimeout(() => {
    pollTimer = undefined;
    void pollStatuses();
  }, POLL_INTERVAL_MS);
}

async function pollStatuses() {
  const waiting = mediaToPoll();
  // The files were removed, or the draft ended, since this poll was scheduled.
  if (waiting.length === 0) {
    return;
  }

  isPolling = true;
  try {
    const statuses = await fetchMediaStatuses(waiting.flatMap((media) => media.mediaId ?? []));
    const byId = new Map(statuses.map((item) => [item.id, item]));
    for (const media of waiting) {
      update(media.id, { server: serverMediaFrom(byId.get(media.mediaId ?? '')) });
    }
  } catch (error) {
    // The next round asks again.
    warn('polling media status failed', error);
  } finally {
    isPolling = false;
  }
  schedulePoll();
}

// ---- What the draft and the form call ----

/** The seller tapped Retry on a failed upload; a second tap finds it queued already. */
export function retryUpload(id: string) {
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
export function cancelUpload(id: string) {
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

/**
 * The listing was posted: its media is the server's now. Stops watching every file,
 * deleting nothing.
 */
export function forgetUploads() {
  for (const entry of entries.values()) {
    entry.controller.abort();
  }
  entries.clear();
  clearTimeout(pollTimer);
  pollTimer = undefined;
}

const unsubscribe = useListingDraftStore.subscribe(queueReady);

// Dev only: a hot reload would otherwise leave the old module uploading the same files too.
import.meta.hot?.dispose(() => {
  unsubscribe();
  clearTimeout(pollTimer);
});

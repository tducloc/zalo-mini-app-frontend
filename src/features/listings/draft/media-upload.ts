/**
 * Uploads the draft's files once they are ready to upload (diagrams 04, 04b, 05), and asks
 * the server how processing goes until each is ready or failed. Module-level and driven by
 * the draft store, like media-intake.ts, so uploads go on while the seller is on another
 * page (diagram 08). Importing this module starts it: it subscribes to the store at the
 * bottom of the file.
 */

import PQueue from 'p-queue';

import {
  DraftMediaStatus,
  isServerSettled,
  type MediaAction,
  type ReadyDraftMedia,
  type UploadedDraftMedia,
} from '@/features/listings/draft/media-reducer';
import { useListingDraftStore } from '@/features/listings/draft/store';
import { FileUpload, type UploadListener } from '@/features/media/upload/file-upload';
import { FailureKind, pollDelayMs } from '@/features/media/upload/retry-policy';
import {
  browserTransport,
  deleteMedia,
  fetchMediaStatuses,
} from '@/features/media/upload/upload-api';
import {
  MediaError,
  type ServerMedia,
  ServerMediaStatus,
  type UploadRequestFile,
} from '@/features/media/upload/upload-types';
import { warnInDev } from '@/utils/dev-log';

/**
 * Files uploading at once. On a phone's uplink more would only split the bandwidth, and
 * finishing files one after another lets the server start processing the first sooner;
 * fewer requests at once also means a dropped connection fails fewer of them.
 */
const FILES_IN_FLIGHT = 2;

enum Phase {
  /** In the upload queue, waiting for a free slot or running. */
  Queued = 'QUEUED',
  Failed = 'FAILED',
  Uploaded = 'UPLOADED',
}

interface UploadEntry {
  upload: FileUpload;
  controller: AbortController;
  phase: Phase;
  /** Why the last run failed, when it did. */
  failure: FailureKind | null;
}

/** For a media the server no longer lists, e.g. after the hourly cleanup. */
const MISSING_ON_SERVER: ServerMedia = {
  status: ServerMediaStatus.Failed,
  thumbnailUrl: null,
  placeholder: null,
  error: MediaError.Missing,
};

/** One per draft file that is ready to upload or further on, by draft ID, until removed. */
const entries = new Map<string, UploadEntry>();
/** Files start in the order they became ready; a retried file joins the end. */
const uploadQueue = new PQueue({ concurrency: FILES_IN_FLIGHT });

let pollTimer: ReturnType<typeof setTimeout> | undefined;
let pollRound = 0;
let isPolling = false;

const draftMedia = () => useListingDraftStore.getState().media;

const dispatch = (action: MediaAction) => useListingDraftStore.getState().dispatchMedia(action);

const warn = (message: string, error: unknown) => warnInDev('upload', message, error);

function deleteQuietly(mediaId: string) {
  // Best effort: media on no listing is removed by the hourly cleanup anyway (diagram 07).
  deleteMedia(mediaId).catch((error: unknown) => warn('could not delete media', error));
}

const justUploaded = (status: ServerMediaStatus): ServerMedia => ({
  status,
  thumbnailUrl: null,
  placeholder: null,
  error: null,
});

function requestFor(media: ReadyDraftMedia): UploadRequestFile {
  return {
    clientFileId: media.id,
    type: media.kind,
    contentType: media.upload.contentType,
    size: media.upload.blob.size,
    originalBytes: media.original.bytes,
    originalWidth: media.original.width ?? undefined,
    originalHeight: media.original.height ?? undefined,
    optimized: media.upload.optimized,
  };
}

/**
 * Queues each file that became ready. It asks for its own upload URL when it starts
 * (FileUpload), not all together: the call is quick, a URL taken right before the upload
 * is fresh, and the limit of 60 an hour is per seller, far above the 11 a listing needs.
 */
function queueReady() {
  for (const item of useListingDraftStore.getState().media) {
    if (item.status === DraftMediaStatus.ReadyToUpload && !entries.has(item.id)) {
      const entry: UploadEntry = {
        upload: new FileUpload(requestFor(item), item.upload.blob, browserTransport),
        controller: new AbortController(),
        phase: Phase.Queued,
        failure: null,
      };
      entries.set(item.id, entry);
      enqueue(item.id, entry);
    }
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
      // XHR reports every few KB; the tile only needs whole percents.
      const percent = Math.floor(fraction * 100);
      if (percent !== shownPercent) {
        shownPercent = percent;
        dispatch({ type: 'progressed', id, progress: percent / 100 });
      }
    },
    onWaiting: (waitingFor) => dispatch({ type: 'uploadWaiting', id, waitingFor }),
    onResumed: () => dispatch({ type: 'uploadResumed', id }),
  };
}

async function runUpload(id: string, entry: UploadEntry) {
  dispatch({ type: 'uploadStarted', id });
  try {
    const result = await entry.upload.run(listenerFor(id, entry), entry.controller.signal);
    if (entry.controller.signal.aborted) {
      return;
    }
    if (result.kind === 'uploaded') {
      entry.phase = Phase.Uploaded;
      dispatch({
        type: 'uploaded',
        id,
        mediaId: result.mediaId,
        server: justUploaded(result.status),
      });
      pollSoon();
    } else {
      entry.phase = Phase.Failed;
      entry.failure = result.failure;
      dispatch({ type: 'uploadFailed', id, isRetryable: result.isRetryable });
    }
  } catch (error) {
    // Rejects only when removed, apart from a bug; the seller can still retry that.
    if (!entry.controller.signal.aborted) {
      warn('upload stopped unexpectedly', error);
      entry.phase = Phase.Failed;
      dispatch({ type: 'uploadFailed', id, isRetryable: true });
    }
  }
}

// ---- Processing status, until each file is ready or failed ----

function mediaToPoll() {
  return draftMedia().filter(
    (item): item is UploadedDraftMedia =>
      item.status === DraftMediaStatus.Uploaded && !isServerSettled(item.server),
  );
}

function schedulePoll() {
  clearTimeout(pollTimer);
  if (isPolling || mediaToPoll().length === 0) {
    return;
  }
  pollTimer = setTimeout(() => void pollStatuses(), pollDelayMs(pollRound));
  pollRound += 1;
}

/** A file just finished uploading: ask quickly again, then less often. */
function pollSoon() {
  pollRound = 0;
  schedulePoll();
}

/** One request at a time; the one in flight schedules the next when it answers. */
async function pollStatuses() {
  const waiting = mediaToPoll();
  if (waiting.length === 0) {
    return;
  }

  isPolling = true;
  try {
    const statuses = await fetchMediaStatuses(waiting.map((item) => item.mediaId));
    const byId = new Map(statuses.map((status) => [status.id, status]));
    for (const item of waiting) {
      dispatch({
        type: 'serverUpdated',
        id: item.id,
        server: serverMediaFrom(byId.get(item.mediaId)),
      });
    }
  } catch (error) {
    // The next round asks again.
    warn('polling media status failed', error);
  } finally {
    isPolling = false;
  }
  schedulePoll();
}

function serverMediaFrom(status: ServerMedia | undefined): ServerMedia {
  if (!status) {
    return MISSING_ON_SERVER;
  }
  // A FAILED without a reason would be asked about forever; any reason settles it.
  const isFailedWithoutReason = status.status === ServerMediaStatus.Failed && !status.error;
  return {
    status: status.status,
    thumbnailUrl: status.thumbnailUrl,
    placeholder: status.placeholder,
    error: isFailedWithoutReason ? MediaError.ProcessingFailed : status.error,
  };
}

// ---- What the draft and the form call ----

function requeue(id: string, entry: UploadEntry) {
  entry.phase = Phase.Queued;
  entry.failure = null;
  entry.upload.markUrlsStale();
  enqueue(id, entry);
}

/** The seller tapped Retry on a failed upload. */
export function retryUpload(id: string) {
  const entry = entries.get(id);
  if (entry?.phase === Phase.Failed) {
    requeue(id, entry);
  }
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
 * Uploads that ran out of attempts for lack of network start again once it is back, e.g.
 * after a lift ride that outlasted the retry waits; the seller need not tap Retry.
 */
function retryAfterNetworkLoss() {
  for (const [id, entry] of entries) {
    if (entry.phase === Phase.Failed && entry.failure === FailureKind.Network) {
      requeue(id, entry);
    }
  }
}

const unsubscribe = useListingDraftStore.subscribe(queueReady);
if (typeof window !== 'undefined') {
  window.addEventListener('online', retryAfterNetworkLoss);
}

// Dev only: a hot reload would otherwise leave the old module uploading the same files too.
import.meta.hot?.dispose(() => {
  unsubscribe();
  window.removeEventListener('online', retryAfterNetworkLoss);
});

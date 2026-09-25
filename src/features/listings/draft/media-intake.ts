/**
 * Takes the files the seller picks through checking and optimizing (diagrams 02, 02b, 03)
 * and writes each step into the draft store. Module-level rather than in a component, so
 * the work goes on while the seller is on another page.
 */

import {
  type DraftMedia,
  DraftMediaStatus,
  type MediaAction,
  type OriginalFile,
  type UploadSource,
} from '@/features/listings/draft/media-reducer';
import { cancelUpload } from '@/features/listings/draft/media-upload';
import { useListingDraftStore } from '@/features/listings/draft/store';
import { canConvertVideos, convertVideo } from '@/features/media/convert-video';
import {
  FileFormat,
  IMAGE_HEAD_BYTES,
  type ImageDimensions,
  readHead,
  readImageDimensions,
  sniffFormat,
} from '@/features/media/file-header';
import { ImageQueue } from '@/features/media/image/image-queue';
import { canOptimizeImages } from '@/features/media/image/image-worker';
import {
  checkVideoLength,
  convertedVideoSize,
  MediaKind,
  mediaKindOf,
  originalVideoProblem,
  refusePicked,
  RejectReason,
  shouldConvertVideo,
  type VideoFacts,
} from '@/features/media/media-limits';
import { readVideoMetadata } from '@/features/media/video-metadata';
import { warnInDev } from '@/utils/dev-log';

interface PickedFile {
  id: string;
  file: File;
  format: FileFormat;
  /** Photos only, from the header read when the file was picked. */
  dimensions: ImageDimensions | null;
  /** Aborted when the seller removes the file, at whatever step it has reached. */
  signal: AbortSignal;
}

const imageQueue = new ImageQueue();
/** One per file still being worked on. */
const inProgress = new Map<string, AbortController>();
let fileCount = 0;

const dispatch = (action: MediaAction) => useListingDraftStore.getState().dispatchMedia(action);

const findMedia = (id: string) =>
  useListingDraftStore.getState().media.find((media) => media.id === id);

const warn = (message: string, error: unknown) => warnInDev('media', message, error);

/** Enough for the format and a photo's size; null when the file cannot be read. */
async function readPickedHead(file: File) {
  try {
    return await readHead(file, IMAGE_HEAD_BYTES);
  } catch {
    // iOS can hand over a file it no longer lets us read, e.g. an iCloud photo not downloaded.
    return null;
  }
}

function acceptedCounts() {
  const counts = { [MediaKind.Image]: 0, [MediaKind.Video]: 0 };
  for (const media of useListingDraftStore.getState().media) {
    if (media.status !== DraftMediaStatus.Rejected) {
      counts[media.kind] += 1;
    }
  }
  return counts;
}

async function takeImage({ id, file, format, dimensions, signal }: PickedFile) {
  // As stored in the file, before EXIF orientation (api-spec, upload-urls).
  const original = {
    bytes: file.size,
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
  };
  const asPicked: UploadSource = { blob: file, contentType: format, optimized: false };
  if (!canOptimizeImages) {
    dispatch({ type: 'ready', id, original, upload: asPicked, previewUrl: null });
    return;
  }

  dispatch({ type: 'optimizing', id, original });
  const outcome = await imageQueue.optimize(id, file, dimensions);
  if (outcome.kind === 'cancelled' || signal.aborted) {
    return;
  }

  if (outcome.kind === 'original' || outcome.image.keptOriginal) {
    dispatch({ type: 'ready', id, original, upload: asPicked, previewUrl: null });
    return;
  }

  const { blob } = outcome.image;
  dispatch({
    type: 'ready',
    id,
    original,
    upload: { blob, contentType: FileFormat.Jpeg, optimized: true },
    previewUrl: URL.createObjectURL(blob),
  });
}

/** Resolves with the converted clip, or null to fall back to the picked file. */
async function convert(
  { id, file, signal }: PickedFile,
  original: OriginalFile,
  facts: VideoFacts,
) {
  if (!canConvertVideos || !facts.width || !facts.height) {
    return null;
  }

  dispatch({ type: 'optimizing', id, original });
  let shownPercent = 0;
  try {
    return await convertVideo(file, {
      ...convertedVideoSize(facts.width, facts.height),
      signal,
      onProgress: (progress) => {
        // mediabunny reports every frame; the tile only needs whole percents.
        const percent = Math.floor(progress * 100);
        if (percent > shownPercent) {
          shownPercent = percent;
          dispatch({ type: 'progressed', id, progress: percent / 100 });
        }
      },
    });
  } catch (error) {
    if (!signal.aborted) {
      warn('video conversion failed, trying the original', error);
    }
    return null;
  }
}

async function takeVideo(picked: PickedFile) {
  const { id, file, format, signal } = picked;
  let facts: VideoFacts;
  try {
    const metadata = await readVideoMetadata(file);
    facts = { ...metadata, bytes: file.size };
  } catch {
    dispatch({ type: 'rejected', id, reason: RejectReason.Unreadable });
    return;
  }

  if (signal.aborted) {
    return;
  }

  const tooLong = checkVideoLength(facts.durationMs);
  if (tooLong) {
    dispatch({ type: 'rejected', id, reason: tooLong });
    return;
  }

  const original = { bytes: file.size, width: facts.width, height: facts.height };
  const problem = originalVideoProblem(facts);
  if (shouldConvertVideo(facts)) {
    const converted = await convert(picked, original, facts);
    if (signal.aborted) {
      return;
    }
    // Same rule as photos: keep the picked file when converting did not make it smaller.
    if (converted && (problem || converted.size < file.size)) {
      const upload = { blob: converted, contentType: FileFormat.Mp4, optimized: true };
      dispatch({ type: 'ready', id, original, upload, previewUrl: null });
      return;
    }
  }

  // Converting was not possible or not worth it: the file as picked, if the server takes it.
  if (problem) {
    dispatch({ type: 'rejected', id, reason: problem });
    return;
  }
  const upload = { blob: file, contentType: format, optimized: false };
  dispatch({ type: 'ready', id, original, upload, previewUrl: null });
}

async function take(picked: PickedFile, kind: MediaKind) {
  try {
    await (kind === MediaKind.Image ? takeImage(picked) : takeVideo(picked));
  } catch (error) {
    // Reading the file failed partway (the picker's copy went away); nothing else throws here.
    if (!picked.signal.aborted) {
      warn('could not read a picked file', error);
      dispatch({ type: 'rejected', id: picked.id, reason: RejectReason.Unreadable });
    }
  } finally {
    inProgress.delete(picked.id);
  }
}

/** Adds the picked files to the draft, in order, and starts checking them. */
export async function addDraftFiles(files: File[]) {
  const heads = await Promise.all(files.map(readPickedHead));

  // No await from here to the dispatch, so two quick picks cannot both take the last slot.
  const picked = files.map((file, index) => {
    const head = heads[index];
    const format = head ? sniffFormat(head) : null;
    const kind = mediaKindOf(format ?? FileFormat.Unknown, file.type);
    const dimensions = head && kind === MediaKind.Image ? readImageDimensions(head) : null;
    return { file, kind, format, bytes: file.size, dimensions };
  });
  const refusals = refusePicked(picked, acceptedCounts());
  const ids = files.map(() => `local-${++fileCount}`);
  dispatch({
    type: 'added',
    items: picked.map(({ file, kind }, index) => ({ id: ids[index], file, kind })),
  });

  picked.forEach(({ file, kind, format, dimensions }, index) => {
    const id = ids[index];
    const refusal = refusals[index];
    if (refusal || !format) {
      dispatch({ type: 'rejected', id, reason: refusal ?? RejectReason.Unreadable });
      return;
    }

    const controller = new AbortController();
    inProgress.set(id, controller);
    void take({ id, file, format, dimensions, signal: controller.signal }, kind);
  });
}

/**
 * Stops the file's work at whatever step it is, deletes what reached the server, and
 * frees its preview.
 */
function stopWork(media: DraftMedia) {
  imageQueue.cancel(media.id);
  inProgress.get(media.id)?.abort();
  inProgress.delete(media.id);
  cancelUpload(media.id);
  if ('previewUrl' in media && media.previewUrl) {
    URL.revokeObjectURL(media.previewUrl);
  }
}

/** Removes the file from the draft; a result that still arrives is dropped. */
export function removeDraftMedia(id: string) {
  const media = findMedia(id);
  if (media) {
    stopWork(media);
  }
  dispatch({ type: 'removed', id });
}

/** "Huỷ tin": drops every file, and deletes the ones already on the server. */
export function clearDraftMedia() {
  useListingDraftStore.getState().media.forEach(stopWork);
  dispatch({ type: 'cleared' });
}

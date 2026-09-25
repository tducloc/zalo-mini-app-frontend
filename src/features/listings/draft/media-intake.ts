/**
 * Takes the files the seller picks through checking and optimizing (diagrams 02, 02b, 03)
 * and writes each step into the draft store. Module-level rather than in a component, so
 * the work goes on while the seller is on another page.
 */

import {
  type DraftMedia,
  DraftMediaStatus,
  type MediaAction,
  MediaActionType,
  type OriginalFile,
  type UploadSource,
} from '@/features/listings/draft/media-reducer';
import { cancelUpload } from '@/features/listings/draft/media-upload';
import { useListingDraftStore } from '@/stores/listing-draft';
import { MediaDetector } from '@/features/media/media-detector';
import { ImageQueue } from '@/features/media/image/image-queue';
import { ImageFormat, type PhotoHeader } from '@/features/media/image/image-utils';
import { canOptimizeImages } from '@/features/media/image/image-worker';
import { MediaKind, refusePicked, RejectReason } from '@/features/media/media-utils';
import { canConvertVideos, convertVideo } from '@/features/media/video/convert-video';
import {
  originalVideoProblem,
  readVideoMetadata,
  shouldConvertVideo,
  videoLengthProblem,
  type VideoFacts,
  VideoFormat,
  type VideoMetadata,
} from '@/features/media/video/video-utils';
import { warnInDev } from '@/utils/dev-log';

interface PickedFile {
  id: string;
  file: File;
  /** Photos only: format and size from the header read when the file was picked. */
  photo: PhotoHeader | null;
  /** Aborted when the seller removes the file, at whatever step it has reached. */
  signal: AbortSignal;
}

const imageQueue = new ImageQueue();
/** One per file still being worked on. */
const inProgress = new Map<string, AbortController>();
let nextFileNumber = 1;

const dispatch = (action: MediaAction) => useListingDraftStore.getState().dispatchMedia(action);

const findMedia = (id: string) =>
  useListingDraftStore.getState().media.find((media) => media.id === id);

const warn = (message: string, error: unknown) => warnInDev('media', message, error);

function acceptedCounts() {
  const counts = { [MediaKind.Image]: 0, [MediaKind.Video]: 0 };
  for (const media of useListingDraftStore.getState().media) {
    if (media.status !== DraftMediaStatus.Rejected) {
      counts[media.kind] += 1;
    }
  }
  return counts;
}

async function takeImage({ id, file, photo, signal }: PickedFile) {
  if (!photo?.format) {
    // MediaDetector refuses such a file first; never leave a tile on Checking.
    dispatch({ type: MediaActionType.Rejected, id, reason: RejectReason.UnsupportedImageFormat });
    return;
  }
  // As stored in the file, before EXIF orientation (api-spec, upload-urls).
  const original = { bytes: file.size, width: photo.width, height: photo.height };
  const asPicked: UploadSource = { blob: file, contentType: photo.format, optimized: false };
  if (!canOptimizeImages) {
    dispatch({ type: MediaActionType.Ready, id, original, upload: asPicked, previewUrl: null });
    return;
  }

  dispatch({ type: MediaActionType.OptimizeStarted, id, original });
  const outcome = await imageQueue.optimize(id, file);
  if (outcome.kind === 'cancelled' || signal.aborted) {
    return;
  }

  if (outcome.kind === 'original' || outcome.image.keptOriginal) {
    dispatch({ type: MediaActionType.Ready, id, original, upload: asPicked, previewUrl: null });
    return;
  }

  const { blob } = outcome.image;
  dispatch({
    type: MediaActionType.Ready,
    id,
    original,
    upload: { blob, contentType: ImageFormat.Jpeg, optimized: true },
    previewUrl: URL.createObjectURL(blob),
  });
}

/** Resolves with the converted clip, or null to fall back to the picked file. */
async function convertPickedVideo({ id, file, signal }: PickedFile, original: OriginalFile) {
  if (!canConvertVideos) {
    return null;
  }

  dispatch({ type: MediaActionType.OptimizeStarted, id, original });
  let shownPercent = -1;
  try {
    return await convertVideo(file, {
      signal,
      onProgress: (progress) => {
        // mediabunny reports every frame; the tile only needs whole percents.
        const percent = Math.floor(progress * 100);
        if (percent !== shownPercent) {
          shownPercent = percent;
          dispatch({ type: MediaActionType.OptimizeProgressed, id, progress: percent / 100 });
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
  const { id, file, signal } = picked;
  let facts: VideoMetadata & VideoFacts;
  try {
    facts = { ...(await readVideoMetadata(file)), bytes: file.size };
  } catch {
    // Not an MP4 or MOV mediabunny can open: the one check of a video's format.
    dispatch({ type: MediaActionType.Rejected, id, reason: RejectReason.UnsupportedVideoFormat });
    return;
  }

  if (signal.aborted) {
    return;
  }

  const tooLong = videoLengthProblem(facts.durationMs);
  if (tooLong) {
    dispatch({ type: MediaActionType.Rejected, id, reason: tooLong });
    return;
  }

  const original = { bytes: file.size, width: facts.width, height: facts.height };
  const problem = originalVideoProblem(facts);
  if (shouldConvertVideo(facts)) {
    const converted = await convertPickedVideo(picked, original);
    if (signal.aborted) {
      return;
    }
    // Same rule as photos: keep the picked file when converting did not make it smaller.
    if (converted && (problem || converted.size < file.size)) {
      const upload = { blob: converted, contentType: VideoFormat.Mp4, optimized: true };
      dispatch({ type: MediaActionType.Ready, id, original, upload, previewUrl: null });
      return;
    }
  }

  // Converting was not possible or not worth it: the file as picked, if the server takes it.
  if (problem) {
    dispatch({ type: MediaActionType.Rejected, id, reason: problem });
    return;
  }
  const upload = { blob: file, contentType: facts.format, optimized: false };
  dispatch({ type: MediaActionType.Ready, id, original, upload, previewUrl: null });
}

async function processPickedFile(picked: PickedFile, kind: MediaKind) {
  try {
    await (kind === MediaKind.Image ? takeImage(picked) : takeVideo(picked));
  } catch (error) {
    // Reading the file failed partway (the picker's copy went away); nothing else throws here.
    if (!picked.signal.aborted) {
      warn('could not read a picked file', error);
      dispatch({ type: MediaActionType.Rejected, id: picked.id, reason: RejectReason.Unreadable });
    }
  } finally {
    inProgress.delete(picked.id);
  }
}

function startWork(id: string, file: File, kind: MediaKind, photo: PhotoHeader | null) {
  const controller = new AbortController();
  inProgress.set(id, controller);
  void processPickedFile({ id, file, photo, signal: controller.signal }, kind);
}

/** A picked file refused at once, which never joins the draft. */
export interface RefusedFile {
  name: string;
  reason: RejectReason;
}

/**
 * Adds the picked files the listing can take to the draft, in order, and starts checking
 * them. Resolves with the ones refused from their first bytes or for lack of a slot, for
 * the form to say so: they never were on the listing, so they get no tile to remove.
 */
export async function addDraftFiles(files: File[]): Promise<RefusedFile[]> {
  const picked = await Promise.all(files.map((file) => new MediaDetector(file).detect()));

  // No await from here to the dispatch, so two quick picks cannot both take the last slot.
  const refusals = refusePicked(picked, acceptedCounts());
  const accepted = picked
    .map((detected, index) => ({
      ...detected,
      file: files[index],
      id: `local-${nextFileNumber++}`,
    }))
    .filter((_, index) => !refusals[index]);
  dispatch({
    type: MediaActionType.Added,
    items: accepted.map(({ id, file, kind }) => ({ id, file, kind })),
  });

  for (const { id, file, kind, photo } of accepted) {
    startWork(id, file, kind, photo);
  }

  return files.flatMap((file, index) => {
    const reason = refusals[index];
    return reason ? [{ name: file.name, reason }] : [];
  });
}

/**
 * Puts `file` in the place of draft file `id`, so a replaced cover stays the cover; the old
 * one is stopped and deleted on the server. Resolves with the new file when it is refused,
 * as addDraftFiles does; the old one then stays.
 */
export async function replaceDraftMedia(id: string, file: File): Promise<RefusedFile[]> {
  const detected = await new MediaDetector(file).detect();
  const replaced = findMedia(id);
  if (!replaced) {
    // Removed while the new file was read.
    return [];
  }

  const wrongKind =
    replaced.kind === MediaKind.Image
      ? RejectReason.UnsupportedImageFormat
      : RejectReason.UnsupportedVideoFormat;
  const reason = detected.kind === replaced.kind ? detected.problem : wrongKind;
  if (reason) {
    return [{ name: file.name, reason }];
  }

  stopWork(replaced);
  const newId = `local-${nextFileNumber++}`;
  dispatch({ type: MediaActionType.Replaced, id, item: { id: newId, file, kind: replaced.kind } });
  startWork(newId, file, replaced.kind, detected.photo);
  return [];
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
  dispatch({ type: MediaActionType.Removed, id });
}

/** "Huỷ tin": drops every file, and deletes the ones already on the server. */
export function clearDraftMedia() {
  useListingDraftStore.getState().media.forEach(stopWork);
  dispatch({ type: MediaActionType.Cleared });
}

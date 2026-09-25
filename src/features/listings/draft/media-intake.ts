/**
 * Takes the files the seller picks through checking and optimizing (diagrams 02, 02b, 03)
 * and writes each step into the draft store. Module-level rather than in a component, so
 * the work goes on while the seller is on another page.
 */

import {
  DraftMediaStatus,
  type MediaAction,
  type OriginalFile,
  type UploadSource,
} from '@/features/listings/draft/media-reducer';
import { useListingDraftStore } from '@/features/listings/draft/store';
import { canConvertVideos, convertVideo } from '@/features/media/convert-video';
import {
  FileFormat,
  FORMAT_HEAD_BYTES,
  IMAGE_HEAD_BYTES,
  readHead,
  readImageDimensions,
  sniffFormat,
} from '@/features/media/file-header';
import { ImageQueue } from '@/features/media/image/image-queue';
import { canOptimizeImages } from '@/features/media/image/image-worker';
import {
  admitByCount,
  checkImage,
  checkVideoLength,
  convertedVideoSize,
  formatProblem,
  MediaKind,
  mediaKindOf,
  originalVideoProblem,
  RejectReason,
  shouldConvertVideo,
  type VideoFacts,
} from '@/features/media/media-limits';
import { readVideoMetadata } from '@/features/media/video-metadata';

interface PickedFile {
  id: string;
  file: File;
  format: FileFormat;
}

const imageQueue = new ImageQueue();
const conversions = new Map<string, AbortController>();
let fileCount = 0;

const dispatch = (action: MediaAction) => useListingDraftStore.getState().dispatchMedia(action);

const findMedia = (id: string) =>
  useListingDraftStore.getState().media.find((media) => media.id === id);

async function readFormat(file: File) {
  try {
    return sniffFormat(await readHead(file, FORMAT_HEAD_BYTES));
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

async function takeImage({ id, file, format }: PickedFile) {
  const dimensions = readImageDimensions(await readHead(file, IMAGE_HEAD_BYTES));
  const reason = checkImage(file.size, dimensions);
  if (reason) {
    dispatch({ type: 'rejected', id, reason });
    return;
  }

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
  if (outcome.kind === 'cancelled' || findMedia(id)?.status !== DraftMediaStatus.Optimizing) {
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
async function convert(id: string, file: File, original: OriginalFile, facts: VideoFacts) {
  if (!canConvertVideos || !facts.width || !facts.height) {
    return null;
  }

  const controller = new AbortController();
  conversions.set(id, controller);
  dispatch({ type: 'optimizing', id, original });
  let shownPercent = 0;
  try {
    return await convertVideo(file, {
      ...convertedVideoSize(facts.width, facts.height),
      signal: controller.signal,
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
    if (!controller.signal.aborted) {
      console.warn('[media] video conversion failed, trying the original', error);
    }
    return null;
  } finally {
    conversions.delete(id);
  }
}

async function takeVideo({ id, file, format }: PickedFile) {
  let facts: VideoFacts;
  try {
    const { videoCodec, audioCodec, durationMs, width, height } = await readVideoMetadata(file);
    facts = { bytes: file.size, videoCodec, audioCodec, durationMs, width, height };
  } catch {
    dispatch({ type: 'rejected', id, reason: RejectReason.Unreadable });
    return;
  }
  const tooLong = checkVideoLength(facts.durationMs);
  if (tooLong) {
    dispatch({ type: 'rejected', id, reason: tooLong });
    return;
  }

  const original = { bytes: file.size, width: facts.width, height: facts.height };
  if (shouldConvertVideo(facts)) {
    const converted = await convert(id, file, original, facts);
    if (!findMedia(id)) {
      return;
    }
    if (converted) {
      const upload = { blob: converted, contentType: FileFormat.Mp4, optimized: true };
      dispatch({ type: 'ready', id, original, upload, previewUrl: null });
      return;
    }
  }

  // Same rule as photos: when converting is not possible, the file as picked, if the server takes it.
  const problem = originalVideoProblem(facts);
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
    console.warn('[media] could not read a picked file', error);
    dispatch({ type: 'rejected', id: picked.id, reason: RejectReason.Unreadable });
  }
}

/** Adds the picked files to the draft, in order, and starts checking them. */
export async function addDraftFiles(files: File[]) {
  const formats = await Promise.all(files.map(readFormat));

  // No await from here to the dispatch, so two quick picks cannot both take the last slot.
  const kinds = files.map((file, index) =>
    mediaKindOf(formats[index] ?? FileFormat.Unknown, file.type),
  );
  const formatProblems = kinds.map((kind, index) => formatProblem(kind, formats[index]));
  const countProblems = admitByCount(
    kinds.filter((_, index) => !formatProblems[index]),
    acceptedCounts(),
  );
  let counted = 0;
  const refusals = formatProblems.map((problem) => problem ?? countProblems[counted++]);

  const ids = files.map(() => `local-${++fileCount}`);
  dispatch({
    type: 'added',
    items: files.map((file, index) => ({ id: ids[index], file, kind: kinds[index] })),
  });

  files.forEach((file, index) => {
    const refusal = refusals[index];
    const format = formats[index];
    if (refusal || !format) {
      dispatch({ type: 'rejected', id: ids[index], reason: refusal ?? RejectReason.Unreadable });
    } else {
      void take({ id: ids[index], file, format }, kinds[index]);
    }
  });
}

/** Stops any work on the file, drops its result when it still arrives, and forgets it. */
export function removeDraftMedia(id: string) {
  imageQueue.cancel(id);
  conversions.get(id)?.abort();

  const media = findMedia(id);
  if (media?.status === DraftMediaStatus.ReadyToUpload && media.previewUrl) {
    URL.revokeObjectURL(media.previewUrl);
  }
  dispatch({ type: 'removed', id });
}

export function clearDraftMedia() {
  useListingDraftStore.getState().media.forEach((media) => removeDraftMedia(media.id));
}

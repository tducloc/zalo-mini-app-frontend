/**
 * Takes the files the seller picks through checking and optimizing (diagrams 02, 02b, 03)
 * into a draft store. Module-level rather than in a component, so the work goes on
 * while the seller is on another page. Also ends a draft, since that stops this work.
 * `createMediaIntake` works on any draft store: the sell page's draft has one (bottom of
 * the file), an edit page makes its own.
 */

import { draftUploads, type UploadService } from '@/features/listings/services/upload-media';
import {
  DraftMediaStatus,
  type OriginalFile,
  type UploadSource,
  type ListingMedia,
} from '@/features/listings/types/draft-media';
import { newDraftMedia } from '@/features/listings/utils/draft-media';
import { canConvertVideos, convertVideo } from '@/features/media/services/convert-video';
import { readVideoPoster } from '@/features/media/services/video-poster';
import { ImageQueue } from '@/features/media/services/image-queue';
import { canOptimizeImages } from '@/features/media/services/image-worker';
import { ImageFormat, type PhotoHeader } from '@/features/media/types/image';
import { MediaKind, RejectReason, type RefusedFile } from '@/features/media/types/media';
import { VideoFormat } from '@/features/media/types/video';
import { refusePicked } from '@/features/media/utils/media';
import { MediaDetector } from '@/features/media/utils/media-detector';
import {
  originalVideoProblem,
  readVideoMetadata,
  shouldConvertVideo,
  videoLengthProblem,
} from '@/features/media/utils/video';
import { type ListingDraftStore, useListingDraftStore } from '@/stores/listing-draft';
import { warnInDev } from '@/utils/dev-log';

interface PickedFile {
  id: string;
  file: File;
  /** Photos only: format and size from the header read when the file was picked. */
  photo: PhotoHeader | null;
  /** Aborted when the seller removes the file, at whatever step it has reached. */
  signal: AbortSignal;
}

/** One photo at a time for every draft: decoding two full-size photos at once risks memory. */
const imageQueue = new ImageQueue();
/** Local ids, unique across drafts. */
let nextFileNumber = 1;

const newLocalId = () => `local-${nextFileNumber++}`;

const warn = (message: string, error: unknown) => warnInDev('media', message, error);

/** Frees the photo preview's object URL. */
function revokePreview(media: ListingMedia) {
  if (media.previewUrl) {
    URL.revokeObjectURL(media.previewUrl);
  }
}

export interface MediaIntake {
  /**
   * Adds the picked files the listing can take to the draft, in order, and starts checking
   * them. Resolves with the ones refused from their first bytes or for lack of a slot: they
   * never join the listing, so the form says why in a toast.
   */
  addFiles: (files: File[]) => Promise<RefusedFile[]>;
  /** Removes the file from the draft; a result that still arrives is dropped. */
  removeMedia: (id: string) => void;
  /**
   * Stops every file's work and deletes the new uploads; media the draft started with (an
   * edit's) stays on the server. Leaves the store as it is.
   */
  stopAll: () => void;
  /** The server keeps the media (posted or saved): stops watching, deletes nothing. */
  forgetAll: () => void;
}

/** Picked files into one draft store, handed to its upload service once ready. */
export function createMediaIntake(store: ListingDraftStore, uploads: UploadService): MediaIntake {
  /** One per file still being worked on. */
  const inProgress = new Map<string, AbortController>();
  /** Goes up when the draft's work is stopped, so files still being read are dropped. */
  let generation = 0;

  const draft = () => store.getState();

  const update = (id: string, change: Partial<ListingMedia>) => draft().updateMedia(id, change);

  const reject = (id: string, reason: RejectReason) =>
    update(id, { status: DraftMediaStatus.Rejected, reason });

  /** Without `previewUrl`, keeps the one the tile has (a video's still, which may come first). */
  const markReady = (
    id: string,
    original: OriginalFile,
    upload: UploadSource,
    previewUrl?: string,
  ) =>
    update(id, {
      status: DraftMediaStatus.ReadyToUpload,
      original,
      upload,
      ...(previewUrl !== undefined && { previewUrl }),
      progress: null,
    });

  async function takeImage({ id, file, photo, signal }: PickedFile) {
    if (!photo?.format) {
      // MediaDetector refuses such a file first; never leave a tile on Checking.
      reject(id, RejectReason.UnsupportedImageFormat);
      return;
    }
    // As stored in the file, before EXIF orientation (api-spec, upload-urls).
    const original = { bytes: file.size, width: photo.width, height: photo.height };
    const asPicked: UploadSource = { blob: file, contentType: photo.format, optimized: false };
    if (!canOptimizeImages) {
      markReady(id, original, asPicked);
      return;
    }

    update(id, { status: DraftMediaStatus.Optimizing, original });
    const outcome = await imageQueue.optimize(file, signal);
    if (signal.aborted) {
      return;
    }

    // The worker could not shrink it: likely too big to decode here too.
    if (outcome.kind === 'original') {
      markReady(id, original, asPicked);
      return;
    }

    // Already small: the picked file is cheap to show as it is.
    if (outcome.image.keptOriginal) {
      markReady(id, original, asPicked, URL.createObjectURL(file));
      return;
    }

    const { blob } = outcome.image;
    const optimized = { blob, contentType: ImageFormat.Jpeg, optimized: true };
    markReady(id, original, optimized, URL.createObjectURL(blob));
  }

  /** Resolves with the converted clip, or null to fall back to the picked file. */
  async function convertPickedVideo({ id, file, signal }: PickedFile, original: OriginalFile) {
    if (!canConvertVideos) {
      return null;
    }

    update(id, { status: DraftMediaStatus.Optimizing, original, progress: 0 });
    let shownPercent = 0;
    try {
      return await convertVideo(file, {
        signal,
        onProgress: (progress) => {
          // mediabunny reports every frame; the tile only needs whole percents.
          const percent = Math.floor(progress * 100);
          if (percent !== shownPercent) {
            shownPercent = percent;
            update(id, { progress: percent / 100 });
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

  /** The video's first frame on its tile, while it is checked and converted. */
  async function showVideoStill({ id, file, signal }: PickedFile) {
    const still = await readVideoPoster(file).catch((error: unknown) => {
      warn('could not read the video still', error);
      return null;
    });
    if (!still || signal.aborted || !draft().media.some((media) => media.id === id)) {
      return;
    }
    update(id, { previewUrl: URL.createObjectURL(still) });
  }

  async function takeVideo(picked: PickedFile) {
    const { id, file, signal } = picked;
    void showVideoStill(picked);
    const metadata = await readVideoMetadata(file).catch(() => null);
    if (signal.aborted) {
      return;
    }

    if (!metadata) {
      // Not an MP4 or MOV mediabunny can open: the one check of a video's format.
      reject(id, RejectReason.UnsupportedVideoFormat);
      return;
    }

    const tooLong = videoLengthProblem(metadata.durationMs);
    if (tooLong) {
      reject(id, tooLong);
      return;
    }

    const facts = { ...metadata, bytes: file.size };
    const original = { bytes: file.size, width: facts.width, height: facts.height };
    const problem = originalVideoProblem(facts);
    if (shouldConvertVideo(facts)) {
      const converted = await convertPickedVideo(picked, original);
      if (signal.aborted) {
        return;
      }
      // Same rule as photos: keep the picked file when converting did not make it smaller.
      if (converted && (problem || converted.size < file.size)) {
        markReady(id, original, { blob: converted, contentType: VideoFormat.Mp4, optimized: true });
        return;
      }
    }

    // Converting was not possible or not worth it: the file as picked, if the server takes it.
    if (problem) {
      reject(id, problem);
      return;
    }
    markReady(id, original, { blob: file, contentType: facts.format, optimized: false });
  }

  function startWork(id: string, file: File, kind: MediaKind, photo: PhotoHeader | null) {
    const controller = new AbortController();
    inProgress.set(id, controller);
    const picked = { id, file, photo, signal: controller.signal };

    (kind === MediaKind.Image ? takeImage(picked) : takeVideo(picked))
      .catch((error: unknown) => {
        // Reading the file failed partway (the picker's copy went away).
        if (!controller.signal.aborted) {
          warn('could not read a picked file', error);
          reject(id, RejectReason.Unreadable);
        }
      })
      .finally(() => inProgress.delete(id));
  }

  /** Every tile holds its slot, a failed one too, until the seller removes it. */
  function takenSlots() {
    const counts = { [MediaKind.Image]: 0, [MediaKind.Video]: 0 };
    for (const media of draft().media) {
      counts[media.kind] += 1;
    }
    return counts;
  }

  async function addFiles(files: File[]): Promise<RefusedFile[]> {
    const { idempotencyKey } = draft();
    const startedIn = generation;
    const picked = await Promise.all(files.map((file) => new MediaDetector(file).detect()));
    // The draft ended (Huỷ tin, posted, the edit page closed) while the files were read:
    // they were for it.
    if (draft().idempotencyKey !== idempotencyKey || generation !== startedIn) {
      return [];
    }

    // No await from here to adding them, so two quick picks cannot both take the last slot.
    const refusals = refusePicked(picked, takenSlots());
    const accepted = picked
      .map((detected, index) => ({ ...detected, file: files[index] }))
      .filter((_, index) => !refusals[index])
      .map((detected) => ({ ...detected, id: newLocalId() }));
    draft().addMedia(accepted.map(({ id, kind, file }) => newDraftMedia(id, kind, file)));

    for (const { id, file, kind, photo } of accepted) {
      startWork(id, file, kind, photo);
    }

    return files.flatMap((file, index) => {
      const reason = refusals[index];
      return reason ? [{ name: file.name, reason }] : [];
    });
  }

  /** Stops checking, optimizing or converting the file, and frees its preview. */
  function stopLocalWork(media: ListingMedia) {
    inProgress.get(media.id)?.abort();
    inProgress.delete(media.id);
    revokePreview(media);
  }

  /** Stops the file's work at whatever step it is, and deletes what reached the server. */
  function stopWork(media: ListingMedia) {
    stopLocalWork(media);
    uploads.cancelUpload(media.id);
  }

  const findMedia = (id: string) => draft().media.find((media) => media.id === id);

  function removeMedia(id: string) {
    const media = findMedia(id);
    if (media) {
      stopWork(media);
    }
    draft().removeMedia(id);
  }

  function stopAll() {
    generation += 1;
    draft().media.forEach(stopWork);
  }

  function forgetAll() {
    generation += 1;
    draft().media.forEach(stopLocalWork);
    uploads.forgetUploads();
  }

  return { addFiles, removeMedia, stopAll, forgetAll };
}

/** The sell page's draft. */
export const draftIntake = createMediaIntake(useListingDraftStore, draftUploads);
/** For the media lab, which works on the sell page's draft. */
export const { addFiles: addDraftFiles, removeMedia: removeDraftMedia } = draftIntake;

/** Huỷ tin: stops every file's work and deletes the ones already on the server. */
export function discardDraft() {
  draftIntake.stopAll();
  useListingDraftStore.getState().reset();
}

/**
 * The listing was posted, or its key had already made one: the server keeps the media, so
 * nothing is deleted.
 */
export function forgetPostedDraft() {
  draftIntake.forgetAll();
  useListingDraftStore.getState().reset();
}

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { UploadService } from '@/features/listings/services/upload-media';
import { DraftMediaStatus, type ListingMedia } from '@/features/listings/types/draft-media';
import { RejectReason } from '@/features/media/types/media';
import { VideoFormat, type VideoMetadata } from '@/features/media/types/video';

const converter = vi.hoisted(() => ({ canConvertVideos: true, convertVideo: vi.fn() }));
vi.mock('@/features/media/services/convert-video', () => converter);
vi.mock('@/features/media/services/video-poster', () => ({
  readVideoPoster: vi.fn().mockRejectedValue(new Error('no still in tests')),
}));
const metadata = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('@/features/media/utils/video', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/media/utils/video')>()),
  readVideoMetadata: metadata.read,
}));
// An iPhone: the conversion must not depend on the platform.
vi.mock('zmp-sdk', () => ({ getSystemInfo: () => ({ platform: 'ios' }) }));

/** An MP4 as the picker hands it over: `ftyp` box first, so it is taken as a video. */
const pickedVideo = () =>
  new File([new Uint8Array([0, 0, 0, 24]), 'ftypisom', new Uint8Array(64)], 'clip.mp4');

function h264Clip(width: number, height: number): VideoMetadata {
  return {
    format: VideoFormat.Mp4,
    mimeType: 'video/mp4',
    videoCodec: 'avc',
    videoCodecString: 'avc1.640028',
    audioCodecs: ['aac'],
    durationMs: 20_000,
    width,
    height,
    rotation: 0,
  };
}

const EMPTY_FIELDS = {
  title: '',
  description: '',
  price: '',
  categoryId: '',
  condition: '' as const,
  locationId: '',
};

const uploads: UploadService = {
  start: () => () => {},
  retryUpload: vi.fn(),
  cancelUpload: vi.fn(),
  markUnusableMedia: vi.fn(),
  forgetUploads: vi.fn(),
};

async function pick(clip: VideoMetadata) {
  metadata.read.mockResolvedValue(clip);
  const { createListingDraftStore } = await import('@/stores/listing-draft');
  const { createMediaIntake } = await import('@/features/listings/services/add-media');
  const store = createListingDraftStore<ListingMedia>({ fields: EMPTY_FIELDS, media: [] });
  await createMediaIntake(store, uploads).addFiles([pickedVideo()]);
  await vi.waitFor(() =>
    expect(store.getState().media[0].status).not.toBe(DraftMediaStatus.Checking),
  );
  await vi.waitFor(() =>
    expect(store.getState().media[0].status).not.toBe(DraftMediaStatus.Optimizing),
  );
  return store.getState().media[0];
}

describe('a picked video above 1080p', () => {
  beforeEach(() => {
    converter.convertVideo.mockReset();
  });

  it('is converted down on any phone, and the converted file is uploaded', async () => {
    const converted = new Blob(['small'], { type: VideoFormat.Mp4 });
    converter.convertVideo.mockResolvedValue(converted);

    const media = await pick(h264Clip(3840, 2160));

    expect(converter.convertVideo).toHaveBeenCalledOnce();
    expect(media.status).toBe(DraftMediaStatus.ReadyToUpload);
    expect(media.upload).toEqual({
      blob: converted,
      contentType: VideoFormat.Mp4,
      optimized: true,
    });
  });

  it('is refused when the phone cannot convert it', async () => {
    converter.convertVideo.mockRejectedValue(new Error('encoder failed'));

    const media = await pick(h264Clip(3840, 2160));

    expect(media.status).toBe(DraftMediaStatus.Rejected);
    expect(media.reason).toBe(RejectReason.VideoResolution);
  });
});

it('a 1080p H.264 clip is uploaded as picked, without converting', async () => {
  converter.convertVideo.mockReset();

  const media = await pick(h264Clip(1920, 1080));

  expect(converter.convertVideo).not.toHaveBeenCalled();
  expect(media.status).toBe(DraftMediaStatus.ReadyToUpload);
  expect(media.upload?.optimized).toBe(false);
});

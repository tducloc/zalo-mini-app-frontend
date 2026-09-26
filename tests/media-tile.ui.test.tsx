import { describe, expect, it, vi } from 'vitest';

import {
  mediaErrorMessage,
  refusedFilesMessage,
  rejectMessage,
  tileLabels,
  uploadFailedMessages,
  uploadWaitMessages,
} from '@/features/listings/constants/messages';
import { DraftMediaStatus, type DraftMedia } from '@/features/listings/types/draft-media';
import { TileTone } from '@/features/listings/types/tile-view';
import { isFailed, newDraftMedia } from '@/features/listings/utils/draft-media';
import { tileView } from '@/features/listings/utils/tile-view';
import { MediaKind, RejectReason } from '@/features/media/types/media';
import { MediaError, ServerMediaStatus, UploadWait } from '@/features/media/types/upload';

vi.mock('zmp-ui', () => ({ Icon: () => null }));

const file = new File(['x'], 'x.jpg');
const base = newDraftMedia('a', MediaKind.Image, file);
const prepared = {
  ...base,
  original: { bytes: 1, width: 800, height: 600 },
  upload: { blob: file, contentType: 'image/jpeg', optimized: true },
  previewUrl: 'blob:preview',
};
const server = (status: ServerMediaStatus, error: MediaError | null = null) => ({
  status,
  thumbnailUrl: 'https://t/a.jpg',
  placeholder: null,
  error,
});

describe('tileView', () => {
  it('shows work in progress with a percentage where there is one', () => {
    expect(tileView({ ...base, status: DraftMediaStatus.Checking })).toMatchObject({
      tone: TileTone.Working,
      label: tileLabels.checking,
      progress: null,
    });
    const converting: DraftMedia = {
      ...base,
      kind: MediaKind.Video,
      status: DraftMediaStatus.Optimizing,
      original: prepared.original,
      progress: 0.35,
    };
    expect(tileView(converting)).toMatchObject({
      label: tileLabels.convertingVideo,
      progress: 0.35,
    });
    expect(
      tileView({ ...prepared, status: DraftMediaStatus.Uploading, progress: 0.5 }),
    ).toMatchObject({ tone: TileTone.Working, label: tileLabels.uploading, progress: 0.5 });
  });

  it('shows a wait for the network as a pause, not an error', () => {
    const waiting: DraftMedia = {
      ...prepared,
      status: DraftMediaStatus.Retrying,
      progress: 0.6,
      waitingFor: UploadWait.Network,
    };
    expect(tileView(waiting)).toMatchObject({
      tone: TileTone.Waiting,
      label: tileLabels.waitingNetwork,
      progress: 0.6,
      detail: uploadWaitMessages[UploadWait.Network],
      canRetry: false,
    });
  });

  it('offers retry only for an upload that another attempt can fix', () => {
    const failed = (isRetryable: boolean): DraftMedia => ({
      ...prepared,
      status: DraftMediaStatus.UploadFailed,
      isRetryable,
    });
    expect(tileView(failed(true))).toMatchObject({
      tone: TileTone.Error,
      detail: uploadFailedMessages.retryable,
      canRetry: true,
    });
    expect(tileView(failed(false))).toMatchObject({
      tone: TileTone.Error,
      detail: uploadFailedMessages.permanent,
      canRetry: false,
    });
  });

  it('explains a refusal found after the file joined the draft, and a server refusal', () => {
    const tooLong: DraftMedia = {
      ...base,
      status: DraftMediaStatus.Rejected,
      reason: RejectReason.VideoTooLong,
    };
    expect(tileView(tooLong)).toMatchObject({
      tone: TileTone.Error,
      detail: rejectMessage(RejectReason.VideoTooLong),
      imageUrl: null,
    });

    const blank: DraftMedia = {
      ...prepared,
      status: DraftMediaStatus.Uploaded,
      mediaId: 'm',
      server: server(ServerMediaStatus.Failed, MediaError.BlankImage),
    };
    expect(tileView(blank)).toMatchObject({
      tone: TileTone.Error,
      detail: mediaErrorMessage(MediaError.BlankImage),
      canRetry: false,
    });
  });

  it('shows the picture: the optimized photo first, else the server thumbnail', () => {
    const uploaded = (previewUrl: string | null): DraftMedia => ({
      ...prepared,
      previewUrl,
      status: DraftMediaStatus.Uploaded,
      mediaId: 'm',
      server: server(ServerMediaStatus.Ready),
    });
    expect(tileView(uploaded('blob:preview'))).toMatchObject({
      tone: TileTone.Done,
      label: null,
      imageUrl: 'blob:preview',
    });
    expect(tileView(uploaded(null)).imageUrl).toBe('https://t/a.jpg');
  });

  it('marks as an error exactly the files that failed', () => {
    const media: DraftMedia[] = [
      { ...base, status: DraftMediaStatus.Checking },
      { ...prepared, id: 'b', status: DraftMediaStatus.UploadFailed, isRetryable: true },
      { ...base, id: 'c', status: DraftMediaStatus.Rejected, reason: RejectReason.Unreadable },
      {
        ...prepared,
        id: 'd',
        status: DraftMediaStatus.Retrying,
        progress: 0.2,
        waitingFor: UploadWait.Network,
      },
      {
        ...prepared,
        id: 'e',
        status: DraftMediaStatus.Uploaded,
        mediaId: 'm',
        server: server(ServerMediaStatus.Failed, MediaError.BlankImage),
      },
    ];
    expect(media.filter(isFailed).map((item) => item.id)).toEqual(['b', 'c', 'e']);
    for (const item of media) {
      expect(tileView(item).tone === TileTone.Error).toBe(isFailed(item));
    }
  });
});

describe('refusedFilesMessage', () => {
  it('says each reason once, with the files it refused', () => {
    const message = refusedFilesMessage([
      { name: 'a.jpg', reason: RejectReason.TooManyImages },
      { name: 'b.jpg', reason: RejectReason.TooManyImages },
      { name: 'c.jpg', reason: RejectReason.TooManyImages },
      { name: 'doc.pdf', reason: RejectReason.UnsupportedImageFormat },
    ]);
    expect(message).toBe(
      'Vui lòng chọn tối đa 10 ảnh cho mỗi tin (a.jpg, b.jpg và 1 tệp khác). ' +
        'Vui lòng chọn ảnh JPG, PNG hoặc WebP (doc.pdf).',
    );
  });
});

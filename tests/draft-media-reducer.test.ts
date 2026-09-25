import { describe, expect, it } from 'vitest';

import {
  type DraftMedia,
  DraftMediaStatus,
  type MediaAction,
  mediaReducer,
} from '@/features/listings/draft/media-reducer';
import { MediaKind, RejectReason } from '@/features/media/media-limits';
import { UploadWait } from '@/features/media/upload/file-upload';
import { ServerMediaStatus } from '@/features/media/upload/upload-types';

const photo = new File(['x'], 'a.jpg');
const video = new File(['x'], 'b.mov');
const original = { bytes: 3_000_000, width: 4032, height: 3024 };
const upload = { blob: new Blob(['jpeg']), contentType: 'image/jpeg', optimized: true };

function run(...actions: MediaAction[]) {
  return actions.reduce<DraftMedia[]>(mediaReducer, []);
}

const added: MediaAction = {
  type: 'added',
  items: [
    { id: 'p1', kind: MediaKind.Image, file: photo },
    { id: 'v1', kind: MediaKind.Video, file: video },
  ],
};

describe('mediaReducer', () => {
  it('adds picked files in order, as checking', () => {
    const state = run(added);
    expect(state.map((media) => [media.id, media.status])).toEqual([
      ['p1', DraftMediaStatus.Checking],
      ['v1', DraftMediaStatus.Checking],
    ]);
  });

  it('takes a photo through optimizing to ready', () => {
    const state = run(
      added,
      { type: 'optimizing', id: 'p1', original },
      { type: 'ready', id: 'p1', original, upload, previewUrl: 'blob:1' },
    );
    expect(state[0]).toMatchObject({
      status: DraftMediaStatus.ReadyToUpload,
      upload,
      previewUrl: 'blob:1',
    });
  });

  it('marks a file ready straight from checking, when there is nothing to optimize', () => {
    const state = run(added, { type: 'ready', id: 'v1', original, upload, previewUrl: null });
    expect(state[1].status).toBe(DraftMediaStatus.ReadyToUpload);
  });

  it('tracks conversion progress only while optimizing', () => {
    const converting = run(
      added,
      { type: 'optimizing', id: 'v1', original },
      { type: 'progressed', id: 'v1', progress: 0.4 },
    );
    expect(converting[1]).toMatchObject({ status: DraftMediaStatus.Optimizing, progress: 0.4 });

    const checking = run(added, { type: 'progressed', id: 'v1', progress: 0.4 });
    expect(checking).toEqual(run(added));
  });

  it('rejects while checking or optimizing, keeping the reason', () => {
    const state = run(
      added,
      { type: 'rejected', id: 'p1', reason: RejectReason.Heic },
      { type: 'optimizing', id: 'v1', original },
      { type: 'rejected', id: 'v1', reason: RejectReason.VideoResolution },
    );
    expect(state[0]).toMatchObject({
      status: DraftMediaStatus.Rejected,
      reason: RejectReason.Heic,
    });
    expect(state[1]).toMatchObject({
      status: DraftMediaStatus.Rejected,
      reason: RejectReason.VideoResolution,
    });
  });

  it('ignores a late result for a removed file', () => {
    const state = run(
      added,
      { type: 'optimizing', id: 'p1', original },
      { type: 'removed', id: 'p1' },
      { type: 'ready', id: 'p1', original, upload, previewUrl: 'blob:1' },
    );
    expect(state.map((media) => media.id)).toEqual(['v1']);
  });

  it('never moves a finished file back', () => {
    const ready = run(added, { type: 'ready', id: 'p1', original, upload, previewUrl: null });
    const rejectedLate = mediaReducer(ready, {
      type: 'rejected',
      id: 'p1',
      reason: RejectReason.UnsupportedFormat,
    });
    expect(rejectedLate).toBe(ready);

    const rejected = run(added, { type: 'rejected', id: 'p1', reason: RejectReason.Heic });
    expect(mediaReducer(rejected, { type: 'optimizing', id: 'p1', original })).toBe(rejected);
  });

  it('clears the whole draft', () => {
    expect(run(added, { type: 'cleared' })).toEqual([]);
  });
});

describe('mediaReducer, uploading', () => {
  const ready: MediaAction = { type: 'ready', id: 'p1', original, upload, previewUrl: 'blob:1' };
  const processing = {
    status: ServerMediaStatus.Processing,
    thumbnailUrl: null,
    placeholder: null,
    error: null,
  };

  it('takes a ready file through uploading to uploaded, keeping what it carries', () => {
    const state = run(
      added,
      ready,
      { type: 'uploadStarted', id: 'p1' },
      { type: 'progressed', id: 'p1', progress: 0.5 },
      { type: 'uploaded', id: 'p1', mediaId: 'm1', server: processing },
    );
    expect(state[0]).toMatchObject({
      status: DraftMediaStatus.Uploaded,
      mediaId: 'm1',
      server: processing,
      upload,
      previewUrl: 'blob:1',
    });
  });

  it('keeps the progress while waiting and when the next attempt starts', () => {
    const waiting = run(
      added,
      ready,
      { type: 'uploadStarted', id: 'p1' },
      { type: 'progressed', id: 'p1', progress: 0.6 },
      { type: 'uploadWaiting', id: 'p1', waitingFor: UploadWait.Network },
    );
    expect(waiting[0]).toMatchObject({
      status: DraftMediaStatus.Retrying,
      progress: 0.6,
      waitingFor: UploadWait.Network,
    });

    const resumed = mediaReducer(waiting, { type: 'uploadResumed', id: 'p1' });
    expect(resumed[0]).toMatchObject({ status: DraftMediaStatus.Uploading, progress: 0.6 });
  });

  it('ignores progress while waiting, so a late byte count cannot hide the wait', () => {
    const waiting = run(
      added,
      ready,
      { type: 'uploadStarted', id: 'p1' },
      { type: 'uploadWaiting', id: 'p1', waitingFor: UploadWait.Retry },
    );
    expect(mediaReducer(waiting, { type: 'progressed', id: 'p1', progress: 0.9 })).toBe(waiting);
  });

  it('lets the seller retry a failed upload', () => {
    const failed = run(
      added,
      ready,
      { type: 'uploadStarted', id: 'p1' },
      { type: 'uploadFailed', id: 'p1', isRetryable: true },
    );
    expect(failed[0]).toMatchObject({ status: DraftMediaStatus.UploadFailed, isRetryable: true });

    const retried = mediaReducer(failed, { type: 'uploadStarted', id: 'p1' });
    expect(retried[0].status).toBe(DraftMediaStatus.Uploading);
  });

  it('follows the server status only once uploaded', () => {
    const readyState = run(added, ready);
    const failedServer = { ...processing, status: ServerMediaStatus.Failed, error: 'BLANK_IMAGE' };
    expect(
      mediaReducer(readyState, { type: 'serverUpdated', id: 'p1', server: failedServer }),
    ).toBe(readyState);

    const uploaded = run(
      added,
      ready,
      { type: 'uploadStarted', id: 'p1' },
      { type: 'uploaded', id: 'p1', mediaId: 'm1', server: processing },
      { type: 'serverUpdated', id: 'p1', server: failedServer },
    );
    expect(uploaded[0]).toMatchObject({ status: DraftMediaStatus.Uploaded, server: failedServer });
  });

  it('never starts uploading a file that is not ready, nor restarts an uploaded one', () => {
    const optimizing = run(added, { type: 'optimizing', id: 'p1', original });
    expect(mediaReducer(optimizing, { type: 'uploadStarted', id: 'p1' })).toBe(optimizing);

    const uploaded = run(
      added,
      ready,
      { type: 'uploadStarted', id: 'p1' },
      { type: 'uploaded', id: 'p1', mediaId: 'm1', server: processing },
    );
    expect(mediaReducer(uploaded, { type: 'uploadStarted', id: 'p1' })).toBe(uploaded);
    expect(mediaReducer(uploaded, { type: 'uploadFailed', id: 'p1', isRetryable: true })).toBe(
      uploaded,
    );
  });
});

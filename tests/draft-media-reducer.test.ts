import { describe, expect, it } from 'vitest';

import {
  type DraftMedia,
  DraftMediaStatus,
  type MediaAction,
  mediaReducer,
} from '@/features/listings/draft/media-reducer';
import { MediaKind, RejectReason } from '@/features/media/media-limits';

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

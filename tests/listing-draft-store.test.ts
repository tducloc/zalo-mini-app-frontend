import { beforeEach, describe, expect, it } from 'vitest';

import { DraftMediaStatus } from '@/features/listings/types/draft-media';
import { isFailed, newDraftMedia } from '@/features/listings/utils/draft-media';
import { MediaKind, RejectReason } from '@/features/media/types/media';
import { ServerMediaStatus } from '@/features/media/types/upload';
import { useListingDraftStore } from '@/stores/listing-draft';

const file = new File(['x'], 'a.jpg');
const photo = (id: string) => newDraftMedia(id, MediaKind.Image, file);
const draft = () => useListingDraftStore.getState();
const ids = () => draft().media.map((media) => media.id);

beforeEach(() => draft().reset());

describe('listing draft store', () => {
  it('adds files in order and changes one by its id', () => {
    draft().addMedia([photo('p1'), photo('p2')]);
    draft().updateMedia('p2', { status: DraftMediaStatus.Uploading, progress: 0.5 });

    expect(draft().media[1]).toMatchObject({ status: DraftMediaStatus.Uploading, progress: 0.5 });
    expect(draft().media[0].status).toBe(DraftMediaStatus.Checking);
  });

  it('drops a change for a file removed meanwhile', () => {
    draft().addMedia([photo('p1')]);
    draft().removeMedia('p1');
    draft().updateMedia('p1', { status: DraftMediaStatus.Uploaded });

    expect(draft().media).toEqual([]);
  });

  it('moves a photo to where another is, so a photo dragged first becomes the cover', () => {
    const video = newDraftMedia('v1', MediaKind.Video, file);
    draft().addMedia([photo('p1'), photo('p2'), video, photo('p3')]);

    draft().moveMedia('p3', 'p1');
    expect(ids()).toEqual(['p3', 'p1', 'p2', 'v1']);

    draft().moveMedia('p3', 'p2');
    expect(ids()).toEqual(['p1', 'p2', 'p3', 'v1']);
  });

  it('ignores a move for a file removed meanwhile', () => {
    draft().addMedia([photo('p1'), photo('p2')]);
    draft().moveMedia('gone', 'p1');

    expect(ids()).toEqual(['p1', 'p2']);
  });

  it('starts an empty draft with a new key', () => {
    const key = draft().idempotencyKey;
    draft().addMedia([photo('p1')]);
    draft().setFields({ title: 'Bàn gỗ' });
    draft().reset();

    expect(draft()).toMatchObject({ media: [], fields: { title: '' }, isPosting: false });
    expect(draft().idempotencyKey).not.toBe(key);
  });
});

describe('isFailed', () => {
  it('is a refusal, a failed upload or a file the server failed, not a wait', () => {
    const base = photo('p');
    expect(
      isFailed({ ...base, status: DraftMediaStatus.Rejected, reason: RejectReason.Unreadable }),
    ).toBe(true);
    expect(isFailed({ ...base, status: DraftMediaStatus.UploadFailed })).toBe(true);
    expect(
      isFailed({
        ...base,
        status: DraftMediaStatus.Uploaded,
        server: {
          status: ServerMediaStatus.Failed,
          thumbnailUrl: null,
          placeholder: null,
          error: null,
        },
      }),
    ).toBe(true);
    expect(isFailed({ ...base, status: DraftMediaStatus.Retrying })).toBe(false);
    expect(isFailed(base)).toBe(false);
  });
});

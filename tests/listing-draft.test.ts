import { describe, expect, it } from 'vitest';

import { EMPTY_FIELDS } from '@/features/listings/constants/listing-fields';
import { DraftMediaStatus, type DraftMedia } from '@/features/listings/types/draft-media';
import { PostBlocker } from '@/features/listings/types/listing-draft';
import { newDraftMedia } from '@/features/listings/utils/draft-media';
import {
  hasDraft,
  mediaIdsForPost,
  newIdempotencyKey,
  postBlocker,
} from '@/features/listings/utils/listing-draft';
import { MediaKind, RejectReason } from '@/features/media/types/media';
import { MediaError, ServerMediaStatus } from '@/features/media/types/upload';

const file = new File(['x'], 'x');
const server = {
  status: ServerMediaStatus.Processing,
  thumbnailUrl: null,
  placeholder: null,
  error: null,
};

const uploaded = (id: string, kind = MediaKind.Image): DraftMedia => ({
  ...newDraftMedia(id, kind, file),
  status: DraftMediaStatus.Uploaded,
  mediaId: `m-${id}`,
  server,
});
const uploading = (id: string): DraftMedia => ({
  ...newDraftMedia(id, MediaKind.Image, file),
  status: DraftMediaStatus.Uploading,
  progress: 0.5,
});
const rejected = (id: string, kind = MediaKind.Image): DraftMedia => ({
  ...newDraftMedia(id, kind, file),
  status: DraftMediaStatus.Rejected,
  reason: RejectReason.UnsupportedImageFormat,
});

describe('postBlocker', () => {
  it('lets a draft post once every file is uploaded, even still processing', () => {
    expect(postBlocker([uploaded('a'), uploaded('v', MediaKind.Video)])).toBeNull();
  });

  it('asks for a photo: the cover is required', () => {
    expect(postBlocker([])).toBe(PostBlocker.NoPhoto);
    expect(postBlocker([uploaded('v', MediaKind.Video)])).toBe(PostBlocker.NoPhoto);
  });

  it('waits for files still on their way', () => {
    expect(postBlocker([uploaded('a'), uploading('b')])).toBe(PostBlocker.Working);
  });

  it('asks the seller to deal with a failed file first', () => {
    const failedUpload = { ...uploading('b'), status: DraftMediaStatus.UploadFailed };
    const serverFailed = {
      ...uploaded('c'),
      server: { ...server, status: ServerMediaStatus.Failed, error: MediaError.BlankImage },
    };
    expect(postBlocker([uploaded('a'), rejected('b')])).toBe(PostBlocker.NeedsAttention);
    expect(postBlocker([uploaded('a'), failedUpload, uploading('d')])).toBe(
      PostBlocker.NeedsAttention,
    );
    expect(postBlocker([serverFailed])).toBe(PostBlocker.NeedsAttention);
  });
});

describe('mediaIdsForPost', () => {
  it('sends the photos in the draft order, then the video', () => {
    const media = [uploaded('v', MediaKind.Video), uploaded('p2'), uploaded('p1')];
    expect(mediaIdsForPost(media)).toEqual(['m-p2', 'm-p1', 'm-v']);
  });
});

describe('newIdempotencyKey', () => {
  it('makes a new key the API accepts each time', () => {
    const key = newIdempotencyKey();
    expect(key).toMatch(/^[A-Za-z0-9_-]{8,100}$/);
    expect(newIdempotencyKey()).not.toBe(key);
  });
});

describe('hasDraft', () => {
  it('is a field filled or a file picked; spaces alone are nothing', () => {
    expect(hasDraft(EMPTY_FIELDS, [])).toBe(false);
    expect(hasDraft({ ...EMPTY_FIELDS, title: '  ' }, [])).toBe(false);
    expect(hasDraft({ ...EMPTY_FIELDS, title: 'Bàn gỗ' }, [])).toBe(true);
    expect(hasDraft(EMPTY_FIELDS, [rejected('a')])).toBe(true);
  });
});

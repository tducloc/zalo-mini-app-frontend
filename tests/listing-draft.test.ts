import { describe, expect, it } from 'vitest';

import {
  EMPTY_FIELDS,
  hasDraft,
  mediaIdsForPost,
  newIdempotencyKey,
  PostBlocker,
  postBlocker,
} from '@/features/listings/draft/listing-draft';
import { type DraftMedia, DraftMediaStatus } from '@/features/listings/draft/media-reducer';
import { MediaKind, RejectReason } from '@/features/media/media-utils';
import { MediaError, ServerMediaStatus } from '@/features/media/upload/upload-types';

const file = new File(['x'], 'x');
const prepared = {
  file,
  original: { bytes: 1, width: 800, height: 600 },
  upload: { blob: file, contentType: 'image/jpeg', optimized: true },
  previewUrl: null,
};
const server = {
  status: ServerMediaStatus.Processing,
  thumbnailUrl: null,
  placeholder: null,
  error: null,
};

const uploaded = (id: string, kind = MediaKind.Image): DraftMedia => ({
  ...prepared,
  id,
  kind,
  status: DraftMediaStatus.Uploaded,
  mediaId: `m-${id}`,
  server,
});
const uploading = (id: string): DraftMedia => ({
  ...prepared,
  id,
  kind: MediaKind.Image,
  status: DraftMediaStatus.Uploading,
  progress: 0.5,
});
const rejected = (id: string, kind = MediaKind.Image): DraftMedia => ({
  id,
  kind,
  file,
  status: DraftMediaStatus.Rejected,
  reason: RejectReason.ImageTooSmall,
});

describe('hasDraft', () => {
  it('is empty until a field is filled or a file picked', () => {
    expect(hasDraft(EMPTY_FIELDS, [])).toBe(false);
    expect(hasDraft({ ...EMPTY_FIELDS, title: '   ' }, [])).toBe(false);
    expect(hasDraft({ ...EMPTY_FIELDS, price: '5' }, [])).toBe(true);
    expect(hasDraft(EMPTY_FIELDS, [rejected('a')])).toBe(true);
  });
});

describe('postBlocker', () => {
  it('lets a draft post once every kept file is uploaded, even still processing', () => {
    expect(postBlocker([uploaded('a'), uploaded('v', MediaKind.Video)])).toBeNull();
  });

  it('asks for a photo: the cover is required', () => {
    expect(postBlocker([])).toBe(PostBlocker.NoPhoto);
    expect(postBlocker([uploaded('v', MediaKind.Video)])).toBe(PostBlocker.NoPhoto);
    expect(postBlocker([rejected('a')])).toBe(PostBlocker.NoPhoto);
  });

  it('waits for files still on their way', () => {
    expect(postBlocker([uploaded('a'), uploading('b')])).toBe(PostBlocker.Working);
  });

  it('ignores refused files, which are not sent', () => {
    expect(postBlocker([uploaded('a'), rejected('b')])).toBeNull();
  });

  it('asks the seller to deal with a failed upload or a file the server refused first', () => {
    const failedUpload: DraftMedia = {
      ...prepared,
      id: 'b',
      kind: MediaKind.Image,
      status: DraftMediaStatus.UploadFailed,
      isRetryable: true,
    };
    const serverFailed: DraftMedia = {
      ...(uploaded('c') as Extract<DraftMedia, { status: DraftMediaStatus.Uploaded }>),
      server: { ...server, status: ServerMediaStatus.Failed, error: MediaError.BlankImage },
    };
    expect(postBlocker([uploaded('a'), failedUpload, uploading('d')])).toBe(
      PostBlocker.NeedsAttention,
    );
    expect(postBlocker([serverFailed])).toBe(PostBlocker.NeedsAttention);
  });
});

describe('mediaIdsForPost', () => {
  it('sends the photos in the draft order, then the video, and leaves out refused files', () => {
    const media = [uploaded('v', MediaKind.Video), uploaded('p2'), rejected('x'), uploaded('p1')];
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

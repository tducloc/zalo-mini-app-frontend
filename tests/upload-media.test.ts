import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TileTone } from '@/features/listings/types/tile-view';
import { tileView } from '@/features/listings/utils/tile-view';
import { MediaKind } from '@/features/media/types/media';
import type { RegisteredUpload, UploadRequestFile } from '@/features/media/types/upload';

// The network, replaced: the real modules run against these.
const api = vi.hoisted(() => ({
  registerUploads: vi.fn(),
  refreshUploadUrl: vi.fn(),
  completeParts: vi.fn(),
  completeUpload: vi.fn(),
  deleteMedia: vi.fn(),
}));
const storage = vi.hoisted(() => ({ putBlob: vi.fn() }));

// Only the HTTP calls are replaced; the real browser transport runs on top of them.
vi.mock('@/features/media/api/media-uploads', () => ({ ...api, putBlob: storage.putBlob }));

const LATER = '2099-01-01T00:00:00Z';
const file = new File(['0123456789'], 'photo.jpg');

type Modules = Awaited<ReturnType<typeof loadModules>>;

async function loadModules() {
  const { useListingDraftStore } = await import('@/stores/listing-draft');
  const upload = await import('@/features/listings/services/upload-media');
  const { UploadFailure } = await import('@/features/media/utils/retry-policy');
  const { newDraftMedia } = await import('@/features/listings/utils/draft-media');
  const { DraftMediaStatus } = await import('@/features/listings/types/draft-media');
  const { FailureKind, ServerMediaStatus, MediaError } =
    await import('@/features/media/types/upload');
  return {
    useListingDraftStore,
    upload,
    FailureKind,
    UploadFailure,
    DraftMediaStatus,
    newDraftMedia,
    ServerMediaStatus,
    MediaError,
  };
}

let modules: Modules;

const media = () => modules.useListingDraftStore.getState().media;
const find = (id: string) => media().find((item) => item.id === id);
const statusOf = (id: string) => find(id)?.status;

function addPhotos(...ids: string[]) {
  modules.useListingDraftStore
    .getState()
    .addMedia(ids.map((id) => modules.newDraftMedia(id, MediaKind.Image, file)));
}

function markReady(id: string) {
  modules.useListingDraftStore.getState().updateMedia(id, {
    status: modules.DraftMediaStatus.ReadyToUpload,
    original: { bytes: 10, width: 800, height: 600 },
    upload: { blob: file, contentType: 'image/jpeg', optimized: true },
  });
}

const targetFor = (request: UploadRequestFile): RegisteredUpload => ({
  type: MediaKind.Image,
  clientFileId: request.clientFileId,
  mediaId: `m-${request.clientFileId}`,
  objectKey: `uploads/u/m-${request.clientFileId}`,
  expiresAt: LATER,
  presignedUrl: `put://${request.clientFileId}`,
});

/** A promise and the function that settles it, to hold a request open. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('window', new EventTarget());
  for (const mock of [...Object.values(api), storage.putBlob]) {
    mock.mockReset();
  }
  api.registerUploads.mockImplementation(async (files: UploadRequestFile[]) =>
    files.map(targetFor),
  );
  api.refreshUploadUrl.mockImplementation(async (mediaId: string) => ({
    type: MediaKind.Image,
    mediaId,
    objectKey: `uploads/u/${mediaId}`,
    expiresAt: LATER,
    presignedUrl: `put://${mediaId}-fresh`,
  }));
  api.completeUpload.mockResolvedValue('PROCESSING');
  api.deleteMedia.mockResolvedValue(undefined);
  storage.putBlob.mockResolvedValue('"etag"');
  modules = await loadModules();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('media-upload', () => {
  it('uploads at most 2 files at once, in the order picked', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const started: string[] = [];
    storage.putBlob.mockImplementation(async (url: string) => {
      started.push(url);
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return '"etag"';
    });

    addPhotos('a', 'b', 'c', 'd');
    ['a', 'b', 'c', 'd'].forEach(markReady);

    await vi.waitFor(() =>
      expect(media().every((item) => item.status === modules.DraftMediaStatus.Uploaded)).toBe(true),
    );
    expect(maxInFlight).toBe(2);
    expect(started).toEqual(['put://a', 'put://b', 'put://c', 'put://d']);
    // One URL request per file, right before its upload.
    expect(api.registerUploads).toHaveBeenCalledTimes(4);
  });

  it('deletes a file removed while it was asking for its upload URL', async () => {
    const single = deferred<unknown>();
    api.registerUploads.mockImplementationOnce(async (files: UploadRequestFile[]) => {
      await single.promise;
      return files.map(targetFor);
    });

    addPhotos('a');
    markReady('a');
    await vi.waitFor(() => expect(api.registerUploads).toHaveBeenCalledTimes(1));
    modules.upload.draftUploads.cancelUpload('a');
    single.resolve(null);

    await vi.waitFor(() => expect(api.deleteMedia).toHaveBeenCalledWith('m-a'));
    expect(storage.putBlob).not.toHaveBeenCalled();
  });

  it('uploads again on Retry, and ignores a second tap', async () => {
    storage.putBlob.mockRejectedValueOnce(
      new modules.UploadFailure(modules.FailureKind.Rejected, 'refused'),
    );

    addPhotos('a');
    markReady('a');
    await vi.waitFor(() => expect(statusOf('a')).toBe(modules.DraftMediaStatus.UploadFailed));

    modules.upload.draftUploads.retryUpload('a');
    modules.upload.draftUploads.retryUpload('a');

    await vi.waitFor(() => expect(statusOf('a')).toBe(modules.DraftMediaStatus.Uploaded));
    expect(api.completeUpload).toHaveBeenCalledTimes(1);
  });

  it('shows a file as done once complete answers, and asks nothing more', async () => {
    vi.useFakeTimers();
    addPhotos('a');
    markReady('a');
    await vi.advanceTimersByTimeAsync(0);
    const item = find('a');
    expect(item?.status).toBe(modules.DraftMediaStatus.Uploaded);
    expect(tileView(item!).tone).toBe(TileTone.Done);

    const calls = [...Object.values(api), storage.putBlob].map((mock) => mock.mock.calls.length);
    await vi.advanceTimersByTimeAsync(60_000);
    expect([...Object.values(api), storage.putBlob].map((mock) => mock.mock.calls.length)).toEqual(
      calls,
    );
  });

  it('shows a file complete answered FAILED for as failed, with no reason yet', async () => {
    api.completeUpload.mockResolvedValue('FAILED');
    addPhotos('a');
    markReady('a');

    await vi.waitFor(() => expect(statusOf('a')).toBe(modules.DraftMediaStatus.Uploaded));
    expect(find('a')?.server).toMatchObject({
      status: modules.ServerMediaStatus.Failed,
      error: null,
    });
    expect(tileView(find('a')!).tone).toBe(TileTone.Error);
  });

  it("forgets a posted draft's uploads without deleting them", async () => {
    addPhotos('a');
    markReady('a');
    await vi.waitFor(() => expect(statusOf('a')).toBe(modules.DraftMediaStatus.Uploaded));

    modules.upload.draftUploads.forgetUploads();
    modules.useListingDraftStore.getState().reset();

    expect(api.deleteMedia).not.toHaveBeenCalled();
  });

  it('marks the files a post was refused for (409) with their reasons, and only those', () => {
    const { ServerMediaStatus, MediaError, DraftMediaStatus } = modules;
    addPhotos('a', 'b');
    const server = {
      status: ServerMediaStatus.Ready,
      thumbnailUrl: 't',
      error: null,
    };
    addPhotos('c');
    for (const id of ['a', 'b', 'c']) {
      modules.useListingDraftStore
        .getState()
        .updateMedia(id, { status: DraftMediaStatus.Uploaded, mediaId: `m-${id}`, server });
    }

    modules.upload.draftUploads.markUnusableMedia([
      { mediaId: 'm-b', error: MediaError.VideoNotPlayable },
      { mediaId: 'm-c', error: MediaError.Missing },
      { mediaId: 'm-unknown', error: MediaError.Missing },
    ]);

    expect(find('a')?.server).toEqual(server);
    expect(find('b')?.server).toEqual({
      ...server,
      status: ServerMediaStatus.Failed,
      error: MediaError.VideoNotPlayable,
    });
    expect(find('c')?.server).toEqual({
      ...server,
      status: ServerMediaStatus.Failed,
      error: MediaError.Missing,
    });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DraftMedia } from '@/features/listings/draft/media-reducer';
import { MediaKind } from '@/features/media/media-utils';
import type { UploadRequestFile } from '@/features/media/upload/upload-types';

// The network, replaced: the real module runs against these.
const api = vi.hoisted(() => ({
  registerUploads: vi.fn(),
  refreshUploadUrl: vi.fn(),
  completeParts: vi.fn(),
  completeUpload: vi.fn(),
  fetchMediaStatuses: vi.fn(),
  deleteMedia: vi.fn(),
}));
const storage = vi.hoisted(() => ({ putBlob: vi.fn() }));

vi.mock('@/features/media/upload/upload-api', () => ({
  ...api,
  putBlob: storage.putBlob,
  // The real transport's shape, over the mocks above.
  browserTransport: {
    register: async (file: UploadRequestFile) => (await api.registerUploads([file]))[0],
    refresh: api.refreshUploadUrl,
    put: storage.putBlob,
    completeParts: api.completeParts,
    complete: api.completeUpload,
    isOnline: () => true,
    waitForNetwork: async () => {},
    now: () => Date.now(),
  },
}));

const LATER = '2099-01-01T00:00:00Z';
const file = new File(['0123456789'], 'photo.jpg');

type Modules = Awaited<ReturnType<typeof loadModules>>;

async function loadModules() {
  const { useListingDraftStore } = await import('@/features/listings/draft/store');
  const upload = await import('@/features/listings/draft/media-upload');
  const { FailureKind, UploadFailure } = await import('@/features/media/upload/retry-policy');
  const { DraftMediaStatus, MediaActionType } =
    await import('@/features/listings/draft/media-reducer');
  const { ServerMediaStatus, MediaError } = await import('@/features/media/upload/upload-types');
  return {
    useListingDraftStore,
    upload,
    FailureKind,
    UploadFailure,
    DraftMediaStatus,
    MediaActionType,
    ServerMediaStatus,
    MediaError,
  };
}

let modules: Modules;

const media = () => modules.useListingDraftStore.getState().media;
const find = (id: string) => media().find((item) => item.id === id) as DraftMedia;
const statusOf = (id: string) => find(id)?.status;

function addPhotos(...ids: string[]) {
  const dispatch = modules.useListingDraftStore.getState().dispatchMedia;
  dispatch({
    type: modules.MediaActionType.Added,
    items: ids.map((id) => ({ id, kind: MediaKind.Image, file })),
  });
}

function markReady(id: string) {
  modules.useListingDraftStore.getState().dispatchMedia({
    type: modules.MediaActionType.Ready,
    id,
    original: { bytes: 10, width: 800, height: 600 },
    upload: { blob: file, contentType: 'image/jpeg', optimized: true },
    previewUrl: null,
  });
}

const targetFor = (request: UploadRequestFile) => ({
  clientFileId: request.clientFileId,
  mediaId: `m-${request.clientFileId}`,
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
    mediaId,
    expiresAt: LATER,
    presignedUrl: `put://${mediaId}-fresh`,
  }));
  api.completeUpload.mockResolvedValue('PROCESSING');
  api.fetchMediaStatuses.mockResolvedValue([]);
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
    modules.upload.cancelUpload('a');
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

    modules.upload.retryUpload('a');
    modules.upload.retryUpload('a');

    await vi.waitFor(() => expect(statusOf('a')).toBe(modules.DraftMediaStatus.Uploaded));
    expect(api.completeUpload).toHaveBeenCalledTimes(1);
  });

  it('retries a file that ran out of attempts for lack of network once it is back', async () => {
    vi.useFakeTimers();
    storage.putBlob.mockRejectedValue(
      new modules.UploadFailure(modules.FailureKind.Network, 'no answer'),
    );

    addPhotos('a');
    markReady('a');
    // Three attempts with their waits (at most 2 s, then 4 s).
    await vi.advanceTimersByTimeAsync(10_000);
    expect(statusOf('a')).toBe(modules.DraftMediaStatus.UploadFailed);

    storage.putBlob.mockResolvedValue('"etag"');
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(0);

    expect(statusOf('a')).toBe(modules.DraftMediaStatus.Uploaded);
  });

  it('asks the server until processing ends, and marks what it no longer lists', async () => {
    vi.useFakeTimers();
    api.fetchMediaStatuses
      .mockResolvedValueOnce([
        { id: 'm-a', status: 'PROCESSING', thumbnailUrl: null, placeholder: null, error: null },
      ])
      .mockResolvedValueOnce([
        {
          id: 'm-a',
          status: 'READY',
          thumbnailUrl: 'https://t/a.jpg',
          placeholder: 'x',
          error: null,
        },
      ]);

    addPhotos('a', 'b');
    markReady('a');
    markReady('b');
    // Two rounds, 3 s apart.
    await vi.advanceTimersByTimeAsync(6_000);

    const item = find('a');
    expect(item.status === modules.DraftMediaStatus.Uploaded && item.server.thumbnailUrl).toBe(
      'https://t/a.jpg',
    );
    const missing = find('b');
    expect(missing.status === modules.DraftMediaStatus.Uploaded && missing.server.error).toBe(
      modules.MediaError.Missing,
    );

    const calls = api.fetchMediaStatuses.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(api.fetchMediaStatuses).toHaveBeenCalledTimes(calls);
  });

  it('asks once for the reason when complete answers FAILED without one', async () => {
    vi.useFakeTimers();
    api.completeUpload.mockResolvedValue('FAILED');
    api.fetchMediaStatuses.mockResolvedValue([
      {
        id: 'm-a',
        status: 'FAILED',
        thumbnailUrl: null,
        placeholder: null,
        error: 'VIDEO_TOO_LONG',
      },
    ]);

    addPhotos('a');
    markReady('a');
    await vi.advanceTimersByTimeAsync(3_000);

    const item = find('a');
    expect(item.status === modules.DraftMediaStatus.Uploaded && item.server.error).toBe(
      modules.MediaError.VideoTooLong,
    );
    expect(api.fetchMediaStatuses).toHaveBeenCalledTimes(1);
  });
});

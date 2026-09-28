import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MediaKind } from '@/features/media/types/media';
import type { UploadRequestFile } from '@/features/media/types/upload';

// The network, replaced: the real modules run against these.
const api = vi.hoisted(() => ({
  registerUploads: vi.fn(),
  refreshUploadUrl: vi.fn(),
  completeParts: vi.fn(),
  completeUpload: vi.fn(),
  fetchMediaStatuses: vi.fn(),
  deleteMedia: vi.fn(),
  putBlob: vi.fn(),
}));
vi.mock('@/features/media/api/media-uploads', () => api);

const LATER = '2099-01-01T00:00:00Z';
const file = new File(['0123456789'], 'photo.jpg');

async function loadModules() {
  const pipelines = await import('@/features/listings/services/media-pipeline');
  const { newDraftMedia } = await import('@/features/listings/utils/draft-media');
  const { DraftMediaStatus } = await import('@/features/listings/types/draft-media');
  const { ServerMediaStatus } = await import('@/features/media/types/upload');
  const { createListingDraftStore, useListingDraftStore } = await import('@/stores/listing-draft');
  return {
    pipelines,
    newDraftMedia,
    DraftMediaStatus,
    ServerMediaStatus,
    createListingDraftStore,
    useListingDraftStore,
  };
}

type Modules = Awaited<ReturnType<typeof loadModules>>;
let modules: Modules;

/** A photo already on the listing, as utils/edit-listing.ts seeds it. */
function existing(id: string, status = modules.ServerMediaStatus.Ready) {
  return {
    ...modules.newDraftMedia(id, MediaKind.Image, file),
    file: null,
    status: modules.DraftMediaStatus.Uploaded,
    mediaId: id,
    server: { status, thumbnailUrl: `https://t/${id}.jpg`, placeholder: null, error: null },
    mediumUrl: `https://m/${id}.jpg`,
  };
}

const EMPTY = {
  title: '',
  description: '',
  price: '',
  categoryId: '',
  condition: '' as const,
  locationId: '',
};

/** An edit page's pipeline, as EditListingForm makes it. */
function newEditPipeline(start: Parameters<Modules['createListingDraftStore']>[0]) {
  return modules.pipelines.createMediaPipeline(modules.createListingDraftStore(start));
}

/** What EditListingForm's effect does: start, and on close delete the new uploads. */
function run(pipeline: ReturnType<typeof newEditPipeline>) {
  const stopListening = pipeline.start();
  return () => {
    pipeline.stopAll();
    stopListening();
  };
}

function editPipeline(...ids: string[]) {
  return newEditPipeline({
    fields: EMPTY,
    media: ids.map((id) => existing(id)),
  });
}

/** Adds a picked photo to the edit, straight to ReadyToUpload (the worker is not tested here). */
function addReadyPhoto(pipeline: ReturnType<typeof editPipeline>, id: string) {
  const { store } = pipeline;
  store.getState().addMedia([modules.newDraftMedia(id, MediaKind.Image, file)]);
  store.getState().updateMedia(id, {
    status: modules.DraftMediaStatus.ReadyToUpload,
    original: { bytes: 10, width: 800, height: 600 },
    upload: { blob: file, contentType: 'image/jpeg', optimized: true },
  });
}

const statusOf = (pipeline: ReturnType<typeof editPipeline>, id: string) =>
  pipeline.store.getState().media.find((item) => item.id === id)?.status;

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('window', new EventTarget());
  Object.values(api).forEach((mock) => mock.mockReset());
  api.registerUploads.mockImplementation(async (files: UploadRequestFile[]) =>
    files.map((request) => ({
      clientFileId: request.clientFileId,
      mediaId: `m-${request.clientFileId}`,
      expiresAt: LATER,
      presignedUrl: `put://${request.clientFileId}`,
    })),
  );
  api.completeUpload.mockResolvedValue('PROCESSING');
  api.fetchMediaStatuses.mockResolvedValue([]);
  api.deleteMedia.mockResolvedValue(undefined);
  api.putBlob.mockResolvedValue('"etag"');
  modules = await loadModules();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('edit media pipeline', () => {
  it('uploads a picked file only once started, on its own store, leaving the sell draft alone', async () => {
    const pipeline = editPipeline('m_a');
    addReadyPhoto(pipeline, 'p1');
    expect(api.registerUploads).not.toHaveBeenCalled();

    const stop = run(pipeline);
    await vi.waitFor(() =>
      expect(statusOf(pipeline, 'p1')).toBe(modules.DraftMediaStatus.Uploaded),
    );

    expect(modules.useListingDraftStore.getState().media).toEqual([]);
    stop();
  });

  it("closing the page deletes the new uploads but never the listing's media", async () => {
    const pipeline = editPipeline('m_a', 'm_b');
    const stop = run(pipeline);
    addReadyPhoto(pipeline, 'p1');
    await vi.waitFor(() =>
      expect(statusOf(pipeline, 'p1')).toBe(modules.DraftMediaStatus.Uploaded),
    );

    pipeline.removeMedia('m_a');
    stop();

    await vi.waitFor(() => expect(api.deleteMedia).toHaveBeenCalledWith('m-p1'));
    expect(api.deleteMedia).toHaveBeenCalledTimes(1);
  });

  it('deletes nothing once saved', async () => {
    const pipeline = editPipeline('m_a');
    const stop = run(pipeline);
    addReadyPhoto(pipeline, 'p1');
    await vi.waitFor(() =>
      expect(statusOf(pipeline, 'p1')).toBe(modules.DraftMediaStatus.Uploaded),
    );

    pipeline.forgetAll();
    stop();

    expect(api.deleteMedia).not.toHaveBeenCalled();
  });

  it('asks about listing media still processing, and stops asking when the page closes', async () => {
    vi.useFakeTimers();
    api.fetchMediaStatuses.mockResolvedValue([
      { id: 'm_a', status: 'PROCESSING', thumbnailUrl: null, placeholder: null, error: null },
    ]);
    const pipeline = newEditPipeline({
      fields: EMPTY,
      media: [existing('m_a', modules.ServerMediaStatus.Processing)],
    });

    const stop = run(pipeline);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(api.fetchMediaStatuses).toHaveBeenCalledWith(['m_a']);

    stop();
    const asked = api.fetchMediaStatuses.mock.calls.length;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(api.fetchMediaStatuses).toHaveBeenCalledTimes(asked);
  });

  it('can start again after a stop, as React does in development', async () => {
    const pipeline = editPipeline('m_a');
    run(pipeline)();
    const stop = run(pipeline);
    addReadyPhoto(pipeline, 'p1');

    await vi.waitFor(() =>
      expect(statusOf(pipeline, 'p1')).toBe(modules.DraftMediaStatus.Uploaded),
    );
    expect(api.deleteMedia).not.toHaveBeenCalled();
    stop();
  });
});

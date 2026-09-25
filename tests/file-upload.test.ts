import { afterEach, describe, expect, it, vi } from 'vitest';

import { MediaKind } from '@/features/media/media-utils';
import {
  FileUpload,
  type PutOptions,
  type UploadListener,
  type UploadTransport,
  UploadWait,
} from '@/features/media/upload/file-upload';
import {
  FailureKind,
  MAX_UPLOAD_ATTEMPTS,
  UPLOAD_URL_LIFETIME_MS,
  UploadFailure,
} from '@/features/media/upload/retry-policy';
import {
  ServerMediaStatus,
  type UploadRequestFile,
  type UploadTarget,
} from '@/features/media/upload/upload-types';

const NOW = Date.parse('2026-09-25T10:00:00Z');
const LATER = '2026-09-25T10:15:00Z';
const PART_SIZE = 4;

const photoRequest: UploadRequestFile = {
  clientFileId: 'local-1',
  type: MediaKind.Image,
  contentType: 'image/jpeg',
  size: 10,
  originalBytes: 100,
  optimized: true,
};
const videoRequest: UploadRequestFile = {
  ...photoRequest,
  type: MediaKind.Video,
  contentType: 'video/mp4',
};

const photoTarget: UploadTarget = { mediaId: 'm1', expiresAt: LATER, presignedUrl: 'put://photo' };
const videoTarget: UploadTarget = {
  mediaId: 'm2',
  expiresAt: LATER,
  partSize: PART_SIZE,
  parts: [1, 2, 3].map((partNumber) => ({ partNumber, presignedUrl: `put://part${partNumber}` })),
};

const failure = (kind: FailureKind) => new UploadFailure(kind, 'test');

/** No wait between attempts; the real timing is RETRY_TIMING. */
const NO_WAIT = { minTimeout: 0, factor: 1, randomize: false };
const newUpload = (request: UploadRequestFile, blob: Blob, transport: UploadTransport) =>
  new FileUpload(request, blob, transport, NO_WAIT);

/** For `failing`: fail every call. */
const ALWAYS = Infinity;

function fakeTransport(overrides: Partial<UploadTransport> = {}) {
  return {
    register: vi.fn(async (file: UploadRequestFile) =>
      file.type === MediaKind.Video ? videoTarget : photoTarget,
    ),
    refresh: vi.fn(async (mediaId: string, partNumbers?: number[]) => ({
      mediaId,
      expiresAt: LATER,
      presignedUrl: 'put://photo-fresh',
      partSize: PART_SIZE,
      parts: (partNumbers ?? []).map((partNumber) => ({
        partNumber,
        presignedUrl: `put://part${partNumber}-fresh`,
      })),
    })),
    put: vi.fn(async (url: string) => `"etag-${url}"`),
    completeParts: vi.fn(async () => ServerMediaStatus.Uploading),
    complete: vi.fn(async () => ServerMediaStatus.Processing),
    isOnline: vi.fn(() => true),
    waitForNetwork: vi.fn(async () => {}),
    now: vi.fn(() => NOW),
    ...overrides,
  };
}

function recordingListener() {
  const events: string[] = [];
  const registered: string[] = [];
  const listener: UploadListener = {
    onRegistered: (mediaId) => registered.push(mediaId),
    onProgress: (fraction) => events.push(`progress ${fraction}`),
    onWaiting: (wait) => events.push(`waiting ${wait}`),
    onResumed: () => events.push('resumed'),
  };
  return { events, registered, listener };
}

/** Fails the first `times` calls with `kind`, then does what `then` does. */
function failing<T>(times: number, kind: FailureKind, then: () => Promise<T>) {
  let calls = 0;
  return vi.fn(async () => {
    calls += 1;
    if (calls <= times) {
      throw failure(kind);
    }
    return then();
  });
}

const photoBlob = new Blob(['0123456789']);
const run = (upload: FileUpload, listener = recordingListener().listener) =>
  upload.run(listener, new AbortController().signal);

describe('FileUpload, photo', () => {
  it('registers, sends the photo with its declared type, and completes', async () => {
    const transport = fakeTransport();
    const { events, listener } = recordingListener();

    const result = await run(newUpload(photoRequest, photoBlob, transport), listener);

    expect(result).toEqual({
      kind: 'uploaded',
      mediaId: 'm1',
      status: ServerMediaStatus.Processing,
    });
    expect(transport.put).toHaveBeenCalledWith(
      'put://photo',
      photoBlob,
      expect.objectContaining({ contentType: 'image/jpeg' }),
    );
    expect(transport.complete).toHaveBeenCalledWith('m1', expect.anything());
    expect(events).toEqual([]);
  });

  it('retries a network error, then succeeds', async () => {
    const transport = fakeTransport({ put: failing(2, FailureKind.Network, async () => '"e"') });
    const { events, listener } = recordingListener();

    const result = await run(newUpload(photoRequest, photoBlob, transport), listener);

    expect(result.kind).toBe('uploaded');
    expect(events).toEqual([
      `waiting ${UploadWait.Retry}`,
      'resumed',
      `waiting ${UploadWait.Retry}`,
      'resumed',
    ]);
  });

  it('gives up after 3 attempts, offering retry', async () => {
    const transport = fakeTransport({
      put: failing(ALWAYS, FailureKind.Server, async () => '"e"'),
    });

    const result = await run(newUpload(photoRequest, photoBlob, transport));

    expect(result).toEqual({ kind: 'failed', failure: FailureKind.Server, isRetryable: true });
    expect(transport.put).toHaveBeenCalledTimes(MAX_UPLOAD_ATTEMPTS);
  });

  it('stops at once when refused for good, offering remove only', async () => {
    const transport = fakeTransport({
      put: failing(ALWAYS, FailureKind.Rejected, async () => '"e"'),
    });

    const result = await run(newUpload(photoRequest, photoBlob, transport));

    expect(result).toEqual({ kind: 'failed', failure: FailureKind.Rejected, isRetryable: false });
    expect(transport.put).toHaveBeenCalledTimes(1);
  });

  it('asks for a fresh URL after storage says the old one expired', async () => {
    const transport = fakeTransport({ put: failing(1, FailureKind.Expired, async () => '"e"') });

    await run(newUpload(photoRequest, photoBlob, transport));

    expect(transport.refresh).toHaveBeenCalledTimes(1);
    expect(transport.put.mock.calls.map(([url]) => url)).toEqual([
      'put://photo',
      'put://photo-fresh',
    ]);
  });

  it('refreshes a URL about to expire before using it, by the phone’s own clock', async () => {
    const transport = fakeTransport();
    // The URL arrives at NOW; by the time the PUT starts, almost 15 minutes have passed.
    // The server's expiresAt is never compared.
    transport.now.mockReturnValueOnce(NOW).mockReturnValue(NOW + UPLOAD_URL_LIFETIME_MS - 30_000);

    await run(newUpload(photoRequest, photoBlob, transport));

    expect(transport.put.mock.calls.map(([url]) => url)).toEqual(['put://photo-fresh']);
  });

  it('ignores a phone clock that runs ahead of the server', async () => {
    const transport = fakeTransport({
      // expiresAt is 15 minutes after NOW, but the phone thinks it is 20 minutes later.
      now: vi.fn(() => NOW + 20 * 60_000),
    });

    await run(newUpload(photoRequest, photoBlob, transport));

    expect(transport.refresh).not.toHaveBeenCalled();
  });

  it('starts the seller’s Retry with fresh URLs', async () => {
    const transport = fakeTransport({
      put: failing(MAX_UPLOAD_ATTEMPTS, FailureKind.Server, async () => '"e"'),
    });
    const upload = newUpload(photoRequest, photoBlob, transport);
    expect((await run(upload)).kind).toBe('failed');

    upload.markUrlsStale();
    expect((await run(upload)).kind).toBe('uploaded');

    expect(transport.refresh).toHaveBeenCalledTimes(1);
  });

  it('waits before registering when offline from the start', async () => {
    let isOnline = false;
    const order: string[] = [];
    const transport = fakeTransport({
      isOnline: vi.fn(() => isOnline),
      waitForNetwork: vi.fn(async () => {
        order.push('waited');
        isOnline = true;
      }),
    });
    transport.register.mockImplementation(async () => {
      order.push('registered');
      return photoTarget;
    });

    await run(newUpload(photoRequest, photoBlob, transport));

    expect(order).toEqual(['waited', 'registered']);
  });

  it('reports the media it registered even when removed meanwhile, so it can be deleted', async () => {
    const controller = new AbortController();
    const transport = fakeTransport({
      register: vi.fn(async () => {
        controller.abort();
        return photoTarget;
      }),
    });
    const { registered, listener } = recordingListener();

    await expect(
      newUpload(photoRequest, photoBlob, transport).run(listener, controller.signal),
    ).rejects.toBeDefined();

    expect(registered).toEqual(['m1']);
    expect(transport.put).not.toHaveBeenCalled();
  });

  it('waits for the network without using up an attempt', async () => {
    let isOnline = false;
    let drops = 0;
    const transport = fakeTransport({
      isOnline: vi.fn(() => isOnline),
      waitForNetwork: vi.fn(async () => {
        isOnline = true;
      }),
      // The connection drops mid-upload three times: as many as the attempt limit.
      put: vi.fn(async () => {
        if (drops < 3) {
          drops += 1;
          isOnline = false;
          throw failure(FailureKind.Network);
        }
        return '"e"';
      }),
    });
    const { events, listener } = recordingListener();

    const result = await run(newUpload(photoRequest, photoBlob, transport), listener);

    expect(result.kind).toBe('uploaded');
    expect(transport.waitForNetwork).toHaveBeenCalledTimes(4);
    expect(events.filter((event) => event === `waiting ${UploadWait.Network}`)).toHaveLength(4);
  });

  it('waits for the network when it drops on the last attempt, instead of failing', async () => {
    let isOnline = true;
    let puts = 0;
    const transport = fakeTransport({
      isOnline: vi.fn(() => isOnline),
      waitForNetwork: vi.fn(async () => {
        isOnline = true;
      }),
      // Two timeouts while the phone still says online use up the retries; then it drops.
      put: vi.fn(async () => {
        puts += 1;
        if (puts <= 2) {
          throw failure(FailureKind.Server);
        }
        if (puts === 3) {
          isOnline = false;
          throw failure(FailureKind.Network);
        }
        return '"e"';
      }),
    });
    const { events, listener } = recordingListener();

    const result = await run(newUpload(photoRequest, photoBlob, transport), listener);

    expect(result.kind).toBe('uploaded');
    expect(events).toContain(`waiting ${UploadWait.Network}`);
  });

  it('does not send the photo again when only the answer to complete was lost', async () => {
    const transport = fakeTransport({
      complete: failing(1, FailureKind.Network, async () => ServerMediaStatus.Processing),
    });

    const result = await run(newUpload(photoRequest, photoBlob, transport));

    expect(result.kind).toBe('uploaded');
    expect(transport.put).toHaveBeenCalledTimes(1);
    expect(transport.complete).toHaveBeenCalledTimes(2);
  });

  it('sends the photo again when the server finds it missing in storage', async () => {
    const transport = fakeTransport({
      complete: failing(1, FailureKind.Conflict, async () => ServerMediaStatus.Processing),
    });

    await run(newUpload(photoRequest, photoBlob, transport));

    expect(transport.put).toHaveBeenCalledTimes(2);
  });

  it('registers again when the server no longer has the media', async () => {
    const transport = fakeTransport({
      complete: failing(1, FailureKind.Gone, async () => ServerMediaStatus.Processing),
    });

    await run(newUpload(photoRequest, photoBlob, transport));

    expect(transport.register).toHaveBeenCalledTimes(2);
    expect(transport.put).toHaveBeenCalledTimes(2);
  });

  it('rejects when aborted, instead of reporting a failure', async () => {
    const controller = new AbortController();
    const transport = fakeTransport({
      put: vi.fn(async () => {
        controller.abort();
        throw failure(FailureKind.Network);
      }),
    });

    await expect(
      newUpload(photoRequest, photoBlob, transport).run(
        recordingListener().listener,
        controller.signal,
      ),
    ).rejects.toBeDefined();
    expect(transport.put).toHaveBeenCalledTimes(1);
  });
});

describe('FileUpload, waits between attempts', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // p-retry multiplies each wait by 1 + Math.random(): the shortest and the longest waits.
  it.each([
    [0, 1_000, 2_000],
    [0.999, 1_999, 3_998],
  ])(
    'waits 1–2 s before the second attempt and 2–4 s before the third (random %s)',
    async (random, firstWait, secondWait) => {
      vi.useFakeTimers();
      vi.spyOn(Math, 'random').mockReturnValue(random);
      const transport = fakeTransport({ put: failing(ALWAYS, FailureKind.Server, async () => '') });

      const result = new FileUpload(photoRequest, photoBlob, transport).run(
        recordingListener().listener,
        new AbortController().signal,
      );

      await vi.advanceTimersByTimeAsync(firstWait - 1);
      expect(transport.put).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(transport.put).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(secondWait - 1);
      expect(transport.put).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1);
      expect(transport.put).toHaveBeenCalledTimes(3);

      await expect(result).resolves.toMatchObject({ kind: 'failed', failure: FailureKind.Server });
    },
  );

  it('rejects at once when removed during a wait', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const transport = fakeTransport({ put: failing(ALWAYS, FailureKind.Server, async () => '') });

    const result = new FileUpload(photoRequest, photoBlob, transport).run(
      recordingListener().listener,
      controller.signal,
    );
    const settled = expect(result).rejects.toBeDefined();

    await vi.advanceTimersByTimeAsync(500);
    controller.abort();
    await settled;
    expect(transport.put).toHaveBeenCalledTimes(1);
  });
});

describe('FileUpload, video', () => {
  // 10 bytes in parts of 4: 4 + 4 + 2.
  const videoBlob = new Blob(['0123456789']);

  it('sends every part, then joins them with their ETags in order', async () => {
    const transport = fakeTransport();

    const result = await run(newUpload(videoRequest, videoBlob, transport));

    expect(result).toEqual({
      kind: 'uploaded',
      mediaId: 'm2',
      status: ServerMediaStatus.Processing,
    });
    const sizes = transport.put.mock.calls.map(([url, body]) => [url, (body as Blob).size]);
    expect(sizes).toEqual([
      ['put://part1', 4],
      ['put://part2', 4],
      ['put://part3', 2],
    ]);
    expect(transport.completeParts).toHaveBeenCalledWith(
      'm2',
      [
        { partNumber: 1, etag: '"etag-put://part1"' },
        { partNumber: 2, etag: '"etag-put://part2"' },
        { partNumber: 3, etag: '"etag-put://part3"' },
      ],
      expect.anything(),
    );
    expect(transport.complete).toHaveBeenCalledTimes(1);
  });

  it('sends only the parts storage does not have on the next attempt', async () => {
    const transport = fakeTransport({
      put: vi.fn(async (url: string) => {
        if (url === 'put://part2' && transport.put.mock.calls.length <= 3) {
          throw failure(FailureKind.Network);
        }
        return `"etag-${url}"`;
      }),
    });

    await run(newUpload(videoRequest, videoBlob, transport));

    const urls = transport.put.mock.calls.map(([url]) => url);
    expect(urls.filter((url) => url === 'put://part1')).toHaveLength(1);
    expect(urls.filter((url) => url === 'put://part2')).toHaveLength(2);
  });

  it('keeps what reached storage for the seller’s Retry', async () => {
    const transport = fakeTransport({
      put: vi.fn(async (url: string) => {
        if (url === 'put://part3') {
          throw failure(FailureKind.Server);
        }
        return `"etag-${url}"`;
      }),
    });
    const upload = newUpload(videoRequest, videoBlob, transport);
    expect((await run(upload)).kind).toBe('failed');

    transport.put.mockImplementation(async (url: string) => `"etag-${url}"`);
    transport.put.mockClear();
    expect((await run(upload)).kind).toBe('uploaded');

    expect(transport.put.mock.calls.map(([url]) => url)).toEqual(['put://part3']);
  });

  it('reports progress over all parts', async () => {
    const transport = fakeTransport();
    const { events, listener } = recordingListener();

    await run(newUpload(videoRequest, videoBlob, transport), listener);

    expect(events.at(-1)).toBe('progress 1');
  });

  it('refuses the upload when storage hides the ETag', async () => {
    const transport = fakeTransport({ put: vi.fn(async () => null) });

    const result = await run(newUpload(videoRequest, videoBlob, transport));

    expect(result).toEqual({ kind: 'failed', failure: FailureKind.Rejected, isRetryable: false });
    expect(transport.completeParts).not.toHaveBeenCalled();
  });

  it('refreshes only the parts still to send when the URLs expired', async () => {
    const transport = fakeTransport({
      put: vi.fn(async (url: string) => {
        if (url === 'put://part2') {
          throw failure(FailureKind.Expired);
        }
        return `"etag-${url}"`;
      }),
    });

    await run(newUpload(videoRequest, videoBlob, transport));

    expect(transport.refresh).toHaveBeenCalledWith('m2', [2], expect.anything());
    expect(transport.put.mock.calls.map(([url]) => url)).toContain('put://part2-fresh');
  });

  it('shares one URL refresh between the parts in flight', async () => {
    const transport = fakeTransport();
    transport.now.mockReturnValueOnce(NOW).mockReturnValue(NOW + UPLOAD_URL_LIFETIME_MS);

    await run(newUpload(videoRequest, videoBlob, transport));

    expect(transport.refresh).toHaveBeenCalledTimes(1);
    expect(transport.refresh).toHaveBeenCalledWith('m2', [1, 2, 3], expect.anything());
  });

  it('stops the other parts and never joins them when removed mid-upload', async () => {
    const controller = new AbortController();
    const transport = fakeTransport({
      put: vi.fn(async (url: string, _body: Blob, { signal }: PutOptions) => {
        if (url === 'put://part1') {
          controller.abort();
        }
        return new Promise<string>((resolve, reject) => {
          if (signal?.aborted) {
            reject(signal.reason);
            return;
          }
          signal?.addEventListener('abort', () => reject(signal.reason));
          setTimeout(() => resolve(`"etag-${url}"`), 10);
        });
      }),
    });

    await expect(
      newUpload(videoRequest, videoBlob, transport).run(
        recordingListener().listener,
        controller.signal,
      ),
    ).rejects.toBeDefined();

    expect(transport.completeParts).not.toHaveBeenCalled();
    expect(transport.complete).not.toHaveBeenCalled();
  });

  it('starts over as a new media when a part finds the upload gone', async () => {
    let calls = 0;
    const transport = fakeTransport({
      put: vi.fn(async (url: string) => {
        calls += 1;
        if (url === 'put://part3' && calls <= 3) {
          throw failure(FailureKind.Gone);
        }
        return `"etag-${url}"`;
      }),
    });

    await run(newUpload(videoRequest, videoBlob, transport));

    expect(transport.register).toHaveBeenCalledTimes(2);
    // Every part again: the new upload has none of the old ones.
    expect(transport.put).toHaveBeenCalledTimes(6);
  });

  it('starts over as a new media when complete finds the joined video wrong', async () => {
    const transport = fakeTransport({
      complete: failing(1, FailureKind.Conflict, async () => ServerMediaStatus.Processing),
    });

    await run(newUpload(videoRequest, videoBlob, transport));

    expect(transport.register).toHaveBeenCalledTimes(2);
    expect(transport.completeParts).toHaveBeenCalledTimes(2);
  });
});

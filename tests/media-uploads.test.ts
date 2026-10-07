import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  completeParts,
  refreshUploadUrl,
  registerUploads,
} from '@/features/media/api/media-uploads';
import { MediaKind } from '@/features/media/types/media';
import { FailureKind, type UploadRequestFile } from '@/features/media/types/upload';

const http = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('@/lib/http', () => ({ http }));

const file: UploadRequestFile = {
  clientFileId: 'local-1',
  type: MediaKind.Image,
  contentType: 'image/jpeg',
  size: 10,
};

const photo = {
  type: 'IMAGE',
  mediaId: 'm1',
  clientFileId: 'local-1',
  objectKey: 'uploads/u/m1',
  expiresAt: '2026-09-28T10:15:00.000Z',
  presignedUrl: 'put://photo',
};
const video = {
  type: 'VIDEO',
  mediaId: 'm2',
  clientFileId: 'local-2',
  objectKey: 'uploads/u/m2',
  expiresAt: '2026-09-28T10:15:00.000Z',
  uploadId: 'upload-2',
  partSize: 8,
  parts: [{ partNumber: 1, presignedUrl: 'put://part1' }],
};

const answer = (data: unknown) => ({ data: { data } });

function apiError(status: number) {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('request failed', 'ERR_BAD_REQUEST', config, undefined, {
    status,
    statusText: '',
    headers: {},
    config,
    data: {},
  });
}

const failure = (kind: FailureKind) => expect.objectContaining({ name: 'UploadFailure', kind });

beforeEach(() => {
  http.post.mockReset();
});

describe('upload targets', () => {
  it('reads a photo and a video target by their type', async () => {
    http.post.mockResolvedValue(answer({ uploads: [photo, video] }));

    await expect(registerUploads([file])).resolves.toEqual([photo, video]);
  });

  it('reads fresh URLs, which carry no clientFileId', async () => {
    const { clientFileId: _, ...fresh } = video;
    http.post.mockResolvedValue(answer(fresh));

    await expect(refreshUploadUrl('m2', [1])).resolves.toEqual(fresh);
  });

  it.each([
    ['a photo without its URL', { ...photo, presignedUrl: undefined }],
    ['a video without its part size', { ...video, partSize: undefined }],
    ['a video without its parts', { ...video, parts: undefined }],
    ['a target without a type', { ...photo, type: undefined }],
    ['a target of an unknown type', { ...photo, type: 'AUDIO' }],
  ])('refuses %s for good', async (_, target) => {
    http.post.mockResolvedValue(answer({ uploads: [target] }));
    await expect(registerUploads([file])).rejects.toEqual(failure(FailureKind.Rejected));

    http.post.mockResolvedValue(answer(target));
    await expect(refreshUploadUrl('m1')).rejects.toEqual(failure(FailureKind.Rejected));
  });
});

describe('parts/complete', () => {
  it('reads a 404 as a media gone, which the upload starts over from', async () => {
    http.post.mockRejectedValue(apiError(404));

    await expect(completeParts('m2', [{ partNumber: 1, etag: '"e"' }])).rejects.toEqual(
      failure(FailureKind.Gone),
    );
  });
});

/**
 * The media upload endpoints (api-spec.md, "Media"), each turning a failed request into an
 * UploadFailure so the retry rules see one kind of error whatever went wrong.
 */

import axios from 'axios';

import { http } from '@/lib/http';
import { failureFromApiStatus, UploadFailure } from '@/features/media/upload/retry-policy';
import type {
  CompletedPart,
  MediaStatusItem,
  RegisteredUpload,
  ServerMediaStatus,
  UploadRequestFile,
  UploadTarget,
} from '@/features/media/upload/upload-types';

const mediaPath = (mediaId: string) => `/media/${encodeURIComponent(mediaId)}`;

async function call<T>(request: () => Promise<{ data: { data: T } }>) {
  try {
    return (await request()).data.data;
  } catch (error) {
    if (axios.isCancel(error)) {
      throw error;
    }
    const status = axios.isAxiosError(error) ? (error.response?.status ?? 0) : 0;
    throw new UploadFailure(failureFromApiStatus(status), error);
  }
}

export function registerUploads(files: UploadRequestFile[], signal?: AbortSignal) {
  return call(() =>
    http.post<{ data: { uploads: RegisteredUpload[] } }>(
      '/media/upload-urls',
      { files },
      { signal },
    ),
  ).then((data) => data.uploads);
}

/** Fresh URLs for a file still uploading; for a video, only `partNumbers` when given. */
export function refreshUploadUrl(mediaId: string, partNumbers?: number[], signal?: AbortSignal) {
  return call(() =>
    http.post<{ data: UploadTarget }>(
      `${mediaPath(mediaId)}/upload-url`,
      { partNumbers },
      { signal },
    ),
  );
}

export function completeParts(mediaId: string, parts: CompletedPart[], signal?: AbortSignal) {
  return call(() =>
    http.post<{ data: { status: ServerMediaStatus } }>(
      `${mediaPath(mediaId)}/parts/complete`,
      { parts },
      { signal },
    ),
  ).then((data) => data.status);
}

export function completeUpload(mediaId: string, signal?: AbortSignal) {
  return call(() =>
    http.post<{ data: { status: ServerMediaStatus } }>(
      `${mediaPath(mediaId)}/complete`,
      undefined,
      {
        signal,
      },
    ),
  ).then((data) => data.status);
}

/** Statuses of the caller's media; an ID the server no longer has is left out. */
export function fetchMediaStatuses(mediaIds: string[]) {
  return call(() =>
    http.get<{ data: MediaStatusItem[] }>('/media', { params: { ids: mediaIds.join(',') } }),
  );
}

export function deleteMedia(mediaId: string) {
  return http.delete(mediaPath(mediaId));
}

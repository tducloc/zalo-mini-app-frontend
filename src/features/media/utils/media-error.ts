import { MediaError } from '@/features/media/types/upload';

const isMediaError = (code: string): code is MediaError =>
  Object.values<string>(MediaError).includes(code);

/** A server's error code as a reason the app knows, or null for none or an unknown one. */
export function toMediaError(code: string | null | undefined): MediaError | null {
  return code && isMediaError(code) ? code : null;
}

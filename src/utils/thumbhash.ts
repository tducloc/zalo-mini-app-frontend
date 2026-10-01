import { thumbHashToDataURL } from 'thumbhash';

/** A data URL for the blur shown while the real thumbnail is still downloading. */
export function thumbHashUrl(hash: string | null | undefined) {
  if (!hash) {
    return null;
  }

  try {
    return thumbHashToDataURL(Uint8Array.from(atob(hash), (char) => char.charCodeAt(0)));
  } catch {
    return null;
  }
}

import { useMemo, useState } from 'react';
import { Icon } from 'zmp-ui';

import { thumbHashUrl } from '@/utils/thumbhash';

// Square 400×400 thumbnails; the attributes reserve space before the image loads.
const THUMBNAIL_SIZE = 400;

/**
 * A listing card's photo, filling its positioned box: the ThumbHash blur while the photo
 * loads, then the photo, or a photo icon when there is none or it failed.
 */
export default function CardThumbnail({
  src,
  placeholder,
  loading = 'lazy',
}: {
  src: string | null;
  /** ThumbHash to paint while `src` loads; null shows nothing under it. */
  placeholder: string | null;
  loading?: 'eager' | 'lazy';
}) {
  // Remember WHICH url failed or loaded, so a changed thumbnail (e.g. an edited listing)
  // is tried again with its blur instead of keeping the old state.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const placeholderUrl = useMemo(() => thumbHashUrl(placeholder), [placeholder]);

  if (!src || src === failedUrl) {
    return (
      <span
        className="grid size-full place-items-center text-marketplace-subtle"
        aria-hidden="true"
      >
        <Icon icon="zi-photo" size={28} />
      </span>
    );
  }

  return (
    <>
      {/* Only stands in while the photo loads; then it is dropped from the DOM. */}
      {placeholderUrl && src !== loadedUrl && (
        <img
          alt=""
          aria-hidden
          className="absolute inset-0 size-full object-cover"
          src={placeholderUrl}
        />
      )}
      <img
        alt=""
        className="relative block size-full object-cover"
        decoding="async"
        height={THUMBNAIL_SIZE}
        loading={loading}
        src={src}
        width={THUMBNAIL_SIZE}
        onError={() => setFailedUrl(src)}
        onLoad={() => setLoadedUrl(src)}
      />
    </>
  );
}

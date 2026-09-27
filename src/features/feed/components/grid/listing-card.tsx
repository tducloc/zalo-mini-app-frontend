import { useEffect, useRef, useState } from 'react';
import { Icon } from 'zmp-ui';

import Price from '@/components/price';
import {
  listingCardClass,
  listingCopyClass,
  listingImageClass,
} from '@/features/feed/constants/styles';
import type { ProductCard } from '@/features/products/types/product';
import { formatShortRelativeTime } from '@/utils/format';

// Square 400×400 thumbnails; the attributes reserve space before the image loads.
const THUMBNAIL_SIZE = 400;

const videoBadgeClass =
  'absolute bottom-2 left-2 inline-flex items-center gap-[3px] rounded-[10px] bg-marketplace-ink/70 py-0.5 pl-1.5 pr-2 text-micro font-semibold leading-4 text-white';

export default function ListingCard({
  product,
  isAboveFold,
  isPreviewActive,
  cardRef,
  onOpen,
}: {
  product: ProductCard;
  isAboveFold: boolean;
  /** This card's preview is the one playing in the feed. */
  isPreviewActive: boolean;
  /** Lets the feed measure the card to pick which preview plays. */
  cardRef?: (element: HTMLElement | null) => void;
  onOpen: (productId: string) => void;
}) {
  // Remember WHICH url failed, so a changed thumbnail (e.g. an edited listing)
  // is tried again instead of keeping the placeholder forever.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const shouldShowImage = Boolean(product.thumbnailUrl) && product.thumbnailUrl !== failedUrl;

  return (
    <button
      ref={cardRef}
      aria-label={`Xem chi tiết ${product.title}`}
      className={listingCardClass}
      type="button"
      onClick={() => onOpen(product.id)}
    >
      <div className={listingImageClass}>
        {shouldShowImage ? (
          <img
            alt=""
            className="block size-full object-cover"
            decoding="async"
            height={THUMBNAIL_SIZE}
            loading={isAboveFold ? 'eager' : 'lazy'}
            src={product.thumbnailUrl ?? undefined}
            width={THUMBNAIL_SIZE}
            onError={() => setFailedUrl(product.thumbnailUrl)}
          />
        ) : (
          <span
            className="grid size-full place-items-center text-marketplace-subtle"
            aria-hidden="true"
          >
            <Icon icon="zi-photo" size={28} />
          </span>
        )}
        {isPreviewActive && product.previewUrl && <CardPreview src={product.previewUrl} />}
        {product.hasVideo && (
          <span className={videoBadgeClass}>
            <Icon icon="zi-play-solid" size={14} />
            Video
          </span>
        )}
      </div>
      <div className={listingCopyClass}>
        <h3 className="m-0 line-clamp-2 h-[34px] text-caption font-semibold leading-[17px] text-marketplace-ink">
          {product.title}
        </h3>
        <Price value={product.price} />
        <p className="m-0 flex items-center gap-[3px] text-micro leading-[15px] text-marketplace-muted">
          <Icon icon="zi-location" size={14} />
          {/* Only a very long place name shortens; the time stays readable. */}
          <span className="min-w-0 truncate" title={product.location.name}>
            {product.location.name}
          </span>
          <span className="flex-none">· {formatShortRelativeTime(product.publishedAt)}</span>
        </p>
      </div>
    </button>
  );
}

/**
 * The listing's short muted clip over its cover. It shows once it really plays, so a
 * slow start or a refused autoplay leaves the cover as it was.
 */
function CardPreview({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    // Set here, not as a prop: the cleanup drops it, and a remount must set it again.
    video.src = src;
    // Autoplay denied (a data saver, a WebView rule): the cover stays, silently.
    video.play().catch(() => setIsPlaying(false));

    // Removing the element alone may keep its buffer; dropping the source frees it.
    return () => {
      video.removeAttribute('src');
      video.load();
    };
  }, [src]);

  return (
    <video
      ref={videoRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 size-full object-cover transition-opacity duration-200 motion-reduce:transition-none ${
        isPlaying ? 'opacity-100' : 'opacity-0'
      }`}
      muted
      loop
      playsInline
      preload="auto"
      onPlaying={() => setIsPlaying(true)}
      onError={() => setIsPlaying(false)}
    />
  );
}

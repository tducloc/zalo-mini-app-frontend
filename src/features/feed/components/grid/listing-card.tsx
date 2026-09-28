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
/** Times a preview plays before the card shows its cover again. */
const PREVIEW_PLAYS = 2;

const videoBadgeClass =
  'absolute bottom-2 left-2 inline-flex items-center gap-[3px] rounded-[10px] bg-marketplace-ink/70 py-0.5 pl-1.5 pr-2 text-micro font-semibold leading-4 text-white';

export default function ListingCard({
  product,
  isAboveFold,
  isPreviewActive,
  cardRef,
  onOpen,
  onPreviewRefused,
  onPreviewFinished,
}: {
  product: ProductCard;
  isAboveFold: boolean;
  /** This card's preview is the one playing in the feed. */
  isPreviewActive: boolean;
  /** Lets the feed measure the card to pick which preview plays. */
  cardRef?: (element: HTMLElement | null) => void;
  onOpen: (productId: string) => void;
  /** The WebView refused to play the preview. */
  onPreviewRefused: () => void;
  /** The preview played its turn and the cover shows again. */
  onPreviewFinished: (productId: string) => void;
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
        {isPreviewActive && product.previewUrl && (
          // A new clip starts hidden again, not over the old one's last frame.
          <CardPreview
            key={product.previewUrl}
            src={product.previewUrl}
            onRefused={onPreviewRefused}
            onFinished={() => onPreviewFinished(product.id)}
          />
        )}
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
 * The listing's short muted clip over its cover, played a couple of times and then back to
 * the cover, so nothing moves on and on. It shows once it really plays, so a slow start
 * or a refused autoplay leaves the cover as it was.
 */
function CardPreview({
  src,
  onRefused,
  onFinished,
}: {
  src: string;
  onRefused: () => void;
  onFinished: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playsRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    // Some WebViews judge autoplay by the muted attribute, which React does not write.
    video.defaultMuted = true;
    // Set here, not as a prop: the cleanup drops it, and a remount must set it again.
    video.src = src;
    playsRef.current = 0;
    // Old WebViews return nothing from play().
    video.play()?.catch((error: unknown) => {
      // AbortError is the cleanup's load(); NotAllowedError is the WebView saying no.
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        onRefused();
      }
    });

    // Removing the element alone may keep its buffer; dropping the source frees it.
    return () => {
      video.removeAttribute('src');
      video.load();
    };
  }, [src, onRefused]);

  const handleEnded = () => {
    playsRef.current += 1;
    if (playsRef.current < PREVIEW_PLAYS) {
      void videoRef.current?.play()?.catch(() => setIsPlaying(false));
      return;
    }
    setIsPlaying(false);
  };

  return (
    <video
      ref={videoRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 size-full object-cover transition-opacity duration-200 ${
        isPlaying ? 'opacity-100' : 'opacity-0'
      }`}
      muted
      playsInline
      // play() loads it; nothing is fetched for a preview the WebView will not play.
      preload="none"
      onPlaying={() => setIsPlaying(true)}
      onEnded={handleEnded}
      // Reported once the fade back to the cover is over, so the next card's turn does not cut it.
      onTransitionEnd={() => {
        if (!isPlaying && playsRef.current >= PREVIEW_PLAYS) {
          onFinished();
        }
      }}
      onError={() => setIsPlaying(false)}
    />
  );
}

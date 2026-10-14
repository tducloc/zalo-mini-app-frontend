import { memo, useEffect, useRef } from 'react';
import { Icon } from 'zmp-ui';

import CardThumbnail from '@/components/card-thumbnail';
import Price from '@/components/price';
import {
  listingCardClass,
  listingCopyClass,
  listingImageClass,
} from '@/features/feed/constants/styles';
import type { ProductCard } from '@/features/products/types/product';
import { videoPool } from '@/lib/video-pool';
import { formatShortRelativeTime } from '@/utils/format';

/** Times a preview plays before the card shows its cover again. */
const PREVIEW_PLAYS = 2;
const FADE_MS = 200;
const START_TIMEOUT_MS = 5000;
const previewClass =
  'pointer-events-none absolute inset-0 size-full object-cover transition-opacity duration-200';

const videoBadgeClass =
  'absolute bottom-2 left-2 inline-flex items-center gap-[3px] rounded-[10px] bg-marketplace-ink/70 py-0.5 pl-1.5 pr-2 text-micro font-semibold leading-4 text-white';

export default memo(function ListingCard({
  product,
  isAboveFold,
  canShowBlur,
  isPreviewActive,
  cardRef,
  onOpen,
  onPreviewRefused,
  onPreviewFinished,
}: {
  product: ProductCard;
  isAboveFold: boolean;
  /** The ThumbHash blur may stand in while the photo loads. */
  canShowBlur: boolean;
  /** This card's preview is the one playing in the feed. */
  isPreviewActive: boolean;
  /** Lets the feed measure the card to pick which preview plays. */
  cardRef?: (element: HTMLElement | null) => void;
  onOpen: (productId: string) => void;
  /** The WebView refused to play the preview. */
  onPreviewRefused: () => void;
  onPreviewFinished: (productId: string) => void;
}) {
  return (
    <button
      ref={cardRef}
      aria-label={`Xem chi tiết ${product.title}`}
      className={listingCardClass}
      type="button"
      onClick={() => onOpen(product.id)}
    >
      <div className={listingImageClass}>
        <CardThumbnail
          loading={isAboveFold ? 'eager' : 'lazy'}
          placeholder={canShowBlur ? product.placeholder : null}
          src={product.thumbnailUrl}
        />
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
});

/**
 * The listing's short muted clip over its cover, played a couple of times and then back to
 * the cover, so nothing moves on and on. It shows once it really plays, so a slow start
 * or a refused autoplay leaves the cover as it was. Every card borrows the shared pooled
 * element, because iOS refuses to play a newly made one.
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
  const hostRef = useRef<HTMLDivElement>(null);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const { video, release } = videoPool.claim('shared', host);
    const show = (isShown: boolean) => {
      video.className = `${previewClass} ${isShown ? 'opacity-100' : 'opacity-0'}`;
    };

    let plays = 0;
    let isOver = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      if (isOver) {
        return;
      }
      isOver = true;
      clearTimeout(timer);
      show(false);
      onFinishedRef.current();
    };
    const play = () => {
      clearTimeout(timer);
      timer = setTimeout(finish, START_TIMEOUT_MS);
      // Old WebViews return nothing from play().
      video.play()?.catch((error: unknown) => {
        const name = error instanceof DOMException ? error.name : '';
        // NotAllowedError is the WebView saying no; AbortError is a release or the next card.
        if (name === 'NotAllowedError') {
          clearTimeout(timer);
          onRefused();
        } else if (name !== 'AbortError') {
          finish();
        }
      });
    };
    const handlePlaying = () => {
      clearTimeout(timer);
      show(true);
    };
    const handleEnded = () => {
      plays += 1;
      if (plays < PREVIEW_PLAYS) {
        play();
        return;
      }
      show(false);
      video.addEventListener('transitionend', finish);
      timer = setTimeout(finish, FADE_MS + 100);
    };

    show(false);
    video.muted = true;
    // Counted plays, not a loop.
    video.loop = false;
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', finish);
    video.src = src;
    play();

    return () => {
      isOver = true;
      clearTimeout(timer);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', finish);
      video.removeEventListener('transitionend', finish);
      // Pauses, drops the source and parks it, unless the next card claims it first.
      release();
    };
  }, [src, onRefused]);

  return <div ref={hostRef} aria-hidden="true" className="pointer-events-none absolute inset-0" />;
}

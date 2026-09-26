import { useState } from 'react';
import { Icon } from 'zmp-ui';

import Price from '@/components/price';
import {
  listingCardClass,
  listingCopyClass,
  listingImageClass,
  videoBadgeClass,
} from '@/features/feed/constants/styles';
import type { ProductCard } from '@/features/products/types/product';
import { formatShortRelativeTime } from '@/utils/format';

// Square 400×400 thumbnails; the attributes reserve space before the image loads.
const THUMBNAIL_SIZE = 400;

export default function ListingCard({
  product,
  isAboveFold,
  onOpen,
}: {
  product: ProductCard;
  isAboveFold: boolean;
  onOpen: (productId: string) => void;
}) {
  // Remember WHICH url failed, so a changed thumbnail (e.g. an edited listing)
  // is tried again instead of keeping the placeholder forever.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const shouldShowImage = Boolean(product.thumbnailUrl) && product.thumbnailUrl !== failedUrl;

  return (
    <button
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

import { useState } from 'react';
import { Icon } from 'zmp-ui';

import Price from '@/components/price';
import { actionLabels } from '@/features/my-listings/constants/messages';
import {
  myListingCardClass,
  myListingThumbnailClass,
} from '@/features/my-listings/constants/styles';
import { ListingAction, StatusTone, type MyListing } from '@/features/my-listings/types/my-listing';
import { getListingActions, getStatusLine } from '@/features/my-listings/utils/my-listing';

// Square 400×400 thumbnails shown at 88px; the attributes reserve space before the image loads.
const THUMBNAIL_SIZE = 400;

const statusToneClass: Record<StatusTone, string> = {
  [StatusTone.Muted]: 'text-marketplace-muted',
  [StatusTone.Progress]: 'text-marketplace-blue',
  [StatusTone.Danger]: 'font-semibold text-marketplace-danger',
};

// Above the card's full-size open button, so their taps are their own.
const raisedClass = 'relative z-[1]';
const moreButtonClass = `${raisedClass} -mr-1.5 -mt-1.5 grid size-11 flex-none place-items-center self-start rounded-full border-0 bg-transparent p-0 text-marketplace-muted`;
const editButtonClass = `${raisedClass} mt-2 min-h-8 rounded-lg border-0 bg-marketplace-tint-soft px-3 text-caption font-semibold text-marketplace-blue`;

export default function MyListingCard({
  listing,
  onOpen,
  onOpenActions,
  onAction,
}: {
  listing: MyListing;
  onOpen: (listingId: string) => void;
  onOpenActions: (listing: MyListing) => void;
  onAction: (listingId: string, action: ListingAction) => void;
}) {
  // Remember WHICH url failed, so a changed thumbnail (e.g. after an edit) is tried again.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const shouldShowImage = Boolean(listing.thumbnailUrl) && listing.thumbnailUrl !== failedUrl;

  const statusLine = getStatusLine(listing);
  const hasActions = getListingActions(listing.status).length > 0;
  const isFailed = listing.status === 'FAILED';

  return (
    <article className={myListingCardClass}>
      {/* The whole card opens the listing; the buttons inside sit above this one. */}
      <button
        aria-label={`Xem chi tiết ${listing.title}`}
        className="absolute inset-0 rounded-[inherit] border-0 bg-transparent p-0"
        type="button"
        onClick={() => onOpen(listing.id)}
      />
      <div className={myListingThumbnailClass}>
        {shouldShowImage ? (
          <img
            alt=""
            className="block size-full object-cover"
            decoding="async"
            height={THUMBNAIL_SIZE}
            loading="lazy"
            src={listing.thumbnailUrl ?? undefined}
            width={THUMBNAIL_SIZE}
            onError={() => setFailedUrl(listing.thumbnailUrl)}
          />
        ) : (
          <span
            className="grid size-full place-items-center text-marketplace-subtle"
            aria-hidden="true"
          >
            <Icon icon="zi-photo" size={28} />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="m-0 line-clamp-2 text-sm font-semibold leading-5 text-marketplace-ink">
          {listing.title}
        </h3>
        <Price className="mb-0 mt-1 text-sm leading-[18px]" value={listing.price} />
        <p className={`m-0 mt-1 text-caption leading-[18px] ${statusToneClass[statusLine.tone]}`}>
          {statusLine.label}
        </p>
        {statusLine.hint && (
          <p className="m-0 mt-0.5 text-caption leading-[18px] text-marketplace-muted">
            {statusLine.hint}
          </p>
        )}
        {isFailed && (
          <button
            className={editButtonClass}
            type="button"
            onClick={() => onAction(listing.id, ListingAction.Edit)}
          >
            {actionLabels[ListingAction.Edit]}
          </button>
        )}
      </div>

      {hasActions && (
        <button
          aria-label={`Tuỳ chọn cho ${listing.title}`}
          className={moreButtonClass}
          type="button"
          onClick={() => onOpenActions(listing)}
        >
          <Icon icon="zi-more-horiz" size={22} />
        </button>
      )}
    </article>
  );
}

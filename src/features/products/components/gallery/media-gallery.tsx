import { useMemo, useRef, useState } from 'react';

import GalleryVideo from '@/features/products/components/gallery/gallery-video';
import MediaLightbox from '@/features/products/components/gallery/media-lightbox';
import { ProductDetail } from '@/features/products/types/product';
import { thumbHashUrl } from '@/utils/thumbhash';

type ProductMedia = ProductDetail['media'];

const slideClass =
  'relative block aspect-square w-full shrink-0 snap-center overflow-hidden border-0 bg-black p-0';
// Media keeps its own aspect ratio; the black slide shows around it.
const contentClass = 'relative block aspect-square w-full object-contain';
// The ThumbHash blur behind a photo while it downloads.
const blurClass = 'absolute inset-0 size-full object-contain';

export default function ProductMediaGallery({
  media,
  productTitle,
  canLoadMedia,
}: {
  media: ProductMedia;
  productTitle: string;
  canLoadMedia: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  if (media.length === 0 || !canLoadMedia) {
    return <div className="aspect-square w-full bg-marketplace-skeleton" />;
  }

  const handleScroll = () => {
    const track = trackRef.current;
    if (track && track.clientWidth > 0) {
      setActiveIndex(Math.round(track.scrollLeft / track.clientWidth));
    }
  };

  // Back on the slide the lightbox was left on, not the one it was opened from.
  const handleLightboxClose = (index: number) => {
    setIsLightboxOpen(false);
    setActiveIndex(index);
    if (trackRef.current) {
      trackRef.current.scrollLeft = index * trackRef.current.clientWidth;
    }
  };

  return (
    <>
      <div className="relative aspect-square w-full overflow-hidden bg-black">
        {/* Contained: in Reels, a right swipe on the first photo would carry the pager back. */}
        <div
          ref={trackRef}
          data-gallery-track
          onScroll={handleScroll}
          className="flex size-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {media.map((item, index) => {
            // Only the slides that load eagerly decode their blur, so a long gallery adds no work.
            const isNear = Math.abs(index - activeIndex) <= 1;
            return item.type === 'VIDEO' ? (
              <GalleryVideo
                key={item.id}
                item={item}
                title={productTitle}
                isActive={index === activeIndex}
                isCovered={isLightboxOpen}
                canShowBlur={isNear}
                slideClass={slideClass}
                onOpen={() => setIsLightboxOpen(true)}
              />
            ) : (
              <GalleryPhoto
                key={item.id}
                item={item}
                title={productTitle}
                isNear={isNear}
                onOpen={() => setIsLightboxOpen(true)}
              />
            );
          })}
        </div>

        <span
          className="pointer-events-none absolute bottom-3 right-3 z-[2] rounded-full bg-black/[.58] px-[9px] py-[5px] text-xs tabular-nums text-white"
          aria-label={`Nội dung ${activeIndex + 1} trên ${media.length}`}
        >
          {activeIndex + 1} / {media.length}
        </span>
      </div>

      {isLightboxOpen && (
        <MediaLightbox
          media={media}
          startIndex={activeIndex}
          productTitle={productTitle}
          onClose={handleLightboxClose}
        />
      )}
    </>
  );
}

function GalleryPhoto({
  item,
  title,
  isNear,
  onOpen,
}: {
  item: ProductMedia[number];
  title: string;
  isNear: boolean;
  onOpen: () => void;
}) {
  const src = item.mediumUrl ?? item.thumbnailUrl ?? '';
  // The blur only stands in while the photo loads; then it is dropped from the DOM.
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const placeholderUrl = useMemo(
    () => (isNear ? thumbHashUrl(item.placeholder) : null),
    [isNear, item.placeholder],
  );

  return (
    <button aria-label="Phóng to ảnh" className={slideClass} type="button" onClick={onOpen}>
      {placeholderUrl && src !== loadedSrc && (
        <img alt="" aria-hidden className={blurClass} src={placeholderUrl} />
      )}
      {/* One image per slide: swapping a thumbnail for the larger
          file mid-swipe changed its aspect ratio and made it jump. */}
      <img
        alt={title}
        className={contentClass}
        loading={isNear ? 'eager' : 'lazy'}
        src={src}
        onLoad={() => setLoadedSrc(src)}
      />
    </button>
  );
}

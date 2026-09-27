import { type ComponentRef, useRef, useState } from 'react';
import { Swiper } from 'zmp-ui';

import MediaLightbox from '@/features/products/components/gallery/media-lightbox';
import { ProductDetail } from '@/features/products/types/product';

type ProductMedia = ProductDetail['media'];

const slideClass = 'relative block aspect-square w-full overflow-hidden border-0 bg-black p-0';
// Media keeps its own aspect ratio; the black slide shows around it.
const contentClass = 'block aspect-square w-full object-contain';

export default function ProductMediaGallery({
  media,
  productTitle,
}: {
  media: ProductMedia;
  productTitle: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Looping clones the first and last slides, so videos are found in the DOM.
  const galleryRef = useRef<HTMLDivElement>(null);
  // zmp-ui does not export the ref's type from its entry.
  const swiperRef = useRef<ComponentRef<typeof Swiper>>(null);

  // Back on the slide the lightbox was left on, not the one it was opened from.
  const handleLightboxClose = (index: number) => {
    setIsLightboxOpen(false);
    swiperRef.current?.goTo(index);
  };

  if (media.length === 0) {
    return <div className="aspect-square w-full bg-marketplace-skeleton" />;
  }

  const handleSlideChange = (nextIndex: number) => {
    galleryRef.current?.querySelectorAll('video').forEach((video) => video.pause());
    setActiveIndex(nextIndex);
  };

  return (
    <>
      <div className="relative aspect-square w-full overflow-hidden bg-black" ref={galleryRef}>
        <Swiper
          ref={swiperRef}
          afterChange={handleSlideChange}
          // zmp-ui dims inactive slides to 0.8, but with `loop` it also dims the
          // active one on the last slide (its index check skips the clones),
          // and on iOS that dimmed slide paints over the counter.
          className="aspect-square size-full overflow-hidden rounded-none bg-black [&_.zaui-swiper-item]:!opacity-100"
          defaultActive={0}
          dots={false}
          loop={media.length > 1}
        >
          {media.map((item, index) => (
            <Swiper.Slide key={item.id}>
              {item.type === 'VIDEO' ? (
                <div className={slideClass}>
                  <video
                    aria-label={`Video: ${productTitle}`}
                    className={`${contentClass} bg-transparent`}
                    controls
                    playsInline
                    poster={item.thumbnailUrl ?? undefined}
                    preload="none"
                    src={index === activeIndex ? (item.mediumUrl ?? undefined) : undefined}
                  />
                </div>
              ) : (
                <button
                  aria-label="Phóng to ảnh"
                  className={slideClass}
                  type="button"
                  onClick={() => setIsLightboxOpen(true)}
                >
                  {/* One image per slide: swapping a thumbnail for the larger
                      file mid-swipe changed its aspect ratio and made it jump. */}
                  <img
                    alt={productTitle}
                    className={contentClass}
                    loading={isNearSlide(index, activeIndex, media.length) ? 'eager' : 'lazy'}
                    src={item.mediumUrl ?? item.thumbnailUrl ?? ''}
                  />
                </button>
              )}
            </Swiper.Slide>
          ))}
        </Swiper>

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

/** Whether a slide is the active one or a neighbour, counting across the loop seam. */
export function isNearSlide(index: number, activeIndex: number, slideCount: number) {
  const distance = Math.abs(index - activeIndex);
  return Math.min(distance, slideCount - distance) <= 1;
}

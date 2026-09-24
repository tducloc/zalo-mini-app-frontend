import { useMemo, useRef, useState } from 'react';
import { ImageViewer, Swiper } from 'zmp-ui';

import { ProductDetail } from '../types';
import { getViewerIndex, isNearSlide } from '../utils/gallery';

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

  const [imageViewerOpen, setImageViewerOpen] = useState(false);

  // Looping clones the first and last slides, so videos are found in the DOM.
  const galleryRef = useRef<HTMLDivElement>(null);

  const viewerImages = useMemo(
    () =>
      media
        .filter((item) => item.type === 'IMAGE' && (item.mediumUrl || item.thumbnailUrl))
        .map((item) => ({ src: item.mediumUrl ?? item.thumbnailUrl ?? '', alt: productTitle })),
    [media, productTitle],
  );

  if (media.length === 0) {
    return <div className="product-detail-image-placeholder" />;
  }

  const handleSlideChange = (nextIndex: number) => {
    galleryRef.current?.querySelectorAll('video').forEach((video) => video.pause());
    setActiveIndex(nextIndex);
  };

  return (
    <>
      <div className="product-detail-gallery" ref={galleryRef}>
        <Swiper
          afterChange={handleSlideChange}
          // zmp-ui dims inactive slides to 0.8, but with `loop` it also dims the
          // active one on the last slide (its index check skips the clones),
          // and on iOS that dimmed slide paints over the counter.
          className="product-detail-swiper [&_.zaui-swiper-item]:!opacity-100"
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
                  onClick={() => setImageViewerOpen(true)}
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
          className="product-detail-gallery-counter"
          aria-label={`Nội dung ${activeIndex + 1} trên ${media.length}`}
        >
          {activeIndex + 1} / {media.length}
        </span>
      </div>

      {imageViewerOpen && viewerImages.length > 0 && (
        <ImageViewer
          activeIndex={getViewerIndex(media, activeIndex)}
          images={viewerImages}
          visible={imageViewerOpen}
          onClose={() => setImageViewerOpen(false)}
        />
      )}
    </>
  );
}

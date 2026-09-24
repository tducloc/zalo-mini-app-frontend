import { useMemo, useRef, useState } from 'react';
import { ImageViewer, Swiper } from 'zmp-ui';

import { ProductDetail } from '../types';
import { getViewerIndex } from '../utils/gallery';

type ProductMedia = ProductDetail['media'];

export default function ProductMediaGallery({
  media,
  productTitle,
}: {
  media: ProductMedia;
  productTitle: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  const [imageViewerOpen, setImageViewerOpen] = useState(false);

  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

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
    Object.values(videoRefs.current).forEach((video) => video?.pause());
    setActiveIndex(nextIndex);
  };

  return (
    <>
      <div className="product-detail-gallery">
        <Swiper
          afterChange={handleSlideChange}
          className="product-detail-swiper"
          defaultActive={0}
          dots={false}
        >
          {media.map((item, index) => (
            <Swiper.Slide key={item.id}>
              {item.type === 'VIDEO' ? (
                <div className="relative aspect-square overflow-hidden bg-black">
                  {/* Blurred poster fills the letterbox around portrait videos. */}
                  {item.thumbnailUrl && (
                    <img
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 size-full scale-110 object-cover opacity-60 blur-2xl"
                      src={item.thumbnailUrl}
                    />
                  )}
                  <video
                    aria-label={`Video: ${productTitle}`}
                    className="relative block aspect-square w-full bg-transparent object-contain"
                    controls
                    playsInline
                    poster={item.thumbnailUrl ?? undefined}
                    preload="none"
                    ref={(element) => {
                      videoRefs.current[item.id] = element;
                    }}
                    src={index === activeIndex ? (item.mediumUrl ?? undefined) : undefined}
                  />
                </div>
              ) : (
                <button
                  aria-label="Phóng to ảnh"
                  className="product-detail-image-button"
                  onClick={() => setImageViewerOpen(true)}
                >
                  <img
                    className="product-detail-media"
                    loading={index === activeIndex ? 'eager' : 'lazy'}
                    src={
                      index === activeIndex
                        ? (item.mediumUrl ?? item.thumbnailUrl ?? '')
                        : (item.thumbnailUrl ?? '')
                    }
                    alt={productTitle}
                  />
                </button>
              )}
            </Swiper.Slide>
          ))}
        </Swiper>

        {media.length > 0 && (
          <span
            className="product-detail-gallery-counter"
            aria-label={`Nội dung ${activeIndex + 1} trên ${media.length}`}
          >
            {activeIndex + 1} / {media.length}
          </span>
        )}
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

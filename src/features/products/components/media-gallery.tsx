import { useMemo, useRef, useState } from 'react';
import { Icon, ImageViewer, Swiper } from 'zmp-ui';
import type { SwiperRefObject } from 'zmp-ui/swiper';

import { ProductDetail } from '../types';

type ProductMedia = ProductDetail['media'];

function getViewerIndex(media: ProductMedia, activeIndex: number) {
  return Math.max(
    0,
    media.slice(0, activeIndex).filter((item) => item.type === 'IMAGE').length - 1,
  );
}

export default function ProductMediaGallery({
  media,
  productTitle,
}: {
  media: ProductMedia;
  productTitle: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  const [imageViewerOpen, setImageViewerOpen] = useState(false);

  const swiperRef = useRef<SwiperRefObject>(null);

  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  const activeMedia = media[activeIndex] ?? media[0];

  const viewerImages = useMemo(
    () =>
      media
        .filter((item) => item.type === 'IMAGE' && (item.mediumUrl || item.thumbnailUrl))
        .map((item) => ({ src: item.mediumUrl ?? item.thumbnailUrl ?? '', alt: productTitle })),
    [media, productTitle],
  );

  if (!activeMedia) {
    return <div className="product-detail-image-placeholder" />;
  }

  const handleSlideChange = (nextIndex: number) => {
    Object.values(videoRefs.current).forEach((video) => video?.pause());
    setActiveIndex(nextIndex);
  };

  return (
    <>
      <Swiper
        afterChange={handleSlideChange}
        className="product-detail-swiper"
        defaultActive={0}
        dots={media.length > 1}
        ref={swiperRef}
      >
        {media.map((item, index) => (
          <Swiper.Slide key={item.id}>
            {item.type === 'VIDEO' ? (
              <video
                className="product-detail-media"
                controls
                ref={(element) => {
                  videoRefs.current[item.id] = element;
                }}
                poster={item.thumbnailUrl ?? undefined}
                preload={index === activeIndex ? 'metadata' : 'none'}
                src={index === activeIndex ? (item.mediumUrl ?? undefined) : undefined}
              />
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

      {media.length > 1 && (
        <div className="product-detail-thumbnails" aria-label="Ảnh và video sản phẩm">
          {media.map((item, index) => (
            <button
              aria-label={`Xem ${item.type === 'VIDEO' ? 'video' : 'ảnh'} ${item.sortOrder + 1}`}
              className={item.id === activeMedia.id ? 'selected' : ''}
              key={item.id}
              onClick={() => swiperRef.current?.goTo(index)}
            >
              <img src={item.thumbnailUrl ?? item.mediumUrl ?? ''} alt="" />
              {item.type === 'VIDEO' && <Icon icon="zi-play" size={16} />}
            </button>
          ))}
        </div>
      )}

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

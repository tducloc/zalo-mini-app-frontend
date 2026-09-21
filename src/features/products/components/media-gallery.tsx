import { useMemo, useRef, useState } from 'react';
import { ImageViewer, Swiper } from 'zmp-ui';

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

  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);

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
    setPlayingVideoId(null);
    setActiveIndex(nextIndex);
  };

  const toggleVideo = async (id: string) => {
    const video = videoRefs.current[id];
    if (!video) return;
    if (video.paused) {
      await video.play();
      return;
    }
    video.pause();
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
                <button
                  aria-label={playingVideoId === item.id ? 'Tạm dừng video' : 'Phát video'}
                  className="product-detail-video-button"
                  onClick={() => void toggleVideo(item.id)}
                >
                  <video
                    className="product-detail-media"
                    muted
                    playsInline
                    ref={(element) => {
                      videoRefs.current[item.id] = element;
                    }}
                    preload={index === activeIndex ? 'metadata' : 'none'}
                    src={index === activeIndex ? (item.mediumUrl ?? undefined) : undefined}
                    onEnded={() => setPlayingVideoId(null)}
                    onPause={() => setPlayingVideoId(null)}
                    onPlay={() => setPlayingVideoId(item.id)}
                  />
                  {playingVideoId !== item.id && <span aria-hidden="true">▶</span>}
                </button>
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

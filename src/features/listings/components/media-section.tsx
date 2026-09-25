import { type ChangeEvent, useCallback, useState } from 'react';

import MediaAddTile from '@/features/listings/components/media-add-tile';
import MediaSheet from '@/features/listings/components/media-sheet';
import MediaViewer from '@/features/listings/components/media-viewer';
import MediaTile from '@/features/listings/components/media-tile';
import { useReplaceMedia } from '@/features/listings/hooks/use-replace-media';
import { addDraftFiles, removeDraftMedia } from '@/features/listings/draft/media-intake';
import { refusedFilesMessage } from '@/features/listings/draft/media-messages';
import { type DraftMedia, MediaActionType } from '@/features/listings/draft/media-reducer';
import { retryUpload } from '@/features/listings/draft/media-upload';
import { countNeedingAttention, TileTone, tileView } from '@/features/listings/draft/media-view';
import { ImageFormat } from '@/features/media/image/image-utils';
import { MAX_IMAGES_PER_LISTING, MediaKind } from '@/features/media/media-utils';
import { MAX_VIDEO_DURATION_MS, VideoFormat } from '@/features/media/video/video-utils';
import { useToast } from '@/hooks/use-toast';
import { useListingDraftStore } from '@/stores/listing-draft';

// Only the formats the app takes: iOS then hands over a HEIC photo as JPEG.
const PHOTO_TYPES = Object.values(ImageFormat).join(',');
const VIDEO_TYPES = Object.values(VideoFormat).join(',');

/**
 * The form's photos (the first is the cover) and its video, on the draft store: picking
 * adds files to the draft, where they are checked, optimized and uploaded (L4, L5) while
 * the seller fills in the rest.
 */
export default function MediaSection() {
  const { showError } = useToast();

  const media = useListingDraftStore((state) => state.media);
  const dispatchMedia = useListingDraftStore((state) => state.dispatchMedia);
  const [openId, setOpenId] = useState<string | null>(null);

  const photos = media.filter((item) => item.kind === MediaKind.Image);
  const video = media.find((item) => item.kind === MediaKind.Video);
  const attentionCount = countNeedingAttention(media);

  const nameOf = (item: DraftMedia) =>
    item.kind === MediaKind.Video ? 'Video' : `Ảnh ${photos.indexOf(item) + 1}`;
  // An error opens the sheet; anything else, the full-screen viewer.
  const opened = media.find((item) => item.id === openId) ?? null;
  const openedView = opened && tileView(opened);
  const isOpenedError = openedView?.tone === TileTone.Error;
  const viewed = isOpenedError ? null : opened;

  const handlePick = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    // Picking the same file again must fire change again.
    event.target.value = '';
    if (files.length === 0) {
      return;
    }

    const refused = await addDraftFiles(files);
    if (refused.length > 0) {
      showError(refusedFilesMessage(refused));
    }
  };

  // Stable: the viewer listens for Escape with it, and tiles re-render as files upload.
  const handleClose = useCallback(() => setOpenId(null), []);

  const { startReplace: handleReplaceStart, replaceInputs } = useReplaceMedia({
    photoTypes: PHOTO_TYPES,
    videoTypes: VIDEO_TYPES,
    onReplaced: handleClose,
    onRefused: (refused) => showError(refusedFilesMessage(refused)),
  });

  const handleRetry = () => {
    if (openId) {
      retryUpload(openId);
    }
    handleClose();
  };

  const handleMakeCover = () => {
    if (openId) {
      dispatchMedia({ type: MediaActionType.CoverChosen, id: openId });
    }
    handleClose();
  };

  const handleRemove = () => {
    if (openId) {
      removeDraftMedia(openId);
    }
    handleClose();
  };

  return (
    <section className="form-section">
      <h2>Hình ảnh sản phẩm</h2>
      <p className="ui-muted">Ảnh đầu tiên là ảnh bìa, hiển thị trên thẻ tin.</p>

      <div className="field-heading">
        <b>
          Ảnh <em>*</em>
        </b>
        <span>
          {photos.length}/{MAX_IMAGES_PER_LISTING} ảnh
        </span>
      </div>
      <ul className="m-0 grid list-none grid-cols-4 gap-2.5 p-0">
        {photos.map((item, index) => (
          <MediaTile
            key={item.id}
            name={nameOf(item)}
            view={tileView(item)}
            isVideo={false}
            isCover={index === 0}
            onOpen={() => setOpenId(item.id)}
            onRemove={() => removeDraftMedia(item.id)}
            onReplace={() => handleReplaceStart(item)}
          />
        ))}
        {photos.length < MAX_IMAGES_PER_LISTING && (
          <MediaAddTile label="Thêm ảnh" accept={PHOTO_TYPES} isMultiple onPick={handlePick} />
        )}
      </ul>

      <div className="field-heading">
        <b>Video</b>
        <span>Tuỳ chọn · tối đa {MAX_VIDEO_DURATION_MS / 1000} giây</span>
      </div>
      <ul className="m-0 grid list-none grid-cols-4 gap-2.5 p-0">
        {video ? (
          <MediaTile
            name="Video"
            view={tileView(video)}
            isVideo
            isCover={false}
            onOpen={() => setOpenId(video.id)}
            onRemove={() => removeDraftMedia(video.id)}
            onReplace={() => handleReplaceStart(video)}
          />
        ) : (
          <MediaAddTile
            label="Thêm video"
            accept={VIDEO_TYPES}
            isMultiple={false}
            onPick={handlePick}
          />
        )}
      </ul>

      {attentionCount > 0 && (
        <p className="field-error" role="status">
          Vui lòng chạm vào {attentionCount} tệp có dấu chấm than để xử lý.
        </p>
      )}

      <MediaSheet
        name={opened && isOpenedError ? nameOf(opened) : null}
        view={isOpenedError ? openedView : null}
        onRetry={handleRetry}
        onReplace={() => opened && handleReplaceStart(opened)}
        onRemove={handleRemove}
        onClose={handleClose}
      />
      <MediaViewer
        name={viewed && nameOf(viewed)}
        isVideo={viewed?.kind === MediaKind.Video}
        imageUrl={openedView?.imageUrl ?? null}
        file={viewed && ('upload' in viewed ? viewed.upload.blob : viewed.file)}
        status={openedView?.tone === TileTone.Waiting ? openedView.detail : null}
        canBeCover={!!viewed && viewed.kind === MediaKind.Image && photos[0] !== viewed}
        onMakeCover={handleMakeCover}
        onRemove={handleRemove}
        onClose={handleClose}
      />

      {replaceInputs}
    </section>
  );
}

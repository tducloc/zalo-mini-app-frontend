import {
  type Announcements,
  DndContext,
  type DragEndEvent,
  MouseSensor,
  TouchSensor,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { rectSortingStrategy, SortableContext } from '@dnd-kit/sortable';
import { type ChangeEvent, useState } from 'react';
import { Icon } from 'zmp-ui';

import MediaAddTile from '@/features/listings/components/media-add-tile';
import MediaTile from '@/features/listings/components/media-tile';
import MediaViewer from '@/features/listings/components/media-viewer';
import { missingPhotoMessage, refusedFilesMessage } from '@/features/listings/constants/messages';
import { addDraftFiles, removeDraftMedia } from '@/features/listings/services/add-media';
import { retryUpload } from '@/features/listings/services/upload-media';
import type { DraftMedia } from '@/features/listings/types/draft-media';
import { isFailed } from '@/features/listings/utils/draft-media';
import { tileView } from '@/features/listings/utils/tile-view';
import { PHOTO_ACCEPT, VIDEO_ACCEPT } from '@/features/media/constants/formats';
import { MAX_IMAGES_PER_LISTING, MAX_VIDEO_SECONDS } from '@/features/media/constants/limits';
import { MediaKind } from '@/features/media/types/media';
import { takePickedFiles } from '@/features/media/utils/media';
import { useToast } from '@/hooks/use-toast';
import { useListingDraftStore } from '@/stores/listing-draft';

const TILE_GRID_CLASS = 'm-0 grid list-none grid-cols-4 gap-2.5 p-0';
const VIDEO_NAME = 'Video';
/**
 * A drag starts after a still press, so a quick swipe over the grid still scrolls the
 * page, and a tap, even a slow one, still opens the tile.
 */
const HOLD_TO_DRAG = { delay: 350, tolerance: 5 };

/** What will be uploaded (a shrunk photo, a converted clip), else what was picked. */
const fileOf = (item: DraftMedia) => item.upload?.blob ?? item.file;

const photoName = (index: number) => `Ảnh ${index + 1}`;

/**
 * The form's photos (the first is the cover; hold and drag to reorder) and its video, on
 * the draft store: picking adds files to the draft, where they are checked, optimized and
 * uploaded (L4, L5) while the seller fills in the rest.
 */
export default function MediaSection({
  isPhotoMissing,
}: {
  /** Post was tapped without a photo. */
  isPhotoMissing: boolean;
}) {
  const { showError } = useToast();

  const media = useListingDraftStore((state) => state.media);
  const moveMedia = useListingDraftStore((state) => state.moveMedia);
  const isPosting = useListingDraftStore((state) => state.isPosting);
  const [openId, setOpenId] = useState<string | null>(null);

  // Mouse too, for Zalo on PC and testing in a desktop browser.
  const sensors = useSensors(
    useSensor(TouchSensor, { activationConstraint: HOLD_TO_DRAG }),
    useSensor(MouseSensor, { activationConstraint: HOLD_TO_DRAG }),
  );

  const photos = media.filter((item) => item.kind === MediaKind.Image);
  const video = media.find((item) => item.kind === MediaKind.Video);
  const failedCount = media.filter(isFailed).length;
  const opened = media.find((item) => item.id === openId);

  const handlePick = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = takePickedFiles(event.target);
    if (files.length === 0) {
      return;
    }

    const refused = await addDraftFiles(files);
    if (refused.length > 0) {
      showError(refusedFilesMessage(refused));
    }
  };

  // What a screen reader hears while a photo is dragged, instead of dnd-kit's English.
  const positionOf = (id: UniqueIdentifier) => photos.findIndex((item) => item.id === id) + 1;
  // The video tile shares the DndContext, so it is a drop target too; a photo only goes
  // where another photo is.
  const photoUnder = (over: { id: UniqueIdentifier } | null) =>
    over && positionOf(over.id) > 0 ? over : null;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Đã nhấc ảnh ${positionOf(active.id)}.`,
    onDragOver: ({ over }) => {
      const target = photoUnder(over);
      return target ? `Vị trí ${positionOf(target.id)}.` : undefined;
    },
    onDragEnd: ({ over }) => {
      const target = photoUnder(over);
      return target ? `Đã đặt vào vị trí ${positionOf(target.id)}.` : 'Đã huỷ kéo ảnh.';
    },
    onDragCancel: () => 'Đã huỷ kéo ảnh.',
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const target = photoUnder(over);
    if (target && active.id !== target.id) {
      moveMedia(String(active.id), String(target.id));
    }
  };

  const handleClose = () => setOpenId(null);

  const makeCover = (id: string) => moveMedia(id, photos[0].id);

  /** A viewer action: do it to the opened file, then close. */
  const actOn = (id: string, action: (id: string) => void) => () => {
    action(id);
    handleClose();
  };

  return (
    <section className="form-section">
      <h2>Hình ảnh sản phẩm</h2>
      <p className="ui-muted">
        Ảnh đầu tiên là ảnh bìa, hiển thị trên thẻ tin. Nhấn giữ rồi kéo để đổi thứ tự.
      </p>

      <div className="field-heading">
        <b>
          Ảnh <em>*</em>
        </b>
        <span>
          {photos.length}/{MAX_IMAGES_PER_LISTING} ảnh
        </span>
      </div>
      {/* Around the video too, whose tile uses the same hook, disabled. */}
      <DndContext sensors={sensors} accessibility={{ announcements }} onDragEnd={handleDragEnd}>
        {/* The draft stays as sent while the post is on its way. */}
        <SortableContext items={photos} strategy={rectSortingStrategy} disabled={isPosting}>
          <ul className={TILE_GRID_CLASS}>
            {photos.map((item, index) => (
              <MediaTile
                key={item.id}
                id={item.id}
                name={photoName(index)}
                view={tileView(item)}
                isVideo={false}
                file={fileOf(item)}
                isCover={index === 0}
                onOpen={() => setOpenId(item.id)}
                onRemove={() => removeDraftMedia(item.id)}
              />
            ))}
            {photos.length < MAX_IMAGES_PER_LISTING && (
              <MediaAddTile label="Thêm ảnh" accept={PHOTO_ACCEPT} isMultiple onPick={handlePick} />
            )}
          </ul>
        </SortableContext>

        {isPhotoMissing && (
          <p className="field-error" role="alert">
            {missingPhotoMessage}
          </p>
        )}

        <div className="field-heading">
          <b>Video</b>
          <span>Tuỳ chọn · tối đa {MAX_VIDEO_SECONDS} giây</span>
        </div>
        <ul className={TILE_GRID_CLASS}>
          {video ? (
            <MediaTile
              id={video.id}
              name={VIDEO_NAME}
              view={tileView(video)}
              isVideo
              file={fileOf(video)}
              isCover={false}
              onOpen={() => setOpenId(video.id)}
              onRemove={() => removeDraftMedia(video.id)}
            />
          ) : (
            <MediaAddTile
              label="Thêm video"
              accept={VIDEO_ACCEPT}
              isMultiple={false}
              onPick={handlePick}
            />
          )}
        </ul>
      </DndContext>

      {failedCount > 0 && (
        <p
          role="status"
          className="m-0 mt-3 flex items-center gap-2 rounded-lg bg-marketplace-danger/10 px-3 py-2 text-sm text-marketplace-danger"
        >
          <Icon icon="zi-warning-circle-solid" size={18} className="shrink-0" />
          {failedCount} tệp cần xử lý. Vui lòng chạm vào ô có dấu chấm than để xem.
        </p>
      )}

      {opened && (
        <MediaViewer
          key={opened.id}
          name={opened.kind === MediaKind.Video ? VIDEO_NAME : photoName(photos.indexOf(opened))}
          view={tileView(opened)}
          isVideo={opened.kind === MediaKind.Video}
          file={fileOf(opened)}
          onRetry={actOn(opened.id, retryUpload)}
          onMakeCover={photos.indexOf(opened) > 0 ? actOn(opened.id, makeCover) : null}
          onRemove={actOn(opened.id, removeDraftMedia)}
          onClose={handleClose}
        />
      )}
    </section>
  );
}

import { Button } from 'zmp-ui';

import AppSheet from '@/components/app-sheet';
import type { TileView } from '@/features/listings/draft/media-view';

interface MediaSheetProps {
  /** The tile's name, "Ảnh 2" or "Video"; null keeps the sheet closed. */
  name: string | null;
  view: TileView | null;
  onRetry: () => void;
  onReplace: () => void;
  onRemove: () => void;
  onClose: () => void;
}

/**
 * Why a file failed and what the seller can do: retry when another attempt can help, or
 * remove. Only for errors; a file that is fine opens in the full-screen viewer.
 */
export default function MediaSheet({
  name,
  view,
  onRetry,
  onReplace,
  onRemove,
  onClose,
}: MediaSheetProps) {
  return (
    <AppSheet visible={view !== null} title={name ?? ''} autoHeight onClose={onClose}>
      {view && (
        <div className="flex flex-col gap-3 px-4 pb-6">
          {view.imageUrl && (
            <img src={view.imageUrl} alt="" className="max-h-56 w-full rounded-xl object-contain" />
          )}

          {view.detail && (
            <p role="alert" className="m-0 text-sm text-marketplace-danger">
              {view.detail}
            </p>
          )}

          {view.canRetry && (
            <Button fullWidth onClick={onRetry}>
              Thử lại
            </Button>
          )}
          <Button fullWidth variant={view.canRetry ? 'secondary' : 'primary'} onClick={onReplace}>
            Chọn tệp khác
          </Button>
          <Button fullWidth variant="tertiary" type="danger" onClick={onRemove}>
            Xoá
          </Button>
        </div>
      )}
    </AppSheet>
  );
}

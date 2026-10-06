import Skeleton from '@/components/feedback/skeleton';
import {
  listingCardClass,
  listingCopyClass,
  listingGridClass,
  listingEmptyBackdropClass,
  listingImageClass,
} from '@/features/feed/constants/styles';
import { gridColumnsStyle } from '@/features/feed/utils/feed-grid';

const lineClass = 'h-2.5 rounded-lg';

export default function ListingGridSkeleton({
  columns,
  count,
}: {
  columns: number;
  count: number;
}) {
  return (
    <div
      className={listingGridClass}
      role="status"
      style={gridColumnsStyle(columns)}
      aria-label="Đang tải tin đăng"
      aria-busy="true"
    >
      {Array.from({ length: count }, (_, index) => (
        <div className={listingCardClass} key={index} aria-hidden="true">
          <Skeleton className={`${listingImageClass} ${listingEmptyBackdropClass}`} />
          <div className={listingCopyClass}>
            <Skeleton className={`mt-1 ${lineClass}`} />
            <Skeleton className={`mt-2.5 w-[62%] ${lineClass}`} />
            <Skeleton className={`mt-3.5 w-[45%] ${lineClass}`} />
          </div>
        </div>
      ))}
    </div>
  );
}

import Skeleton from '@/components/feedback/skeleton';
import {
  myListingCardClass,
  myListingEmptyBackdropClass,
  myListingStackClass,
  myListingThumbnailClass,
} from '@/features/my-listings/constants/styles';

const lineClass = 'h-2.5 rounded-lg';

export default function MyListingSkeleton({ count }: { count: number }) {
  return (
    <div
      className={myListingStackClass}
      role="status"
      aria-label="Đang tải tin của bạn"
      aria-busy="true"
    >
      {Array.from({ length: count }, (_, index) => (
        <div className={myListingCardClass} key={index} aria-hidden="true">
          <Skeleton className={`${myListingThumbnailClass} ${myListingEmptyBackdropClass}`} />
          <div className="flex-1 pt-1">
            <Skeleton className={lineClass} />
            <Skeleton className={`mt-2.5 w-[70%] ${lineClass}`} />
            <Skeleton className={`mt-3.5 w-[40%] ${lineClass}`} />
            <Skeleton className={`mt-3 w-[55%] ${lineClass}`} />
          </div>
        </div>
      ))}
    </div>
  );
}

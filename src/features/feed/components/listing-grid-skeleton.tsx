import Skeleton from '@/components/skeleton';

import { listingCardClass, listingCopyClass, listingGridClass, listingImageClass } from '../styles';

const lineClass = 'h-2.5 rounded-lg';

export default function ListingGridSkeleton({ count }: { count: number }) {
  return (
    <div className={listingGridClass} role="status" aria-label="Đang tải tin đăng" aria-busy="true">
      {Array.from({ length: count }, (_, index) => (
        <div className={listingCardClass} key={index} aria-hidden="true">
          <Skeleton className={listingImageClass} />
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

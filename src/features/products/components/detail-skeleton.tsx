import Skeleton from '@/components/skeleton';

const lineClass = 'mt-4 h-2.5 rounded-lg';

export default function DetailSkeleton() {
  return (
    <main className="product-detail-content product-detail-skeleton">
      <div className="product-detail-image-placeholder" />
      <div className="product-detail-skeleton-body">
        <Skeleton className={lineClass} />
        <Skeleton className={`${lineClass} w-[62%]`} />
        <Skeleton className={lineClass} />
      </div>
    </main>
  );
}

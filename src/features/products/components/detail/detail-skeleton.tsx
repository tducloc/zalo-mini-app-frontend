import Skeleton from '@/components/feedback/skeleton';

const lineClass = 'mt-4 h-2.5 rounded-lg';

export default function DetailSkeleton() {
  return (
    <main className="bg-white">
      <div className="aspect-square w-full bg-marketplace-skeleton" />
      <div className="px-4">
        <Skeleton className={lineClass} />
        <Skeleton className={`${lineClass} w-[62%]`} />
        <Skeleton className={lineClass} />
      </div>
    </main>
  );
}

/** Shimmering placeholder block; size and shape come from `className`. */
export default function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-shimmer bg-shimmer bg-[length:200%_100%] motion-reduce:animate-none ${className}`}
    />
  );
}

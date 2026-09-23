import { formatVnd } from '@/utils/format';

/** Brand-colored VND price; size/spacing default to the listing-card style. */
export default function Price({
  value,
  className = 'my-1 text-sm leading-[17px]',
}: {
  value: number;
  className?: string;
}) {
  return <p className={`font-bold text-marketplace-blue ${className}`}>{formatVnd(value)}</p>;
}

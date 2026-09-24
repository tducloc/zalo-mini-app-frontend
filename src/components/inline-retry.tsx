/** Compact "could not load X — retry" line for sections inside a page. */
export default function InlineRetry({
  message,
  onRetry,
  className = '',
}: {
  message: string;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <div className={`py-4 text-caption text-marketplace-muted ${className}`} role="status">
      {message}{' '}
      <button
        className="border-0 bg-transparent p-2 font-semibold text-marketplace-blue"
        type="button"
        onClick={onRetry}
      >
        Thử lại
      </button>
    </div>
  );
}

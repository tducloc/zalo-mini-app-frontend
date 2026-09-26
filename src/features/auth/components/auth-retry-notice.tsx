import { AUTH_ERROR_MESSAGE } from '@/features/auth/constants/auth';

/** Floating notice above the tab bar; the app stays usable underneath. */
export default function AuthRetryNotice({
  isRetrying = false,
  onRetry,
}: {
  isRetrying?: boolean;
  onRetry: () => void;
}) {
  return (
    <div
      className="fixed inset-x-4 bottom-[90px] z-[950] flex items-center justify-between gap-2 rounded-xl border border-solid border-marketplace-tint-strong bg-marketplace-surface px-3 py-2 text-caption text-marketplace-ink"
      role="status"
    >
      <span>{AUTH_ERROR_MESSAGE}</span>
      <button
        className="flex-none border-0 bg-transparent p-2 font-semibold text-marketplace-blue"
        disabled={isRetrying}
        type="button"
        onClick={onRetry}
      >
        {isRetrying ? 'Đang thử…' : 'Thử lại'}
      </button>
    </div>
  );
}

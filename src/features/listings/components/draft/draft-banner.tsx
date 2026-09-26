import { useNavigate } from 'zmp-ui';

import { UNFINISHED_DRAFT } from '@/features/listings/constants/messages';
import { hasDraft } from '@/features/listings/utils/listing-draft';
import { useListingDraftStore } from '@/stores/listing-draft';

/**
 * A draft waiting on the sell page, with the way back to it, on every other page: above
 * the tab bar, or in the product page's bottom bar. `className` places it.
 */
export default function DraftBanner({ className }: { className: string }) {
  const navigate = useNavigate();

  const isShown = useListingDraftStore((state) => hasDraft(state.fields, state.media));
  if (!isShown) {
    return null;
  }

  return (
    <aside
      aria-label="Tin đang đăng dở"
      className={`flex items-center gap-3 rounded-xl bg-marketplace-ink py-2 pl-4 pr-2 text-sm text-white ${className}`}
    >
      <span className="min-w-0 flex-1">{UNFINISHED_DRAFT}</span>
      <button
        type="button"
        onClick={() => navigate('/sell')}
        className="min-h-9 shrink-0 rounded-lg border-0 bg-white px-3 font-semibold text-marketplace-ink"
      >
        Tiếp tục
      </button>
    </aside>
  );
}

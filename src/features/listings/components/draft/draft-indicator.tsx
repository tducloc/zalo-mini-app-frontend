import { UNFINISHED_DRAFT } from '@/features/listings/constants/messages';
import { useHasDraft } from '@/stores/listing-draft';

/** The tab's `aria-describedby`: its name stays "Đăng tin", voice commands included. */
export const DRAFT_STATUS_ID = 'draft-status';

/** The dot on the tab bar's "Đăng tin" while a draft waits on the sell page. */
export default function DraftIndicator() {
  const isShown = useHasDraft();
  if (!isShown) {
    return null;
  }

  return (
    <>
      <span aria-hidden="true" className="marketplace-draft-indicator" />
      {/* Hidden, yet read as the tab's description. */}
      <span id={DRAFT_STATUS_ID} aria-hidden="true" className="sr-only">
        {UNFINISHED_DRAFT}
      </span>
    </>
  );
}

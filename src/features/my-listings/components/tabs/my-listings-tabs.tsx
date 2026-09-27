import { MY_LISTINGS_TABS, tabConfigs } from '@/features/my-listings/constants/tabs';
import type {
  ListingCounts,
  MyListingsTab,
  TabBadge,
} from '@/features/my-listings/types/my-listing';
import { getTabTotal } from '@/features/my-listings/utils/my-listing';

export const tabId = (tab: MyListingsTab) => `my-listings-tab-${tab}`;
export const tabPanelId = 'my-listings-panel';

// The five labels share the width by their length; below 360px the row scrolls.
const tabClass =
  'relative flex min-h-11 flex-auto items-center justify-center gap-1 whitespace-nowrap border-0 bg-transparent px-1 text-caption font-semibold';
const tabColorClass = {
  active:
    'text-marketplace-blue after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-marketplace-blue',
  idle: 'text-marketplace-muted',
};
const badgeClass =
  'grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-micro font-bold leading-none';
const badgeColorClass = {
  alert: 'bg-marketplace-danger text-white',
  normal: 'bg-marketplace-tint-strong text-marketplace-blue',
};

export default function MyListingsTabs({
  activeTab,
  counts,
  onChange,
}: {
  activeTab: MyListingsTab;
  counts: ListingCounts | undefined;
  onChange: (tab: MyListingsTab) => void;
}) {
  return (
    <div
      className="flex overflow-x-auto border-b border-solid border-marketplace-line bg-white px-2 [scrollbar-width:none]"
      role="tablist"
      aria-label="Trạng thái tin"
    >
      {MY_LISTINGS_TABS.map((tab) => {
        const isActive = tab === activeTab;
        const badge = getTabBadge(tab, counts);
        const { label } = tabConfigs[tab];

        return (
          <button
            key={tab}
            aria-controls={tabPanelId}
            aria-label={badge ? `${label}, ${badge.count} tin` : undefined}
            aria-selected={isActive}
            className={`${tabClass} ${tabColorClass[isActive ? 'active' : 'idle']}`}
            id={tabId(tab)}
            role="tab"
            type="button"
            onClick={() => onChange(tab)}
          >
            {label}
            {badge && (
              <span
                aria-hidden="true"
                className={`${badgeClass} ${badgeColorClass[badge.isAlert ? 'alert' : 'normal']}`}
              >
                {badge.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** "Đang xử lý" and "Bị lỗi" show their count; "Bị lỗi" in red, as the seller must act. */
export function getTabBadge(
  tab: MyListingsTab,
  counts: ListingCounts | undefined,
): TabBadge | null {
  const { badge } = tabConfigs[tab];
  const count = getTabTotal(tab, counts);
  if (!badge || count === 0) {
    return null;
  }
  return { count, isAlert: badge === 'alert' };
}

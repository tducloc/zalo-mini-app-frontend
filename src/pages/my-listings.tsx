import { useState } from 'react';
import { Page, useNavigate } from 'zmp-ui';

import ConfirmDialog from '@/components/feedback/confirm-dialog';
import AppSheet from '@/components/app-sheet';
import MobilePageHeader from '@/components/layout/mobile-page-header';
import { pageClass } from '@/components/layout/styles';
import { useSession } from '@/features/auth/hooks/use-session';
import { useMyListingCounts, useMyListings } from '@/features/my-listings/api/get-my-listings';
import OwnerActionList from '@/features/my-listings/components/actions/owner-action-list';
import MyListingList from '@/features/my-listings/components/list/my-listing-list';
import MyListingsTabs, {
  tabId,
  tabPanelId,
} from '@/features/my-listings/components/tabs/my-listings-tabs';
import { tabConfigs } from '@/features/my-listings/constants/tabs';
import { useFollowListing } from '@/features/my-listings/hooks/use-follow-listing';
import { useOwnerListingActions } from '@/features/my-listings/hooks/use-owner-listing-actions';
import type { ListingAction, MyListing } from '@/features/my-listings/types/my-listing';
import { getTabTotal } from '@/features/my-listings/utils/my-listing';
import { useMyListingsStore } from '@/stores/my-listings';

// Under the fixed header (44px and the safe area), the tabs stay in view while the list scrolls.
const tabsBarClass = 'sticky top-[calc(44px_+_var(--zaui-safe-area-inset-top))] z-10';
const headerSpacerClass = 'h-[calc(44px_+_var(--zaui-safe-area-inset-top))]';

export default function MyListingsPage() {
  const navigate = useNavigate();
  const { session, isBootstrapping } = useSession();

  // Posting or saving a listing opens its tab (`follow`).
  const activeTab = useMyListingsStore((state) => state.tab);
  const selectTab = useMyListingsStore((state) => state.selectTab);

  // the "•••" sheet
  const [sheetListing, setSheetListing] = useState<MyListing | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const viewerId = session?.user.id ?? null;
  const listingsQuery = useMyListings(activeTab, viewerId);
  useFollowListing(listingsQuery, viewerId);
  const counts = useMyListingCounts(viewerId);
  const ownerActions = useOwnerListingActions();

  const tab = tabConfigs[activeTab];
  const total = getTabTotal(activeTab, counts);
  const isPublishedTab = activeTab === 'published';

  const handleOpenListing = (listingId: string) =>
    navigate(`/products/${encodeURIComponent(listingId)}`);

  const handleOpenActions = (listing: MyListing) => {
    setSheetListing(listing);
    setIsSheetOpen(true);
  };

  const handleSelectAction = (action: ListingAction) => {
    setIsSheetOpen(false);
    if (sheetListing) {
      ownerActions.selectAction(sheetListing.id, action);
    }
  };

  return (
    <Page className={pageClass}>
      <MobilePageHeader title="Quản lý tin" />
      <div className={headerSpacerClass} />
      <div className={tabsBarClass}>
        <MyListingsTabs activeTab={activeTab} counts={counts} onChange={selectTab} />
      </div>

      <main
        aria-labelledby={tabId(activeTab)}
        className="px-4 pb-4 pt-3"
        id={tabPanelId}
        role="tabpanel"
      >
        {total > 0 && (
          <p className="mb-2.5 mt-0 text-caption text-marketplace-muted">{total} tin</p>
        )}
        <MyListingList
          // A fresh list per tab: its footer's observer and scroll state start over.
          key={activeTab}
          empty={{
            ...tab.empty,
            actionLabel: isPublishedTab ? 'Đăng tin ngay' : undefined,
            onAction: isPublishedTab ? () => navigate('/sell', { replace: true }) : undefined,
          }}
          isWaitingForSession={!session && isBootstrapping}
          query={listingsQuery}
          onAction={ownerActions.selectAction}
          onOpen={handleOpenListing}
          onOpenActions={handleOpenActions}
        />
      </main>

      <AppSheet
        visible={isSheetOpen}
        title="Tuỳ chọn"
        autoHeight
        onClose={() => setIsSheetOpen(false)}
      >
        <div className="px-4 pb-5">
          {sheetListing && (
            <OwnerActionList
              status={sheetListing.status}
              isDisabled={ownerActions.isPending}
              onSelect={handleSelectAction}
            />
          )}
        </div>
      </AppSheet>
      {/* After the sheet: it closes as the dialog opens, and the dialog keeps the scroll lock. */}
      <ConfirmDialog {...ownerActions.markSoldDialog} />
    </Page>
  );
}

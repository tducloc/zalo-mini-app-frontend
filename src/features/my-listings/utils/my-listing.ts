import type { InfiniteData } from '@tanstack/react-query';

import { mediaErrorMessage } from '@/features/listings/constants/messages';
import { MediaError } from '@/features/media/types/upload';
import {
  statusChangeErrors,
  STATUS_CHANGE_FAILED,
} from '@/features/my-listings/constants/messages';
import { DEFAULT_TAB, MY_LISTINGS_TABS, tabConfigs } from '@/features/my-listings/constants/tabs';
import {
  ListingAction,
  StatusTone,
  type FailedMedia,
  type ListingCounts,
  type MyListing,
  type MyListingsPage,
  type MyListingsTab,
  type StatusLine,
  type TabBadge,
} from '@/features/my-listings/types/my-listing';
import type { ProductStatus } from '@/features/products/types/product';
import { getApiErrorStatus } from '@/utils/api-error';
import { formatShortRelativeTime } from '@/utils/format';

const isMyListingsTab = (value: unknown): value is MyListingsTab =>
  MY_LISTINGS_TABS.some((tab) => tab === value);

/** The tab another page asked for in the router state (`{ tab }`), else the first one. */
export function readRequestedTab(routerState: unknown): MyListingsTab {
  const tab =
    typeof routerState === 'object' && routerState !== null && 'tab' in routerState
      ? routerState.tab
      : undefined;
  return isMyListingsTab(tab) ? tab : DEFAULT_TAB;
}

export function getTabForStatus(status: ProductStatus): MyListingsTab {
  return MY_LISTINGS_TABS.find((tab) => tabConfigs[tab].statuses.includes(status)) ?? DEFAULT_TAB;
}

/** `GET /me/products?status=` for a tab: "PROCESSING,FAILED". */
export const toStatusFilter = (tab: MyListingsTab) => tabConfigs[tab].statuses.join(',');

/** How many listings a tab holds, once the counts are known. */
export function getTabTotal(tab: MyListingsTab, counts: ListingCounts | undefined) {
  return counts ? tabConfigs[tab].statuses.reduce((sum, status) => sum + counts[status], 0) : 0;
}

/**
 * Only "Đang xử lý" carries a badge: the listings waiting for their media, alerting when one
 * failed and needs the seller.
 */
export function getTabBadge(
  tab: MyListingsTab,
  counts: ListingCounts | undefined,
): TabBadge | null {
  const count = tab === 'processing' ? getTabTotal(tab, counts) : 0;
  if (!counts || count === 0) {
    return null;
  }
  return { count, isAlert: counts.FAILED > 0 };
}

const isMediaError = (code: string): code is MediaError =>
  Object.values<string>(MediaError).includes(code);

function describeFailure(failedMedia: FailedMedia[]): StatusLine {
  const [first] = failedMedia;
  const code = first?.error && isMediaError(first.error) ? first.error : null;
  const hint = mediaErrorMessage(code);

  if (failedMedia.length > 1) {
    return { label: `${failedMedia.length} tệp bị lỗi`, tone: StatusTone.Danger, hint };
  }

  if (first) {
    const label = first.type === 'VIDEO' ? 'Video bị lỗi' : 'Ảnh bị lỗi';
    return { label, tone: StatusTone.Danger, hint };
  }

  return { label: 'Xử lý ảnh, video không thành công', tone: StatusTone.Danger, hint };
}

/** Where a listing stands, in the words of its card. */
export function getStatusLine(listing: MyListing, now = Date.now()): StatusLine {
  const since = (isoDate: string | null) =>
    formatShortRelativeTime(isoDate ?? listing.updatedAt, now);

  const lines: Record<ProductStatus, () => StatusLine> = {
    PROCESSING: () => ({ label: 'Đang xử lý ảnh, video', tone: StatusTone.Progress }),
    FAILED: () => describeFailure(listing.failedMedia),
    PUBLISHED: () => ({ label: `Đã đăng · ${since(listing.publishedAt)}`, tone: StatusTone.Muted }),
    SOLD: () => ({ label: `Đã bán · ${since(listing.soldAt)}`, tone: StatusTone.Muted }),
    ARCHIVED: () => ({ label: `Đã ẩn · ${since(listing.archivedAt)}`, tone: StatusTone.Muted }),
  };
  return lines[listing.status]();
}

const actionsByStatus: Record<ProductStatus, ListingAction[]> = {
  PUBLISHED: [ListingAction.Edit, ListingAction.MarkSold, ListingAction.Archive],
  PROCESSING: [ListingAction.Edit],
  FAILED: [ListingAction.Edit],
  ARCHIVED: [ListingAction.Unarchive],
  // Sold is final.
  SOLD: [],
};

/** The "•••" sheet's actions (api-spec, "State transitions"; PATCH takes PROCESSING, FAILED, PUBLISHED). */
export const getListingActions = (status: ProductStatus) => actionsByStatus[status];

export function getStatusChangeErrorMessage(error: unknown) {
  const status = getApiErrorStatus(error);
  return (status && statusChangeErrors[status]) || STATUS_CHANGE_FAILED;
}

/** The pages without one listing, for a tab it has just left. */
export function withoutListing(
  data: InfiniteData<MyListingsPage, string | undefined>,
  listingId: string,
): InfiniteData<MyListingsPage, string | undefined> {
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      data: page.data.filter((listing) => listing.id !== listingId),
    })),
  };
}

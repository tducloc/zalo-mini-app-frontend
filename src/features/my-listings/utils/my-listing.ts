import type { InfiniteData } from '@tanstack/react-query';

import { mediaErrorMessage } from '@/features/listings/constants/messages';
import { MediaError } from '@/features/media/types/upload';
import { toMediaError } from '@/features/media/utils/media-error';
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

export function getTabForStatus(status: ProductStatus): MyListingsTab {
  return MY_LISTINGS_TABS.find((tab) => tabConfigs[tab].status === status) ?? DEFAULT_TAB;
}

/** How many listings a tab holds, once the counts are known. */
export function getTabTotal(tab: MyListingsTab, counts: ListingCounts | undefined) {
  return counts?.[tabConfigs[tab].status] ?? 0;
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

function describeFailure(failedMedia: FailedMedia[]): StatusLine {
  const [first] = failedMedia;
  const hint = mediaErrorMessage(toMediaError(first?.error));

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

/** Whether the listing is on the pages loaded so far. */
export function includesListing(
  data: InfiniteData<MyListingsPage, unknown> | undefined,
  listingId: string,
) {
  return data?.pages.some((page) => page.data.some((listing) => listing.id === listingId)) ?? false;
}

/** The pages without one id. The next cursor stays, so the following page is unchanged. */
export function withoutListing<Page extends { data: { id: string }[] }, Param>(
  data: InfiniteData<Page, Param>,
  listingId: string,
): InfiniteData<Page, Param> {
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      data: page.data.filter((item) => item.id !== listingId),
    })),
  };
}

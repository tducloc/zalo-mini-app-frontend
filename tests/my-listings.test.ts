import { AxiosError, AxiosHeaders } from 'axios';

import { mediaErrorMessage } from '@/features/listings/constants/messages';
import { MediaError } from '@/features/media/types/upload';
import {
  ListingAction,
  StatusTone,
  type ListingCounts,
  type MyListing,
  type MyListingsPage,
} from '@/features/my-listings/types/my-listing';
import {
  getListingActions,
  getStatusChangeErrorMessage,
  getStatusLine,
  getTabBadge,
  getTabForStatus,
  getTabTotal,
  includesListing,
  withoutListing,
} from '@/features/my-listings/utils/my-listing';
import { useMyListingsStore } from '@/stores/my-listings';

const now = Date.parse('2026-09-27T10:00:00.000Z');
const hoursAgo = (hours: number) => new Date(now - hours * 3_600_000).toISOString();

function listing(overrides: Partial<MyListing> = {}): MyListing {
  return {
    id: 'prd_1',
    title: 'iPhone 13',
    price: 6_990_000,
    status: 'PUBLISHED',
    thumbnailUrl: null,
    hasVideo: false,
    failedMedia: [],
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(1),
    publishedAt: hoursAgo(3),
    soldAt: null,
    archivedAt: null,
    ...overrides,
  };
}

const counts = (overrides: Partial<ListingCounts> = {}): ListingCounts => ({
  PROCESSING: 0,
  FAILED: 0,
  PUBLISHED: 0,
  SOLD: 0,
  ARCHIVED: 0,
  ...overrides,
});

function httpError(status: number) {
  const headers = new AxiosHeaders();
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', { headers }, null, {
    status,
    statusText: '',
    headers,
    config: { headers },
    data: { error: { code: 'CONFLICT', message: 'Listing is not published.' } },
  });
}

describe('tabs', () => {
  it('opens "Đang hiển thị" first, then the tab of a listing just posted or saved', () => {
    const store = useMyListingsStore;
    expect(store.getState()).toMatchObject({ tab: 'published', followedId: null });

    store.getState().follow('prd_1', 'PROCESSING');
    expect(store.getState()).toMatchObject({ tab: 'processing', followedId: 'prd_1' });

    // Only a PROCESSING listing moves on by itself: any other is not followed.
    store.getState().follow('prd_2', 'PUBLISHED');
    expect(store.getState()).toMatchObject({ tab: 'published', followedId: null });

    store.getState().follow('prd_1', 'PROCESSING');
    // The seller picks a tab, or the page moves to where the listing went: no longer followed.
    store.getState().selectTab('published');
    expect(store.getState()).toMatchObject({ tab: 'published', followedId: null });
  });

  it('gives processing and failed listings a tab each', () => {
    expect(getTabForStatus('PROCESSING')).toBe('processing');
    expect(getTabForStatus('FAILED')).toBe('failed');
    expect(getTabForStatus('PUBLISHED')).toBe('published');
    expect(getTabForStatus('SOLD')).toBe('sold');
    expect(getTabForStatus('ARCHIVED')).toBe('archived');
  });

  it('reads the count of a tab', () => {
    const all = counts({ PROCESSING: 2, FAILED: 1, PUBLISHED: 4 });
    expect(getTabTotal('processing', all)).toBe(2);
    expect(getTabTotal('failed', all)).toBe(1);
    expect(getTabTotal('published', all)).toBe(4);
    expect(getTabTotal('sold', all)).toBe(0);
    expect(getTabTotal('published', undefined)).toBe(0);
  });

  it('badges "Đang xử lý", and "Bị lỗi" as an alert', () => {
    const all = counts({ PROCESSING: 2, FAILED: 1 });
    expect(getTabBadge('processing', all)).toEqual({ count: 2, isAlert: false });
    expect(getTabBadge('failed', all)).toEqual({ count: 1, isAlert: true });
    expect(getTabBadge('processing', counts())).toBeNull();
    expect(getTabBadge('processing', undefined)).toBeNull();
    expect(getTabBadge('published', counts({ PUBLISHED: 4 }))).toBeNull();
  });
});

describe('getStatusLine', () => {
  it('says a processing listing waits for its media', () => {
    expect(getStatusLine(listing({ status: 'PROCESSING', publishedAt: null }), now)).toEqual({
      label: 'Đang xử lý ảnh, video',
      tone: StatusTone.Progress,
    });
  });

  it('says which file failed and what to do, in the create form’s words', () => {
    const failedVideo = listing({
      status: 'FAILED',
      failedMedia: [{ id: 'm1', type: 'VIDEO', error: 'VIDEO_NOT_PLAYABLE' }],
    });
    expect(getStatusLine(failedVideo, now)).toEqual({
      label: 'Video bị lỗi',
      tone: StatusTone.Danger,
      hint: mediaErrorMessage(MediaError.VideoNotPlayable),
    });

    const failedPhoto = listing({
      status: 'FAILED',
      failedMedia: [{ id: 'm1', type: 'IMAGE', error: 'BLANK_IMAGE' }],
    });
    expect(getStatusLine(failedPhoto, now).label).toBe('Ảnh bị lỗi');
  });

  it('counts several failed files, and reads an unknown code as a processing failure', () => {
    const line = getStatusLine(
      listing({
        status: 'FAILED',
        failedMedia: [
          { id: 'm1', type: 'IMAGE', error: 'SOMETHING_NEW' },
          { id: 'm2', type: 'VIDEO', error: null },
        ],
      }),
      now,
    );
    expect(line.label).toBe('2 tệp bị lỗi');
    expect(line.hint).toBe(mediaErrorMessage(MediaError.ProcessingFailed));
  });

  it('still explains a failed listing that lists no failed file', () => {
    const line = getStatusLine(listing({ status: 'FAILED' }), now);
    expect(line.tone).toBe(StatusTone.Danger);
    expect(line.hint).toBe(mediaErrorMessage(null));
  });

  it('dates published, sold and hidden listings by their own timestamp', () => {
    expect(getStatusLine(listing(), now)).toEqual({
      label: 'Đã đăng · 3 giờ',
      tone: StatusTone.Muted,
    });
    expect(getStatusLine(listing({ status: 'SOLD', soldAt: hoursAgo(2) }), now).label).toBe(
      'Đã bán · 2 giờ',
    );
    expect(getStatusLine(listing({ status: 'ARCHIVED', archivedAt: hoursAgo(5) }), now).label).toBe(
      'Đã ẩn · 5 giờ',
    );
  });

  it('falls back to the last change when the timestamp is missing', () => {
    expect(getStatusLine(listing({ status: 'SOLD', soldAt: null }), now).label).toBe(
      'Đã bán · 1 giờ',
    );
  });
});

describe('getListingActions', () => {
  it('follows the state transitions', () => {
    expect(getListingActions('PUBLISHED')).toEqual([
      ListingAction.Edit,
      ListingAction.MarkSold,
      ListingAction.Archive,
    ]);
    expect(getListingActions('PROCESSING')).toEqual([ListingAction.Edit]);
    expect(getListingActions('FAILED')).toEqual([ListingAction.Edit]);
    expect(getListingActions('ARCHIVED')).toEqual([ListingAction.Unarchive]);
    expect(getListingActions('SOLD')).toEqual([]);
  });
});

describe('getStatusChangeErrorMessage', () => {
  it('explains a refused change by its status', () => {
    expect(getStatusChangeErrorMessage(httpError(409))).toMatch(/^Tin đã đổi trạng thái/);
    expect(getStatusChangeErrorMessage(httpError(404))).toBe('Tin không còn tồn tại.');
    expect(getStatusChangeErrorMessage(httpError(403))).toMatch(/của người khác/);
  });

  it('asks to retry anything else', () => {
    expect(getStatusChangeErrorMessage(httpError(500))).toMatch(/Vui lòng kiểm tra mạng/);
    expect(getStatusChangeErrorMessage(new Error('offline'))).toMatch(/Vui lòng kiểm tra mạng/);
  });
});

const listingsPage = (ids: string[]): MyListingsPage => ({
  data: ids.map((id) => listing({ id })),
  meta: { nextCursor: null, hasNextPage: false, counts: counts() },
});

describe('includesListing', () => {
  it('looks through every page loaded so far', () => {
    const data = {
      pages: [listingsPage(['a']), listingsPage(['b'])],
      pageParams: [undefined, 'cur'],
    };

    expect(includesListing(data, 'b')).toBe(true);
    expect(includesListing(data, 'c')).toBe(false);
    expect(includesListing(undefined, 'a')).toBe(false);
  });
});

describe('withoutListing', () => {
  it('takes one listing out of every page, keeping the rest and the page params', () => {
    const data = {
      pages: [listingsPage(['a', 'b']), listingsPage(['c'])],
      pageParams: [undefined, 'cur'],
    };

    const result = withoutListing(data, 'b');

    expect(result.pages.map((p) => p.data.map((item) => item.id))).toEqual([['a'], ['c']]);
    expect(result.pageParams).toEqual([undefined, 'cur']);
    expect(data.pages[0].data).toHaveLength(2);
  });
});

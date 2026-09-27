// @vitest-environment jsdom
// jsdom: the helpers live in their component files, which load zmp-ui.
import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it, vi } from 'vitest';

import { readSaveError } from '@/features/listings/api/update-listing';
import type { ListingFieldValues } from '@/features/listings/schemas';
import { DraftMediaStatus, type ListingMedia } from '@/features/listings/types/draft-media';
import { TileTone } from '@/features/listings/types/tile-view';
import { SaveErrorKind } from '@/features/listings/types/update-listing';
import { isFailed, newDraftMedia } from '@/features/listings/utils/draft-media';
import {
  changedFields,
  draftFromProduct,
  editBaseline,
  isMediaChanged,
  listingChanges,
} from '@/features/listings/components/edit/edit-listing-form';
import { postBlocker } from '@/features/listings/utils/listing-draft';
import { tileView } from '@/features/listings/components/media/media-section';
import { MediaKind } from '@/features/media/types/media';
import { MediaError, ServerMediaStatus } from '@/features/media/types/upload';
import type { ProductDetail } from '@/features/products/types/product';
import { isEditableStatus } from '@/pages/edit-listing';

// Only the error reading is tested; the request goes through the app's HTTP client.
vi.mock('@/lib/http', () => ({ http: {} }));

type ProductMedia = ProductDetail['media'][number];

const item = (id: string, change: Partial<ProductMedia> = {}): ProductMedia => ({
  id,
  role: 'GALLERY',
  type: 'IMAGE',
  status: 'READY',
  error: null,
  thumbnailUrl: `https://t/${id}.jpg`,
  mediumUrl: `https://m/${id}.jpg`,
  placeholder: null,
  durationMs: null,
  sortOrder: 0,
  ...change,
});

const product = (change: Partial<ProductDetail> = {}): ProductDetail => ({
  id: 'prd_1',
  title: 'iPhone 13 128GB',
  description: 'Máy dùng tốt, pin 90%.',
  price: 6_990_000,
  condition: 'LIKE_NEW',
  status: 'PUBLISHED',
  location: { id: 'loc_hanoi', name: 'Hà Nội' },
  category: { id: 'cat_phone', name: 'Điện thoại', slug: 'dien-thoai' },
  // Out of order on purpose, the video between the photos.
  media: [
    item('m_b', { sortOrder: 2 }),
    item('m_v', { type: 'VIDEO', sortOrder: 1, mediumUrl: 'https://m/v.mp4' }),
    item('m_a', { role: 'MAIN', sortOrder: 0 }),
  ],
  seller: { id: 'u_1', name: 'Lộc', avatarUrl: null, contact: null },
  viewer: { isOwner: true, hasReported: false },
  createdAt: '2026-09-27T01:00:00.000Z',
  publishedAt: '2026-09-27T01:00:00.000Z',
  ...change,
});

const savedValues: ListingFieldValues = {
  title: 'iPhone 13 128GB',
  description: 'Máy dùng tốt, pin 90%.',
  price: 6_990_000,
  categoryId: 'cat_phone',
  condition: 'LIKE_NEW',
  locationId: 'loc_hanoi',
};

const picked = (id: string, kind = MediaKind.Image): ListingMedia => ({
  ...newDraftMedia(id, kind, new File(['x'], 'x.jpg')),
  status: DraftMediaStatus.Uploaded,
  mediaId: `new-${id}`,
});

function apiError(status: number, details?: unknown) {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('request failed', 'ERR_BAD_REQUEST', config, undefined, {
    status,
    statusText: '',
    headers: {},
    config,
    data: { error: { code: 'ANY', message: 'Any.', details } },
  });
}

describe('isEditableStatus', () => {
  it('allows processing, failed and published listings only', () => {
    const editable: ProductDetail['status'][] = ['PROCESSING', 'FAILED', 'PUBLISHED'];
    expect(editable.every(isEditableStatus)).toBe(true);
    expect(isEditableStatus('SOLD')).toBe(false);
    expect(isEditableStatus('ARCHIVED')).toBe(false);
  });
});

describe('draftFromProduct', () => {
  it('fills the fields as a seller types them, the price grouped', () => {
    expect(draftFromProduct(product()).fields).toEqual({
      title: 'iPhone 13 128GB',
      description: 'Máy dùng tốt, pin 90%.',
      price: '6.990.000',
      categoryId: 'cat_phone',
      condition: 'LIKE_NEW',
      locationId: 'loc_hanoi',
    });
  });

  it('leaves a legacy free-text location to be picked again', () => {
    const legacy = product({ location: { id: null, name: 'Q1, TP.HCM' } });
    expect(draftFromProduct(legacy).fields.locationId).toBe('');
  });

  it('seeds the media as uploaded tiles without a file, photos in order, then the video', () => {
    const { media } = draftFromProduct(product());

    expect(media.map((tile) => tile.id)).toEqual(['m_a', 'm_b', 'm_v']);
    expect(media[0]).toMatchObject({
      kind: MediaKind.Image,
      file: null,
      status: DraftMediaStatus.Uploaded,
      mediaId: 'm_a',
      mediumUrl: 'https://m/m_a.jpg',
      server: { status: ServerMediaStatus.Ready, thumbnailUrl: 'https://t/m_a.jpg', error: null },
    });
    expect(media[2]).toMatchObject({ kind: MediaKind.Video, mediumUrl: 'https://m/v.mp4' });
    // Nothing to wait for: Save can go at once.
    expect(postBlocker(media)).toBeNull();
  });

  it('keeps a failed item failed with its reason, and one the app does not know as failed', () => {
    const failed = product({
      status: 'FAILED',
      media: [
        item('m_a', { status: 'FAILED', error: 'BLANK_IMAGE', thumbnailUrl: null }),
        item('m_b', { status: 'FAILED', error: 'SOMETHING_NEW', sortOrder: 1 }),
        item('m_c', { status: 'PROCESSING', sortOrder: 2 }),
      ],
    });
    const [blank, unknown, processing] = draftFromProduct(failed).media;

    expect(blank.server).toMatchObject({
      status: ServerMediaStatus.Failed,
      error: MediaError.BlankImage,
    });
    expect(unknown.server?.error).toBe(MediaError.ProcessingFailed);
    expect(isFailed(blank)).toBe(true);
    expect(processing.server).toMatchObject({ status: ServerMediaStatus.Processing, error: null });
  });

  it('reads media from a server that sends no status as ready', () => {
    const old = product({ media: [item('m_a', { status: undefined, error: undefined })] });
    expect(draftFromProduct(old).media[0].server?.status).toBe(ServerMediaStatus.Ready);
  });
});

describe('tileView of a listing media', () => {
  it("shows the server's thumbnail on the tile and its medium file in the viewer", () => {
    const [photo, , video] = draftFromProduct(product()).media;

    expect(tileView(photo)).toMatchObject({
      tone: TileTone.Done,
      imageUrl: 'https://t/m_a.jpg',
      fullUrl: 'https://m/m_a.jpg',
    });
    expect(tileView(video)).toMatchObject({
      imageUrl: 'https://t/m_v.jpg',
      fullUrl: 'https://m/v.mp4',
    });
  });

  it('marks a failed one with the reason to replace it', () => {
    const failed = product({
      media: [item('m_a', { status: 'FAILED', error: 'BLANK_IMAGE', thumbnailUrl: null })],
    });
    expect(tileView(draftFromProduct(failed).media[0])).toMatchObject({
      tone: TileTone.Error,
      detail: 'Vui lòng chọn ảnh khác: ảnh bị trống.',
      canRetry: false,
    });
  });
});

describe('changedFields', () => {
  const baseline = editBaseline(product());

  it('is empty when the checked values are the saved ones', () => {
    expect(changedFields(baseline, savedValues)).toEqual({});
  });

  it('keeps only what changed', () => {
    expect(
      changedFields(baseline, { ...savedValues, title: 'iPhone 13', price: 6_500_000 }),
    ).toEqual({ title: 'iPhone 13', price: 6_500_000 });
  });

  it('sends the location picked for a legacy listing', () => {
    const legacy = editBaseline(product({ location: { id: null, name: 'Q1' } }));
    expect(changedFields(legacy, savedValues)).toEqual({ locationId: 'loc_hanoi' });
  });
});

describe('isMediaChanged', () => {
  const baseline = editBaseline(product());
  const tiles = () => draftFromProduct(product()).media;

  it('orders the saved media as Save sends it', () => {
    expect(baseline.mediaIds).toEqual(['m_a', 'm_b', 'm_v']);
  });

  it('is false for the tiles as they came', () => {
    expect(isMediaChanged(baseline, tiles())).toBe(false);
  });

  it('is true once a tile is moved, removed or added, even still uploading', () => {
    const [a, b, v] = tiles();
    expect(isMediaChanged(baseline, [b, a, v])).toBe(true);
    expect(isMediaChanged(baseline, [a, v])).toBe(true);
    const uploading = { ...picked('p'), status: DraftMediaStatus.Uploading, mediaId: null };
    expect(isMediaChanged(baseline, [a, b, v, uploading])).toBe(true);
  });

  it('ignores where the video sits among the tiles', () => {
    const [a, b, v] = tiles();
    expect(isMediaChanged(baseline, [a, v, b])).toBe(false);
  });
});

describe('listingChanges', () => {
  const baseline = editBaseline(product());

  it('leaves mediaIds out when the media did not change', () => {
    const tiles = draftFromProduct(product()).media;
    expect(listingChanges(baseline, { ...savedValues, price: 1 }, tiles)).toEqual({ price: 1 });
  });

  it('sends the whole media set, cover first and the video last, when it changed', () => {
    const [, b, v] = draftFromProduct(product()).media;
    const replacement = picked('c');
    expect(listingChanges(baseline, savedValues, [replacement, b, v])).toEqual({
      mediaIds: ['new-c', 'm_b', 'm_v'],
    });
  });
});

describe('readSaveError', () => {
  it('points at the form fields the server refused', () => {
    const error = apiError(400, [{ field: 'price' }, { field: 'title' }]);
    expect(readSaveError(error)).toEqual({
      kind: SaveErrorKind.Fields,
      fields: ['price', 'title'],
    });
  });

  it('tells an error about the media set apart from the fields', () => {
    expect(readSaveError(apiError(400, [{ field: 'mediaIds' }])).kind).toBe(SaveErrorKind.Invalid);
  });

  it('names the files the server cannot use (409)', () => {
    const error = apiError(409, [
      { mediaId: 'm1', reason: 'FAILED' },
      { mediaId: 'm2', reason: 'UPLOADING' },
    ]);
    expect(readSaveError(error)).toEqual({
      kind: SaveErrorKind.MediaConflict,
      mediaIds: ['m1', 'm2'],
    });
  });

  it('reads a 409 without files, a 403 and a 404 as a listing that cannot be edited', () => {
    for (const status of [409, 403, 404]) {
      expect(readSaveError(apiError(status)).kind).toBe(SaveErrorKind.NotEditable);
    }
  });

  it('reads the network and the server as a failure to try again', () => {
    expect(readSaveError(apiError(500)).kind).toBe(SaveErrorKind.Other);
    expect(readSaveError(new Error('offline')).kind).toBe(SaveErrorKind.Other);
  });
});

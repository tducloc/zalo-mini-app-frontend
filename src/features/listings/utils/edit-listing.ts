/**
 * Editing a listing (api-spec, `PATCH /products/:id`): who may, what the edit starts
 * from, and what Save sends — only the fields that changed, and the media set only when it
 * changed. Pure, so each rule is unit-tested.
 */

import { DraftMediaStatus, type ListingMedia } from '@/features/listings/types/draft-media';
import { type ListingFieldValues, listingFieldsSchema } from '@/features/listings/schemas';
import type { UpdateListingInput } from '@/features/listings/types/update-listing';
import { mediaIdsForPost } from '@/features/listings/utils/listing-draft';
import { MediaKind } from '@/features/media/types/media';
import { MediaError, type ServerMedia, ServerMediaStatus } from '@/features/media/types/upload';
import { toMediaError } from '@/features/media/utils/media-error';
import type { ProductDetail, ProductStatus } from '@/features/products/types/product';
import type { ListingDraftStart } from '@/stores/listing-draft';

type ProductMedia = ProductDetail['media'][number];

/** Sold and archived listings cannot be edited (409 from the server). */
const EDITABLE_STATUSES: ProductStatus[] = ['PROCESSING', 'FAILED', 'PUBLISHED'];

/** The listing as saved, to tell what the seller changed. */
export interface EditBaseline {
  /** `locationId` is null for a legacy free-text location: the seller must pick one. */
  fields: Omit<ListingFieldValues, 'locationId'> & { locationId: string | null };
  /** In the order Save sends them: the photos (the cover first), then the video. */
  mediaIds: string[];
}

export const isEditableStatus = (status: ProductStatus) => EDITABLE_STATUSES.includes(status);

const FIELD_NAMES = listingFieldsSchema.keyof().options;

const serverStatuses: Record<NonNullable<ProductMedia['status']>, ServerMediaStatus> = {
  UPLOADING: ServerMediaStatus.Uploading,
  PROCESSING: ServerMediaStatus.Processing,
  READY: ServerMediaStatus.Ready,
  FAILED: ServerMediaStatus.Failed,
};

/** A FAILED item keeps a reason the app knows, so its tile says what to do. */
function serverMediaOf(item: ProductMedia): ServerMedia {
  // Older servers sent no status: only READY media then.
  const status = item.status ? serverStatuses[item.status] : ServerMediaStatus.Ready;
  const isFailedItem = status === ServerMediaStatus.Failed;
  return {
    status,
    thumbnailUrl: item.thumbnailUrl,
    error: isFailedItem ? (toMediaError(item.error) ?? MediaError.ProcessingFailed) : null,
  };
}

/** One of the listing's media as a tile that is already uploaded, with no local file. */
function tileOf(item: ProductMedia): ListingMedia {
  return {
    id: item.id,
    kind: item.type === 'VIDEO' ? MediaKind.Video : MediaKind.Image,
    file: null,
    status: DraftMediaStatus.Uploaded,
    reason: null,
    original: null,
    upload: null,
    previewUrl: null,
    progress: null,
    waitingFor: null,
    isRetryable: false,
    mediaId: item.id,
    server: serverMediaOf(item),
    mediumUrl: item.mediumUrl,
  };
}

/**
 * What the edit form starts with: the fields as the form holds them (the price as its
 * digits, "6990000"), and the listing's media as tiles, the photos first in display order.
 */
export function draftFromProduct(product: ProductDetail): ListingDraftStart<ListingMedia> {
  const ordered = [...product.media].sort((a, b) => a.sortOrder - b.sortOrder);
  const photos = ordered.filter((item) => item.type === 'IMAGE');
  const videos = ordered.filter((item) => item.type === 'VIDEO');

  return {
    fields: {
      title: product.title,
      description: product.description,
      price: String(product.price),
      categoryId: product.category.id,
      condition: product.condition,
      locationId: product.location.id ?? '',
    },
    media: [...photos, ...videos].map(tileOf),
  };
}

export function editBaseline(product: ProductDetail): EditBaseline {
  return {
    fields: {
      title: product.title,
      description: product.description,
      price: product.price,
      categoryId: product.category.id,
      condition: product.condition,
      locationId: product.location.id,
    },
    mediaIds: mediaIdsForPost(draftFromProduct(product).media),
  };
}

/** The fields whose checked value differs from the saved one. */
export function changedFields(
  baseline: EditBaseline,
  values: ListingFieldValues,
): Partial<ListingFieldValues> {
  const changed = FIELD_NAMES.filter((key) => values[key] !== baseline.fields[key]);
  return Object.fromEntries(changed.map((key) => [key, values[key]]));
}

/**
 * Whether the tiles differ from the listing's media: one added, removed or moved. By
 * tile id, so a file still uploading counts too; a listing's media keeps its id as tile id.
 */
export function isMediaChanged(baseline: EditBaseline, media: ListingMedia[]) {
  const photos = media.filter((item) => item.kind === MediaKind.Image);
  const videos = media.filter((item) => item.kind === MediaKind.Video);
  const ids = [...photos, ...videos].map((item) => item.id);
  return (
    ids.length !== baseline.mediaIds.length || ids.some((id, i) => id !== baseline.mediaIds[i])
  );
}

/** The `PATCH` body: the changed fields, and `mediaIds` only when the media changed. */
export function listingChanges(
  baseline: EditBaseline,
  values: ListingFieldValues,
  media: ListingMedia[],
): UpdateListingInput {
  const fields = changedFields(baseline, values);
  return isMediaChanged(baseline, media) ? { ...fields, mediaIds: mediaIdsForPost(media) } : fields;
}

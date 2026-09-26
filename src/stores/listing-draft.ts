import { arrayMove } from '@dnd-kit/sortable';
import { create } from 'zustand';

import { EMPTY_FIELDS } from '@/features/listings/constants/listing-fields';
import type { DraftMedia } from '@/features/listings/types/draft-media';
import type { DraftFields } from '@/features/listings/types/listing-draft';
import { newIdempotencyKey } from '@/features/listings/utils/listing-draft';

// The sell page unmounts when the seller opens another page; the draft, and the services
// working on its files, live outside it (plans/create-listing.md, "Draft that survives
// navigation"). Lost on a WebView reload, by decision.
interface ListingDraftState {
  fields: DraftFields;
  media: DraftMedia[];
  /** One per draft, sent again on every retry of its post (api-spec, `POST /products`). */
  idempotencyKey: string;
  /** `POST /products` is on its way; the draft stays as sent until it answers. */
  isPosting: boolean;
  setFields: (fields: Partial<DraftFields>) => void;
  setPosting: (isPosting: boolean) => void;
  addMedia: (items: DraftMedia[]) => void;
  /** Changes a file; nothing happens when it was removed meanwhile. */
  updateMedia: (id: string, change: Partial<DraftMedia>) => void;
  removeMedia: (id: string) => void;
  /** Puts file `id` where file `overId` is; the first photo is the cover. */
  moveMedia: (id: string, overId: string) => void;
  /** An empty draft with a new key: after Huỷ tin, or once the listing is posted. */
  reset: () => void;
}

export const useListingDraftStore = create<ListingDraftState>((set) => ({
  fields: EMPTY_FIELDS,
  media: [],
  idempotencyKey: newIdempotencyKey(),
  isPosting: false,

  setFields: (fields) => set((state) => ({ fields: { ...state.fields, ...fields } })),
  setPosting: (isPosting) => set({ isPosting }),

  addMedia: (items) => set((state) => ({ media: [...state.media, ...items] })),
  updateMedia: (id, change) =>
    set((state) => ({
      media: state.media.map((media) => (media.id === id ? { ...media, ...change } : media)),
    })),
  removeMedia: (id) => set((state) => ({ media: state.media.filter((media) => media.id !== id) })),
  moveMedia: (id, overId) =>
    set((state) => {
      const from = state.media.findIndex((media) => media.id === id);
      const to = state.media.findIndex((media) => media.id === overId);
      if (from < 0 || to < 0) {
        return state;
      }

      return { media: arrayMove(state.media, from, to) };
    }),

  reset: () =>
    set({ fields: EMPTY_FIELDS, media: [], idempotencyKey: newIdempotencyKey(), isPosting: false }),
}));

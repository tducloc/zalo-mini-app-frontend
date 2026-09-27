import { arrayMove } from '@dnd-kit/sortable';
import { create } from 'zustand';

import { EMPTY_FIELDS } from '@/features/listings/constants/listing-fields';
import type { DraftMedia, ListingMedia } from '@/features/listings/types/draft-media';
import type { DraftFields } from '@/features/listings/types/listing-draft';
import { hasDraft, newIdempotencyKey } from '@/features/listings/utils/listing-draft';

// The sell page unmounts when the seller opens another page; the draft, and the services
// working on its files, live outside it (plans/create-listing.md, "Draft that survives
// navigation"). Lost on a WebView reload, by decision. Editing a listing uses a store of
// its own, made by its page, so it never touches this draft.
interface ListingDraftState<M extends ListingMedia> {
  fields: DraftFields;
  media: M[];
  /** One per draft, sent again on every retry of its post (api-spec, `POST /products`). */
  idempotencyKey: string;
  /** `POST /products` (or an edit's `PATCH`) is on its way; the draft stays as sent. */
  isPosting: boolean;
  setFields: (fields: Partial<DraftFields>) => void;
  setPosting: (isPosting: boolean) => void;
  addMedia: (items: M[]) => void;
  /** Changes a file; nothing happens when it was removed meanwhile. */
  updateMedia: (id: string, change: Partial<M>) => void;
  removeMedia: (id: string) => void;
  /** Puts file `id` where file `overId` is; the first photo is the cover. */
  moveMedia: (id: string, overId: string) => void;
  /** An empty draft with a new key: after Huỷ tin, or once the listing is posted. */
  reset: () => void;
}

/** What a store starts with: an empty draft, or the listing being edited. */
export interface ListingDraftStart<M extends ListingMedia> {
  fields: DraftFields;
  media: M[];
}

/**
 * A listing's fields and files while the seller works on them. The sell page's draft holds
 * picked files only (DraftMedia); an edit's also holds the listing's media (ListingMedia).
 */
export const createListingDraftStore = <M extends ListingMedia>(start: ListingDraftStart<M>) =>
  create<ListingDraftState<M>>((set) => ({
    fields: start.fields,
    media: start.media,
    idempotencyKey: newIdempotencyKey(),
    isPosting: false,

    setFields: (fields) => set((state) => ({ fields: { ...state.fields, ...fields } })),
    setPosting: (isPosting) => set({ isPosting }),

    addMedia: (items) => set((state) => ({ media: [...state.media, ...items] })),
    updateMedia: (id, change) =>
      set((state) => ({
        media: state.media.map((media) => (media.id === id ? { ...media, ...change } : media)),
      })),
    removeMedia: (id) =>
      set((state) => ({ media: state.media.filter((media) => media.id !== id) })),
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
      set({
        fields: EMPTY_FIELDS,
        media: [],
        idempotencyKey: newIdempotencyKey(),
        isPosting: false,
      }),
  }));

/** Any draft store, as the services and the form take it. */
export type ListingDraftStore = ReturnType<typeof createListingDraftStore<ListingMedia>>;

/** The sell page's draft: one per app, kept while the seller is on other pages. */
export const useListingDraftStore = createListingDraftStore<DraftMedia>({
  fields: EMPTY_FIELDS,
  media: [],
});

/** Whether a draft waits; a boolean, so typing in the form does not re-render the caller. */
export function useHasDraft() {
  return useListingDraftStore((state) => hasDraft(state.fields, state.media));
}

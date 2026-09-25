import { create } from 'zustand';

import {
  type DraftFields,
  EMPTY_FIELDS,
  newIdempotencyKey,
} from '@/features/listings/draft/listing-draft';
import {
  type DraftMedia,
  type MediaAction,
  mediaReducer,
} from '@/features/listings/draft/media-reducer';

// The sell page unmounts when the seller opens another page; the draft, and the services
// working on its files, live outside it (plans/create-listing.md, "Draft that survives
// navigation"). Lost on a WebView reload, by decision.
interface ListingDraftState {
  fields: DraftFields;
  media: DraftMedia[];
  /** One per draft, sent again on every retry of its post (api-spec, `POST /products`). */
  idempotencyKey: string;
  setFields: (fields: Partial<DraftFields>) => void;
  dispatchMedia: (action: MediaAction) => void;
}

export const useListingDraftStore = create<ListingDraftState>((set) => ({
  fields: EMPTY_FIELDS,
  media: [],
  idempotencyKey: newIdempotencyKey(),
  setFields: (fields) => set((state) => ({ fields: { ...state.fields, ...fields } })),
  dispatchMedia: (action) => set((state) => ({ media: mediaReducer(state.media, action) })),
}));

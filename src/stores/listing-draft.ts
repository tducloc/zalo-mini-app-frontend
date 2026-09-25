import { create } from 'zustand';

import {
  type DraftMedia,
  type MediaAction,
  mediaReducer,
} from '@/features/listings/draft/media-reducer';

// The sell page unmounts when the seller opens another page; the draft, and the services
// working on its files, live outside it (plans/create-listing.md, "Draft that survives
// navigation"). Lost on a WebView reload, by decision.
interface ListingDraftState {
  media: DraftMedia[];
  dispatchMedia: (action: MediaAction) => void;
}

export const useListingDraftStore = create<ListingDraftState>((set) => ({
  media: [],
  dispatchMedia: (action) => set((state) => ({ media: mediaReducer(state.media, action) })),
}));

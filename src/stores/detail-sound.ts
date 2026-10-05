import { create } from 'zustand';

interface DetailSoundState {
  isMuted: boolean;
  setMuted: (isMuted: boolean) => void;
}

/**
 * Sound for the listing video, kept across listings. Apart from Reels' own: each feature
 * plays in its own element, which iOS unlocks for sound one at a time.
 */
export const useDetailSoundStore = create<DetailSoundState>((set) => ({
  isMuted: false,
  setMuted: (isMuted) => set({ isMuted }),
}));

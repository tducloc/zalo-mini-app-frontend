import { create } from 'zustand';

// The Reels page unmounts when detail is pushed, so the reel on screen lives here to come
// back to it.
interface ReelsState {
  /** The reel on screen, by product ID. */
  activeId: string | null;
  /** Off until the viewer turns the sound on; kept for the session. */
  isMuted: boolean;
  setActiveId: (activeId: string) => void;
  setMuted: (isMuted: boolean) => void;
}

export const useReelsStore = create<ReelsState>((set) => ({
  activeId: null,
  isMuted: true,
  setActiveId: (activeId) => set({ activeId }),
  setMuted: (isMuted) => set({ isMuted }),
}));

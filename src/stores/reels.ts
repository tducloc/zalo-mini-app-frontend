import { create } from 'zustand';

// The Reels page unmounts when detail is pushed, so the reel on screen lives here to come
// back to it.
interface ReelsState {
  /** The reel on screen, by product ID. */
  activeId: string | null;
  /** Off until the viewer turns the sound on; kept for the session. */
  isMuted: boolean;
  tabbarHost: HTMLElement | null;
  isPagerInteractive: boolean;
  setActiveId: (activeId: string) => void;
  setMuted: (isMuted: boolean) => void;
  setTabbarHost: (tabbarHost: HTMLElement | null) => void;
  setPagerInteractive: (isPagerInteractive: boolean) => void;
}

export const useReelsStore = create<ReelsState>((set) => ({
  activeId: null,
  isMuted: true,
  tabbarHost: null,
  isPagerInteractive: false,
  setActiveId: (activeId) => set({ activeId }),
  setMuted: (isMuted) => set({ isMuted }),
  setTabbarHost: (tabbarHost) => set({ tabbarHost }),
  setPagerInteractive: (isPagerInteractive) => set({ isPagerInteractive }),
}));

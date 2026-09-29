import { create } from 'zustand';

interface ReelsState {
  activeProductId: string | null;
  isMuted: boolean;
  tabbarHost: HTMLElement | null;
  isPagerInteractive: boolean;
  setActiveProductId: (activeProductId: string) => void;
  setMuted: (isMuted: boolean) => void;
  setTabbarHost: (tabbarHost: HTMLElement | null) => void;
  setPagerInteractive: (isPagerInteractive: boolean) => void;
}

export const useReelsStore = create<ReelsState>((set) => ({
  activeProductId: null,
  isMuted: true,
  tabbarHost: null,
  isPagerInteractive: false,
  setActiveProductId: (activeProductId) => set({ activeProductId }),
  setMuted: (isMuted) => set({ isMuted }),
  setTabbarHost: (tabbarHost) => set({ tabbarHost }),
  setPagerInteractive: (isPagerInteractive) => set({ isPagerInteractive }),
}));

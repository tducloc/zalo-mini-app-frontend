import { type PropsWithChildren, useCallback, useEffect } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { type InfiniteData, useQueryClient } from '@tanstack/react-query';
import { configAppView, EventName, events, getSystemInfo } from 'zmp-sdk';
import { Icon, useLocation, useNavigate } from 'zmp-ui';

import DraftBanner from '@/features/listings/components/draft/draft-banner';
import DraftIndicator, {
  DRAFT_STATUS_ID,
} from '@/features/listings/components/draft/draft-indicator';
import { isReelsPageLoaded, preloadPages } from '@/pages/lazy-pages';
import { useHasDraft } from '@/stores/listing-draft';
import { useToastOffset } from '@/hooks/use-toast-offset';
import { useReelsStore } from '@/stores/reels';
import { reelKeys, reelsQueryOptions } from '@/features/reels/api/get-reels';
import type { ReelsPage } from '@/features/reels/types/reel';
import { videoPool } from '@/lib/video-pool';
import { warnInDev } from '@/utils/dev-log';

type NavigationItem = {
  label: string;
  icon: 'zi-home' | 'zi-file' | 'zi-plus' | 'zi-video' | 'zi-user';
  path: string;
  primary?: boolean;
};

// Above the tab bar (74px), below its raised "+".
const draftBannerClass =
  'pointer-events-auto fixed inset-x-3 bottom-[84px] z-[899] shadow-[0_4px_12px_rgb(23_57_108/18%)]';
const tabClass =
  'relative z-[1] flex min-w-0 flex-col items-center gap-0.5 border-0 p-0 text-[10px] font-medium leading-[14px]';

const navigationItems: NavigationItem[] = [
  { label: 'Trang chủ', icon: 'zi-home', path: '/' },
  { label: 'Quản lý tin', icon: 'zi-file', path: '/my-listings' },
  { label: 'Đăng tin', icon: 'zi-plus', path: '/sell', primary: true },
  { label: 'Reels', icon: 'zi-video', path: '/reels' },
  { label: 'Cá nhân', icon: 'zi-user', path: '/profile' },
];

function getTabColorClass(item: NavigationItem, isActive: boolean, isDark: boolean) {
  if (isDark) {
    return `${item.primary ? 'font-semibold' : ''} ${isActive ? 'text-white' : 'text-[#a9b0bf]'}`;
  }
  if (item.primary) {
    return isActive ? 'font-semibold text-[#1b2a50]' : 'font-semibold text-[#17234a]';
  }

  return isActive ? 'text-marketplace-blue' : 'text-[#7080a2]';
}

export default function AppShell({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const location = useLocation();
  const currentPath = location.pathname;
  const tabbarHost = useReelsStore((state) => state.tabbarHost);
  const isPagerInteractive = useReelsStore((state) => state.isPagerInteractive);
  const shouldShowTabbar = !currentPath.startsWith('/products/');
  const isDark = currentPath === '/reels';
  // Zalo draws its "•••" and "✕" over the page. Reels and a listing start with dark media at
  // the top, where the theme's black icons vanish.
  const hasDarkTop = isDark || currentPath.startsWith('/products/');
  // On the sell page the draft is in front of the seller.
  const shouldShowDraft = currentPath !== '/sell';
  const isDraftBannerShown = useHasDraft() && shouldShowDraft;
  // The tab bar (74px and its raised "+", 14px), or the draft banner above it (bottom 84px,
  // 52px tall).
  useToastOffset(shouldShowTabbar ? (isDraftBannerShown ? 136 : 88) : null);
  const setVideoParking = useCallback((element: HTMLDivElement | null) => {
    videoPool.setParking(element);
  }, []);

  // A link opened while the Mini App runs in the background (a listing sent in a chat) brings
  // back the last page; Zalo passes the link's path to go to.
  useEffect(() => {
    events.on(EventName.OpenApp, ({ path }: { path?: string }) => {
      if (path) navigate(path);
    });
    // zmp-sdk wraps each listener, so only removing every OpenApp listener works.
    return () => {
      events.off(EventName.OpenApp);
    };
  }, [navigate]);

  useEffect(() => {
    const themeTextColor = getSystemInfo().zaloTheme === 'dark' ? 'white' : 'black';
    // The rest matches app-config.json, including when HMR retains an older native view
    // configuration.
    void configAppView({
      actionBar: { hide: true },
      statusBarType: 'transparent',
      headerTextColor: hasDarkTop ? 'white' : themeTextColor,
    }).catch((error: unknown) => warnInDev('app', 'Cannot configure native header', error));
  }, [hasDarkTop]);

  useEffect(() => {
    void queryClient.prefetchInfiniteQuery(reelsQueryOptions);
  }, [queryClient]);

  // The screens' code loads after the window's load event, which waits for the first card
  // images, so it stays off LCP.
  useEffect(() => {
    if (document.readyState === 'complete') {
      preloadPages();
      return;
    }

    window.addEventListener('load', preloadPages, { once: true });
  }, []);

  const navigateFromTab = (path: string) => {
    if (
      path === '/reels' &&
      currentPath !== '/reels' &&
      useReelsStore.getState().activeProductId === null
    ) {
      const hasFirstReel = Boolean(
        queryClient.getQueryData<InfiniteData<ReelsPage>>(reelKeys.all())?.pages[0]?.data.length,
      );
      // Sound needs the first reel mounted inside the tap. Otherwise the page starts muted.
      if (hasFirstReel && isReelsPageLoaded()) {
        flushSync(() => {
          useReelsStore.getState().setMuted(false);
          navigate(path);
        });
        return;
      }
    }
    navigate(path);
  };

  const chrome = (
    <>
      {shouldShowTabbar && shouldShowDraft && <DraftBanner className={draftBannerClass} />}
      {shouldShowTabbar && (
        <nav
          className="pointer-events-auto fixed inset-x-0 bottom-0 isolate z-[900] grid h-[74px] grid-cols-5 px-[3px] pb-2 pt-3"
          aria-label="Điều hướng chính"
        >
          <svg
            className="pointer-events-none absolute inset-x-0 -top-3.5 bottom-0 z-0 h-[calc(100%_+_14px)] w-full overflow-visible"
            viewBox="0 0 100 96"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              fill={isDark ? 'black' : 'white'}
              d="M0 14H41.5C44.5 14 45 0 50 0S55.5 14 58.5 14H100V96H0Z"
            />
            <path
              fill="none"
              stroke={isDark ? '#2b2f38' : '#e5eaf2'}
              strokeWidth={0.5}
              vectorEffect="non-scaling-stroke"
              d="M0 14H41.5C44.5 14 45 0 50 0S55.5 14 58.5 14H100"
            />
          </svg>
          {navigationItems.map((item) => {
            const isActive = item.path === currentPath;
            return (
              <button
                key={item.label}
                className={`${tabClass} ${getTabColorClass(item, isActive, isDark)}`}
                aria-current={isActive ? 'page' : undefined}
                aria-describedby={item.primary && shouldShowDraft ? DRAFT_STATUS_ID : undefined}
                onClick={() => navigateFromTab(item.path)}
              >
                <span
                  className={`grid size-7 place-items-center ${item.primary ? 'relative' : ''}`}
                >
                  {item.primary ? (
                    <span className="absolute -top-[18px] left-1/2 grid size-11 -translate-x-1/2 place-items-center rounded-full bg-[#0878f9] text-white shadow-[0_2px_6px_rgb(0_104_255/18%)]">
                      <span
                        className="-mt-0.5 block text-[29px] font-light leading-[29px] text-white"
                        aria-hidden="true"
                      >
                        +
                      </span>
                      {shouldShowDraft && <DraftIndicator />}
                    </span>
                  ) : (
                    <Icon icon={item.icon} size={23} />
                  )}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </>
  );

  return (
    <>
      <div
        ref={setVideoParking}
        data-video-parking
        aria-hidden="true"
        className="pointer-events-none fixed -left-px -top-px size-px overflow-hidden opacity-0"
      />
      {/* The pages leave room at their end for the draft banner ([.has-draft-banner_&]). */}
      <div className={isDraftBannerShown ? 'has-draft-banner contents' : 'contents'}>
        {children}
      </div>
      {currentPath === '/reels' && tabbarHost && isPagerInteractive
        ? createPortal(chrome, tabbarHost)
        : chrome}
    </>
  );
}

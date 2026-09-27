import { PropsWithChildren } from 'react';
import { Icon, useLocation, useNavigate } from 'zmp-ui';

import DraftBanner from '@/features/listings/components/draft/draft-banner';
import DraftIndicator, {
  DRAFT_STATUS_ID,
} from '@/features/listings/components/draft/draft-indicator';
import { useHasDraft } from '@/stores/listing-draft';

type NavigationItem = {
  label: string;
  icon: 'zi-home' | 'zi-file' | 'zi-plus' | 'zi-video' | 'zi-user';
  path?: string;
  primary?: boolean;
  disabled?: boolean;
};

// Above the tab bar (74px), below its raised "+".
const draftBannerClass =
  'fixed inset-x-3 bottom-[84px] z-[899] shadow-[0_4px_12px_rgb(23_57_108/18%)]';
const tabClass =
  'relative z-[1] flex min-w-0 flex-col items-center gap-0.5 border-0 p-0 text-[10px] font-medium leading-[14px] disabled:opacity-45';

const navigationItems: NavigationItem[] = [
  { label: 'Trang chủ', icon: 'zi-home', path: '/' },
  { label: 'Quản lý tin', icon: 'zi-file', path: '/my-listings' },
  { label: 'Đăng tin', icon: 'zi-plus', path: '/sell', primary: true },
  { label: 'Reels', icon: 'zi-video', disabled: true },
  { label: 'Cá nhân', icon: 'zi-user', path: '/profile' },
];

/** The tab's text colour; the raised "Đăng tin" is dark even when current. */
function getTabColorClass(item: NavigationItem, isActive: boolean) {
  if (item.primary) {
    return isActive ? 'font-semibold text-[#1b2a50]' : 'font-semibold text-[#17234a]';
  }

  return isActive ? 'text-marketplace-blue' : 'text-[#7080a2]';
}

export default function AppShell({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const shouldShowTabbar = !currentPath.startsWith('/products/');
  // On the sell page the draft is in front of the seller.
  const shouldShowDraft = currentPath !== '/sell';
  const isDraftBannerShown = useHasDraft() && shouldShowDraft;

  return (
    <>
      {/* The pages leave room at their end for the draft banner ([.has-draft-banner_&]). */}
      <div className={isDraftBannerShown ? 'has-draft-banner contents' : 'contents'}>
        {children}
      </div>
      {shouldShowTabbar && shouldShowDraft && <DraftBanner className={draftBannerClass} />}
      {shouldShowTabbar && (
        <nav
          className="fixed inset-x-0 bottom-0 isolate z-[900] grid h-[74px] grid-cols-5 px-[3px] pb-2 pt-3"
          aria-label="Điều hướng chính"
        >
          {/* The bar's white shape, raised 14px around the "+". */}
          <svg
            className="pointer-events-none absolute inset-x-0 -top-3.5 bottom-0 z-0 h-[calc(100%_+_14px)] w-full overflow-visible"
            viewBox="0 0 100 96"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path fill="white" d="M0 14H41.5C44.5 14 45 0 50 0S55.5 14 58.5 14H100V96H0Z" />
            <path
              fill="none"
              stroke="#e5eaf2"
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
                className={`${tabClass} ${getTabColorClass(item, isActive)}`}
                aria-current={isActive ? 'page' : undefined}
                aria-describedby={item.primary && shouldShowDraft ? DRAFT_STATUS_ID : undefined}
                disabled={item.disabled}
                onClick={() => item.path && navigate(item.path)}
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
}

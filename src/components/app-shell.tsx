import { PropsWithChildren } from 'react';
import { Icon, useLocation, useNavigate } from 'zmp-ui';

import DraftBanner from '@/features/listings/components/draft-banner';
import DraftIndicator, { DRAFT_STATUS_ID } from '@/features/listings/components/draft-indicator';
import { hasDraft } from '@/features/listings/utils/listing-draft';
import { useListingDraftStore } from '@/stores/listing-draft';

type NavigationItem = {
  label: string;
  icon: 'zi-home' | 'zi-file' | 'zi-plus' | 'zi-video' | 'zi-user';
  path?: string;
  primary?: boolean;
  disabled?: boolean;
};
const navigationItems: NavigationItem[] = [
  { label: 'Trang chủ', icon: 'zi-home', path: '/' },
  { label: 'Quản lý tin', icon: 'zi-file', path: '/my-listings' },
  { label: 'Đăng tin', icon: 'zi-plus', path: '/sell', primary: true },
  { label: 'Reels', icon: 'zi-video', disabled: true },
  { label: 'Cá nhân', icon: 'zi-user', path: '/profile' },
];

export default function AppShell({
  children,
  previewPath,
  onPreviewNavigate,
}: PropsWithChildren<{
  previewPath?: string;
  onPreviewNavigate?: (path: string) => void;
}>) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = previewPath ?? location.pathname;
  const shouldShowTabbar = !currentPath.startsWith('/products/');
  // On the sell page the draft is in front of the seller.
  const shouldShowDraft = currentPath !== '/sell';
  const isDraftBannerShown =
    useListingDraftStore((state) => hasDraft(state.fields, state.media)) && shouldShowDraft;

  return (
    <>
      {/* The pages leave room at their end for the draft banner (app.scss). */}
      <div className={isDraftBannerShown ? 'has-draft-banner contents' : 'contents'}>
        {children}
      </div>
      {shouldShowTabbar && shouldShowDraft && <DraftBanner className="marketplace-draft-banner" />}
      {shouldShowTabbar && (
        <nav className="marketplace-tabbar" aria-label="Điều hướng chính">
          <svg
            className="marketplace-tabbar-shape"
            viewBox="0 0 100 96"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              className="marketplace-tabbar-background"
              d="M0 14H41.5C44.5 14 45 0 50 0S55.5 14 58.5 14H100V96H0Z"
            />
            <path
              className="marketplace-tabbar-border"
              d="M0 14H41.5C44.5 14 45 0 50 0S55.5 14 58.5 14H100"
            />
          </svg>
          {navigationItems.map((item) => {
            const isActive = item.path === currentPath;
            return (
              <button
                key={item.label}
                className={`marketplace-tab ${item.primary ? 'marketplace-tab-primary' : ''} ${item.disabled ? 'bottom-nav-disabled' : ''} ${isActive ? 'marketplace-tab-active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                aria-describedby={item.primary && shouldShowDraft ? DRAFT_STATUS_ID : undefined}
                disabled={item.disabled}
                onClick={() =>
                  item.path &&
                  (onPreviewNavigate ? onPreviewNavigate(item.path) : navigate(item.path))
                }
              >
                <span className="marketplace-tab-icon">
                  {item.primary ? (
                    <span className="marketplace-create-button">
                      <span className="marketplace-plus" aria-hidden="true">
                        +
                      </span>
                      {shouldShowDraft && <DraftIndicator />}
                    </span>
                  ) : (
                    <Icon icon={item.icon} size={23} />
                  )}
                </span>
                <span className="marketplace-tab-label">{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </>
  );
}

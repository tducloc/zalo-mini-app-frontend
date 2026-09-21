import { PropsWithChildren } from 'react';
import { Icon, useLocation, useNavigate } from 'zmp-ui';

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
  hasDraft = false,
}: PropsWithChildren<{
  previewPath?: string;
  onPreviewNavigate?: (path: string) => void;
  /** Signals that an unfinished listing draft still needs the seller's attention. */
  hasDraft?: boolean;
}>) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = previewPath ?? location.pathname;
  const showTabbar = !currentPath.startsWith('/products/');

  return (
    <>
      {children}
      {showTabbar && (
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
                disabled={item.disabled}
                onClick={() =>
                  item.path &&
                  (onPreviewNavigate ? onPreviewNavigate(item.path) : navigate(item.path))
                }
              >
                <span className="marketplace-tab-icon">
                  {item.primary ? (
                    <span className="marketplace-create-button">
                      <span className="marketplace-plus">+</span>
                      {hasDraft && (
                        <span className="marketplace-draft-indicator" aria-hidden="true" />
                      )}
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

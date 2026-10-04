import { lazy, type ReactNode, Suspense, useEffect } from 'react';
import { configAppView, getSystemInfo } from 'zmp-sdk';
import { AnimationRoutes, App, Route, SnackbarProvider, ZMPRouter } from 'zmp-ui';
import { AppProps } from 'zmp-ui/app';
import ErrorBoundary from '@/components/feedback/error-boundary';
import AppShell from '@/components/layout/app-shell';
import { AuthBootstrap } from '@/features/auth/components/bootstrap';
import HomePage from '@/pages/home';
import { warnInDev } from '@/utils/dev-log';

// Home stays in the first script. The other screens load when the route opens.
const MyListingsPage = lazy(() => import('@/pages/my-listings'));
const SellPage = lazy(() => import('@/pages/sell'));
const ReelsPage = lazy(() => import('@/pages/reels'));
const ProfilePage = lazy(() => import('@/pages/profile'));
const ProductDetailPage = lazy(() => import('@/pages/product-detail'));
const EditListingPage = lazy(() => import('@/pages/edit-listing'));

// Dev-only measurement page. Remove once the media numbers are recorded. Loaded lazily so
// none of its code reaches a build without the flag.
const showMediaLab = import.meta.env.DEV || import.meta.env.VITE_MEDIA_LAB === 'true';
const MediaLabPage = showMediaLab ? lazy(() => import('@/pages/media-lab')) : null;

// One broken page shows its own error screen; the tab bar and the other pages keep working.
const guarded = (page: ReactNode) => <ErrorBoundary scope="page">{page}</ErrorBoundary>;

export default function MyApp() {
  useEffect(() => {
    // Match app-config.json, including when HMR retains an older native view configuration.
    void configAppView({
      actionBar: { hide: true },
      statusBarType: 'transparent',
    }).catch((error: unknown) => warnInDev('app', 'Cannot configure native header', error));
  }, []);

  return (
    <App theme={getSystemInfo().zaloTheme as AppProps['theme']}>
      <SnackbarProvider>
        <AuthBootstrap>
          <ZMPRouter>
            <AppShell>
              <Suspense fallback={null}>
                <AnimationRoutes>
                  <Route path="/" element={guarded(<HomePage />)} />
                  <Route path="/my-listings" element={guarded(<MyListingsPage />)} />
                  <Route path="/sell" element={guarded(<SellPage />)} />
                  <Route path="/reels" element={guarded(<ReelsPage />)} />
                  <Route path="/profile" element={guarded(<ProfilePage />)} />
                  {MediaLabPage && (
                    <Route
                      path="/media-lab"
                      element={guarded(
                        <Suspense fallback={null}>
                          <MediaLabPage />
                        </Suspense>,
                      )}
                    />
                  )}
                  <Route path="/products/:productId" element={guarded(<ProductDetailPage />)} />
                  <Route path="/products/:productId/edit" element={guarded(<EditListingPage />)} />
                </AnimationRoutes>
              </Suspense>
            </AppShell>
          </ZMPRouter>
        </AuthBootstrap>
      </SnackbarProvider>
    </App>
  );
}

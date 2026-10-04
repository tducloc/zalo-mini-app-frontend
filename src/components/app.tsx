import { lazy, Suspense, useEffect } from 'react';
import { configAppView, getSystemInfo } from 'zmp-sdk';
import { AnimationRoutes, App, Route, SnackbarProvider, ZMPRouter } from 'zmp-ui';
import { AppProps } from 'zmp-ui/app';
import AppShell from '@/components/layout/app-shell';
import { AuthBootstrap } from '@/features/auth/components/bootstrap';
import HomePage from '@/pages/home';
import ReelsPage from '@/pages/reels';
import { warnInDev } from '@/utils/dev-log';

// Home and Reels stay in the first script. The Reels tab tap renders the page inside the tap
// (flushSync), the one moment WebKit allows sound, and a lazy page would suspend there.
// The other screens load when the route opens.
const MyListingsPage = lazy(() => import('@/pages/my-listings'));
const SellPage = lazy(() => import('@/pages/sell'));
const ProfilePage = lazy(() => import('@/pages/profile'));
const ProductDetailPage = lazy(() => import('@/pages/product-detail'));
const EditListingPage = lazy(() => import('@/pages/edit-listing'));

// Dev-only measurement page. Remove once the media numbers are recorded. Loaded lazily so
// none of its code reaches a build without the flag.
const showMediaLab = import.meta.env.DEV || import.meta.env.VITE_MEDIA_LAB === 'true';
const MediaLabPage = showMediaLab ? lazy(() => import('@/pages/media-lab')) : null;

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
          <ZMPRouter memoryRouter>
            <AppShell>
              <Suspense fallback={null}>
                <AnimationRoutes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/my-listings" element={<MyListingsPage />} />
                  <Route path="/sell" element={<SellPage />} />
                  <Route path="/reels" element={<ReelsPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  {MediaLabPage && (
                    <Route
                      path="/media-lab"
                      element={
                        <Suspense fallback={null}>
                          <MediaLabPage />
                        </Suspense>
                      }
                    />
                  )}
                  <Route path="/products/:productId" element={<ProductDetailPage />} />
                  <Route path="/products/:productId/edit" element={<EditListingPage />} />
                </AnimationRoutes>
              </Suspense>
            </AppShell>
          </ZMPRouter>
        </AuthBootstrap>
      </SnackbarProvider>
    </App>
  );
}

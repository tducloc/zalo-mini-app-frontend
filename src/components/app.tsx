import { useEffect } from 'react';
import { configAppView, getSystemInfo } from 'zmp-sdk';
import { AnimationRoutes, App, Route, SnackbarProvider, ZMPRouter } from 'zmp-ui';
import { AppProps } from 'zmp-ui/app';
import AppShell from '@/components/app-shell';
import { AuthBootstrap } from '@/features/auth/components/bootstrap';
import HomePage from '@/pages/home';
import MediaLabPage from '@/pages/media-lab';
import MyListingsPage from '@/pages/my-listings';
import ProductDetailPage from '@/pages/product-detail';
import ProfilePage from '@/pages/profile';
import SellPage from '@/pages/sell';

// Dev-only measurement page. Remove once the media numbers are recorded.
const showMediaLab = import.meta.env.DEV || import.meta.env.VITE_MEDIA_LAB === 'true';

export default function MyApp() {
  useEffect(() => {
    // Match app-config.json, including when HMR retains an older native view configuration.
    void configAppView({
      actionBar: { hide: true },
      statusBarType: 'transparent',
    }).catch((error: unknown) => {
      if (import.meta.env.DEV) console.warn('[app] Cannot configure native header', error);
    });
  }, []);

  return (
    <App theme={getSystemInfo().zaloTheme as AppProps['theme']}>
      <SnackbarProvider>
        <AuthBootstrap>
          <ZMPRouter memoryRouter>
            <AppShell>
              <AnimationRoutes>
                <Route path="/" element={<HomePage />} />
                <Route path="/my-listings" element={<MyListingsPage />} />
                <Route path="/sell" element={<SellPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                {showMediaLab && <Route path="/media-lab" element={<MediaLabPage />} />}
                <Route path="/products/:productId" element={<ProductDetailPage />} />
              </AnimationRoutes>
            </AppShell>
          </ZMPRouter>
        </AuthBootstrap>
      </SnackbarProvider>
    </App>
  );
}

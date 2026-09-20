import { getSystemInfo } from 'zmp-sdk';
import { AnimationRoutes, App, Route, SnackbarProvider, ZMPRouter } from 'zmp-ui';
import { AppProps } from 'zmp-ui/app';
import AppShell from '@/components/app-shell';
import { AuthBootstrap } from '@/features/auth/components/bootstrap';
import HomePage from '@/pages/home';
import MyListingsPage from '@/pages/my-listings';
import ProductDetailPage from '@/pages/product-detail';
import ProfilePage from '@/pages/profile';
import SellPage from '@/pages/sell';

export default function MyApp() {
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
                <Route path="/products/:productId" element={<ProductDetailPage />} />
              </AnimationRoutes>
            </AppShell>
          </ZMPRouter>
        </AuthBootstrap>
      </SnackbarProvider>
    </App>
  );
}

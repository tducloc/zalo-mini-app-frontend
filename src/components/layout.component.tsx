import { getSystemInfo } from 'zmp-sdk';
import { AnimationRoutes, App, Route, SnackbarProvider, ZMPRouter } from 'zmp-ui';
import { AppProps } from 'zmp-ui/app';
import AppShell from '@/components/app-shell.component';
import { AuthBootstrap } from '@/features/auth/auth-bootstrap.component';
import HomePage from '@/pages/home.page';
import MyListingsPage from '@/pages/my-listings.page';
import ProductDetailPage from '@/pages/product-detail.page';
import ProfilePage from '@/pages/profile.page';
import SellPage from '@/pages/sell.page';

export default function Layout() {
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

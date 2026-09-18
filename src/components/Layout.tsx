import { getSystemInfo } from 'zmp-sdk';
import { AnimationRoutes, App, Route, SnackbarProvider, ZMPRouter } from 'zmp-ui';
import { AppProps } from 'zmp-ui/app';
import AppShell from '@/components/AppShell';
import HomePage from '@/pages/HomePage';
import MyListingsPage from '@/pages/MyListingsPage';
import ProfilePage from '@/pages/ProfilePage';
import SellPage from '@/pages/SellPage';
import { AuthBootstrap } from '@/features/auth/AuthBootstrap';

export default function Layout() {
  return (
    <App theme={getSystemInfo().zaloTheme as AppProps['theme']}>
      <SnackbarProvider>
        <AuthBootstrap>
          <ZMPRouter>
            <AppShell>
              <AnimationRoutes>
                <Route path="/" element={<HomePage />} />
                <Route path="/my-listings" element={<MyListingsPage />} />
                <Route path="/sell" element={<SellPage />} />
                <Route path="/profile" element={<ProfilePage />} />
              </AnimationRoutes>
            </AppShell>
          </ZMPRouter>
        </AuthBootstrap>
      </SnackbarProvider>
    </App>
  );
}

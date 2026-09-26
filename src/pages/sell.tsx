import { Page } from 'zmp-ui';
import MobilePageHeader from '@/components/layout/mobile-page-header';
import CreateListingForm from '@/features/listings/components/form/create-listing-form';

export default function SellPage() {
  return (
    <Page className="marketplace-page">
      <MobilePageHeader title="Đăng tin" showBack />
      <main className="marketplace-content marketplace-content-with-header">
        <CreateListingForm />
      </main>
    </Page>
  );
}

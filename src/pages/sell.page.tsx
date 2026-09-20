import { Page } from 'zmp-ui';
import MobilePageHeader from '@/components/mobile-page-header.component';
import ListingForm from '@/features/listings/listing-form.component';

export default function SellPage() {
  return (
    <Page className="marketplace-page">
      <MobilePageHeader title="Đăng tin" showBack />
      <main className="marketplace-content marketplace-content-with-header">
        <ListingForm />
      </main>
    </Page>
  );
}

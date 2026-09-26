import { Page } from 'zmp-ui';

import MobilePageHeader from '@/components/layout/mobile-page-header';
import { pageClass, pageContentClass } from '@/components/layout/styles';
import CreateListingForm from '@/features/listings/components/form/create-listing-form';

export default function SellPage() {
  return (
    <Page className={pageClass}>
      <MobilePageHeader title="Đăng tin" showBack />
      <main className={pageContentClass}>
        <CreateListingForm />
      </main>
    </Page>
  );
}

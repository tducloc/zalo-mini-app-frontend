import { Page } from 'zmp-ui';

import MobilePageHeader from '@/components/layout/mobile-page-header';
import { pageClass, pageContentClass } from '@/components/layout/styles';
import SellerPermissionNotice from '@/features/contact/components/seller-permission-notice';
import { SellerPermissionAsk } from '@/features/contact/hooks/use-seller-permissions';
import CreateListingForm from '@/features/listings/components/form/create-listing-form';
import { useListingDraftStore } from '@/stores/listing-draft';

export default function SellPage() {
  // A new draft (posted or discarded) gets a new form. Tapping "Đăng tin" while the page
  // still slides out after a post reuses this page, whose form held the posted fields.
  const draftKey = useListingDraftStore((state) => state.idempotencyKey);

  return (
    <Page className={pageClass}>
      <MobilePageHeader title="Đăng tin" showBack />
      <main className={pageContentClass}>
        <SellerPermissionAsk />
        <SellerPermissionNotice />
        <CreateListingForm key={draftKey} />
      </main>
    </Page>
  );
}

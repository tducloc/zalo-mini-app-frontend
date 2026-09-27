import { Button, Icon, Page } from 'zmp-ui';

import MobilePageHeader from '@/components/layout/mobile-page-header';
import { cardClass, pageClass, pageContentClass, stateIconClass } from '@/components/layout/styles';

const copyClass = 'mb-5 mt-2 text-sm leading-normal text-marketplace-muted';

export default function MyListingsPage() {
  return (
    <Page className={pageClass}>
      <MobilePageHeader title="Quản lý tin" />
      <main className={pageContentClass}>
        <p className={copyClass}>Các tin bạn đang bán, đã bán hoặc đã ẩn sẽ xuất hiện tại đây.</p>
        <section
          className={`${cardClass} grid min-h-[275px] place-items-center px-6 py-9 text-center`}
        >
          <div className="max-w-[260px]">
            <span className={`${stateIconClass} mx-auto mb-3`}>
              <Icon icon="zi-file" size={27} />
            </span>
            <h2 className="m-0 text-lg font-semibold">Chưa có tin đăng</h2>
            <p className={copyClass}>Đăng sản phẩm đầu tiên để bắt đầu mua bán.</p>
            <Button fullWidth>Đăng tin ngay</Button>
          </div>
        </section>
      </main>
    </Page>
  );
}

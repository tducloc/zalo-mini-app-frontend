import { Button, Icon, Page } from 'zmp-ui';
import MobilePageHeader from '@/components/mobile-page-header';

export default function MyListingsPage() {
  return (
    <Page className="marketplace-page">
      <MobilePageHeader title="Quản lý tin" />
      <main className="marketplace-content marketplace-content-with-header">
        <p className="screen-copy">Các tin bạn đang bán, đã bán hoặc đã ẩn sẽ xuất hiện tại đây.</p>
        <section className="marketplace-card state-panel">
          <div>
            <span className="state-icon">
              <Icon icon="zi-file" size={27} />
            </span>
            <h2 className="m-0 text-lg font-semibold">Chưa có tin đăng</h2>
            <p className="screen-copy">Đăng sản phẩm đầu tiên để bắt đầu mua bán.</p>
            <Button fullWidth>Đăng tin ngay</Button>
          </div>
        </section>
      </main>
    </Page>
  );
}

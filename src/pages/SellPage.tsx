import { Button, Icon, Page } from 'zmp-ui';
import MobilePageHeader from '@/components/MobilePageHeader';

export default function SellPage() {
  return (
    <Page className="marketplace-page">
      <MobilePageHeader title="Đăng tin" showBack />
      <main className="marketplace-content marketplace-content-with-header">
        <p className="screen-copy">
          Form đăng tin sẽ được triển khai sau khi hoàn tất nền tảng xác thực hôm nay.
        </p>
        <section className="marketplace-card state-panel">
          <div>
            <span className="state-icon">
              <Icon icon="zi-plus-circle" size={27} />
            </span>
            <h2 className="m-0 text-lg font-semibold">Sẵn sàng đăng sản phẩm</h2>
            <p className="screen-copy">
              Danh mục, vị trí và ảnh sản phẩm đã được chốt trong API contract.
            </p>
            <Button fullWidth disabled>
              Tiếp tục
            </Button>
          </div>
        </section>
      </main>
    </Page>
  );
}

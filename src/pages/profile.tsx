import { Icon, Page } from 'zmp-ui';
import MobilePageHeader from '@/components/mobile-page-header';
import { useSession } from '@/features/auth/hooks/session';

export default function ProfilePage() {
  const user = useSession().session?.user;

  return (
    <Page className="marketplace-page">
      <MobilePageHeader title="Cá nhân" />
      <main className="marketplace-content marketplace-content-with-header">
        <section className="marketplace-card flex items-center gap-3 p-4">
          <span className="state-icon m-0">
            <Icon icon="zi-user" size={27} />
          </span>
          <div>
            <p className="m-0 font-semibold">{user?.name ?? 'Người dùng Zalo'}</p>
            <p className="m-0 mt-1 text-sm text-slate-500">
              {user ? 'Đã xác thực với Zalo' : 'Chưa thể xác thực trong trình duyệt'}
            </p>
          </div>
        </section>
      </main>
    </Page>
  );
}

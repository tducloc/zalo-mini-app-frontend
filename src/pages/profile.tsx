import { Button, Icon, Page, useNavigate } from 'zmp-ui';
import MobilePageHeader from '@/components/mobile-page-header';
import { useSession } from '@/features/auth/hooks/session';

// Dev-only entry to the media measurement page. Remove with src/pages/media-lab.tsx.
const showMediaLab = import.meta.env.DEV || import.meta.env.VITE_MEDIA_LAB === 'true';

export default function ProfilePage() {
  const user = useSession().session?.user;
  const navigate = useNavigate();

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

        {showMediaLab && (
          <section className="marketplace-card mt-3 p-4">
            <Button size="small" variant="tertiary" onClick={() => navigate('/media-lab')}>
              Media lab (dev)
            </Button>
          </section>
        )}
      </main>
    </Page>
  );
}

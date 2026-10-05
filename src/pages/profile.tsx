import { Button, Icon, Page, useNavigate } from 'zmp-ui';

import MobilePageHeader from '@/components/layout/mobile-page-header';
import { cardClass, pageClass, pageContentClass, stateIconClass } from '@/components/layout/styles';
import { useSession } from '@/features/auth/hooks/use-session';
import { getAuthStatusLabel } from '@/features/auth/utils/auth-status';
import PhoneNumberCard from '@/features/contact/components/phone-number-card';
import { useOpenZaloPermissionSettings } from '@/features/contact/hooks/use-open-zalo-permission-settings';
import { useShareSellerPermissions } from '@/features/contact/hooks/use-seller-permissions';

// Dev-only entry to the media measurement page. Remove with src/pages/media-lab.tsx.
const showMediaLab = import.meta.env.DEV || import.meta.env.VITE_MEDIA_LAB === 'true';

export default function ProfilePage() {
  const { session, isBootstrapping } = useSession();
  const user = session?.user;
  const navigate = useNavigate();
  const activation = useShareSellerPermissions();
  const openPermissionSettings = useOpenZaloPermissionSettings();

  return (
    <Page className={pageClass}>
      <MobilePageHeader title="Cá nhân" />
      <main className={pageContentClass}>
        <section className={`${cardClass} flex flex-wrap items-center gap-3 p-4`}>
          <span className={stateIconClass}>
            <Icon icon="zi-user" size={27} />
          </span>
          {activation.missing ? (
            <>
              <div className="min-w-0 flex-1">
                <p className="m-0 font-semibold">Kích hoạt tài khoản</p>
                <p className="m-0 mt-1 text-sm text-slate-500">
                  Tên và số điện thoại Zalo của bạn sẽ được dùng để người mua có thể liên hệ khi
                  quan tâm đến sản phẩm.
                </p>
              </div>
              <button
                type="button"
                disabled={activation.isSharing}
                onClick={activation.share}
                className="min-h-11 w-full rounded-full border-0 bg-marketplace-blue font-bold text-white disabled:opacity-60"
              >
                {activation.isSharing ? 'Đang kích hoạt…' : 'Kích hoạt ngay'}
              </button>
            </>
          ) : (
            <>
              <div className="min-w-0 flex-1">
                <p className="m-0 font-semibold">{user?.name ?? 'Người dùng Zalo'}</p>
                <p className="m-0 mt-1 text-sm text-slate-500">
                  {getAuthStatusLabel({ isSignedIn: Boolean(user), isBootstrapping })}
                </p>
              </div>
            </>
          )}
          {/* In both states: a seller who withdrew only the phone still shares the name. */}
          {user && (
            <button
              type="button"
              onClick={openPermissionSettings}
              className="min-h-11 w-full rounded-full border-0 bg-marketplace-tint-soft font-semibold text-marketplace-blue"
            >
              Quản lý quyền
            </button>
          )}
        </section>

        {user && <PhoneNumberCard />}

        {showMediaLab && (
          <section className={`${cardClass} mt-3 p-4`}>
            <Button size="small" variant="tertiary" onClick={() => navigate('/media-lab')}>
              Media lab (dev)
            </Button>
          </section>
        )}
      </main>
    </Page>
  );
}

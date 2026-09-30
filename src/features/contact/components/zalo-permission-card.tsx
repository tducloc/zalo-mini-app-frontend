import { cardClass } from '@/components/layout/styles';
import { useSellerPermissionSettings } from '@/features/contact/hooks/use-seller-permissions';

function statusLabel(on: boolean) {
  return on ? 'Đã bật' : 'Chưa bật';
}

/** "Cá nhân": Zalo's screen is where the seller turns the name and the phone on or off. */
export default function ZaloPermissionCard() {
  const { permissions, openSettings } = useSellerPermissionSettings();

  if (!permissions) {
    return null;
  }

  return (
    <section className={`${cardClass} mt-3 p-4`} aria-labelledby="zalo-permissions-title">
      <h2 id="zalo-permissions-title" className="m-0 text-base font-semibold">
        Quyền Zalo
      </h2>
      <p className="m-0 mt-1 text-sm text-marketplace-muted">
        Tên và số điện thoại người mua thấy. Bật hoặc tắt từng quyền trong cài đặt của Zalo.
      </p>
      <ul className="m-0 mt-3 list-none p-0 text-sm">
        <li className="flex justify-between gap-3 py-1">
          <span>Tên và ảnh đại diện</span>
          <span className="text-marketplace-muted">{statusLabel(permissions.name)}</span>
        </li>
        <li className="flex justify-between gap-3 py-1">
          <span>Số điện thoại</span>
          <span className="text-marketplace-muted">{statusLabel(permissions.phone)}</span>
        </li>
      </ul>
      <button
        type="button"
        onClick={() => void openSettings()}
        className="mt-2.5 min-h-9 rounded-lg border-0 bg-marketplace-tint-soft px-3 text-sm font-semibold text-marketplace-blue"
      >
        Mở cài đặt quyền
      </button>
    </section>
  );
}

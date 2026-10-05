import { Icon } from 'zmp-ui';

import { useShareSellerPermissions } from '@/features/contact/hooks/use-seller-permissions';

/** On the sell page until the seller shares their Zalo name and phone number. */
export default function SellerPermissionNotice() {
  const { missing, share, isSharing } = useShareSellerPermissions();

  // Nothing while loading or failed: a notice that flashes away would only distract.
  if (!missing) {
    return null;
  }

  const title = `Bạn chưa chia sẻ ${missing}`;

  return (
    <aside
      aria-label={title}
      className="mb-5 flex gap-2.5 rounded-xl bg-amber-50 p-3 text-sm leading-5 text-amber-900"
    >
      <Icon icon="zi-warning-circle-solid" size={20} className="shrink-0 text-amber-500" />
      <div className="min-w-0 flex-1">
        <p className="m-0 font-semibold">{title}</p>
        <p className="m-0 mt-0.5">Người mua thấy tên bạn trên tin đăng và gọi cho bạn khi cần.</p>
        <button
          type="button"
          disabled={isSharing}
          onClick={share}
          className="mt-2.5 min-h-9 rounded-lg border-0 bg-amber-900 px-3 font-semibold text-white disabled:opacity-60"
        >
          {isSharing ? 'Đang chia sẻ…' : 'Chia sẻ'}
        </button>
      </div>
    </aside>
  );
}

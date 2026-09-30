import { Icon } from 'zmp-ui';

import { useMyPhoneNumber } from '@/features/contact/api/phone-number';
import { useSharePhone } from '@/features/contact/hooks/use-share-phone';

const NOTICE_TITLE = 'Bạn chưa chia sẻ số điện thoại';

/**
 * On the sell page until the seller shares a phone number: buyers can message them on
 * Zalo, but cannot call when that does not work.
 */
export default function SharePhoneNotice() {
  const phoneNumber = useMyPhoneNumber();
  const { share, isSharing } = useSharePhone();

  // Nothing while loading or failed: a notice that flashes away would only distract.
  if (phoneNumber.data !== null) {
    return null;
  }

  return (
    <aside
      aria-label={NOTICE_TITLE}
      className="mb-5 flex gap-2.5 rounded-xl bg-amber-50 p-3 text-sm leading-5 text-amber-900"
    >
      <Icon icon="zi-warning-circle-solid" size={20} className="shrink-0 text-amber-500" />
      <div className="min-w-0 flex-1">
        <p className="m-0 font-semibold">{NOTICE_TITLE}</p>
        <p className="m-0 mt-0.5">
          Người mua chỉ nhắn được cho bạn qua Zalo. Chia sẻ số để họ gọi được khi cần.
        </p>
        <button
          type="button"
          disabled={isSharing}
          onClick={share}
          className="mt-2.5 min-h-9 rounded-lg border-0 bg-amber-900 px-3 font-semibold text-white disabled:opacity-60"
        >
          {isSharing ? 'Đang chia sẻ…' : 'Chia sẻ số điện thoại'}
        </button>
      </div>
    </aside>
  );
}

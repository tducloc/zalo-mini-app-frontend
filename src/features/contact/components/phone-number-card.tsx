import { cardClass } from '@/components/layout/styles';
import { useMyPhoneNumber } from '@/features/contact/api/phone-number';
import { useSharePhone } from '@/features/contact/hooks/use-share-phone';
import { formatPhoneNumber } from '@/features/contact/utils/phone';

/** "Cá nhân": the number buyers call, verified by Zalo, or the way to share it. */
export default function PhoneNumberCard() {
  const phoneNumber = useMyPhoneNumber();
  const { share, isSharing } = useSharePhone();

  if (phoneNumber.data === undefined) {
    return null;
  }

  return (
    <section className={`${cardClass} mt-3 p-4`} aria-labelledby="phone-number-title">
      <h2 id="phone-number-title" className="m-0 text-base font-semibold">
        Số điện thoại liên hệ
      </h2>
      {phoneNumber.data ? (
        <p className="m-0 mt-1 text-sm text-marketplace-muted">
          {formatPhoneNumber(phoneNumber.data)} · Đã xác minh qua Zalo
        </p>
      ) : (
        <>
          <p className="m-0 mt-1 text-sm text-marketplace-muted">
            Người mua gọi cho bạn khi không nhắn được qua Zalo.
          </p>
          <button
            type="button"
            disabled={isSharing}
            onClick={share}
            className="mt-2.5 min-h-9 rounded-lg border-0 bg-marketplace-tint-soft px-3 text-sm font-semibold text-marketplace-blue disabled:opacity-60"
          >
            {isSharing ? 'Đang chia sẻ…' : 'Chia sẻ số điện thoại'}
          </button>
        </>
      )}
    </section>
  );
}

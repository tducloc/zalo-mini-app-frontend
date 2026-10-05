import { cardClass } from '@/components/layout/styles';
import { useMyPhoneNumber } from '@/features/contact/api/phone-number';
import { formatPhoneNumber } from '@/features/contact/utils/phone';

/** "Cá nhân": the number buyers call, verified by Zalo. The card above asks for it until then. */
export default function PhoneNumberCard() {
  const phoneNumber = useMyPhoneNumber();

  if (!phoneNumber.data) {
    return null;
  }

  return (
    <section className={`${cardClass} mt-3 p-4`} aria-labelledby="phone-number-title">
      <h2 id="phone-number-title" className="m-0 text-base font-semibold">
        Số điện thoại liên hệ
      </h2>
      <p className="m-0 mt-1 text-sm text-marketplace-muted">
        {formatPhoneNumber(phoneNumber.data)} · Đã xác minh qua Zalo
      </p>
    </section>
  );
}

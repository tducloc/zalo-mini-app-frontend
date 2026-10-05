import { PhoneShareRefusal, PhoneShareRefusedError } from '@/features/contact/services/zalo-phone';
import { getApiErrorStatus, HttpStatus } from '@/utils/api-error';

/** "0912345678" as it is read aloud, "0912 345 678"; any other shape as it is. */
export function formatPhoneNumber(phoneNumber: string) {
  return /^0\d{9}$/.test(phoneNumber)
    ? `${phoneNumber.slice(0, 4)} ${phoneNumber.slice(4, 7)} ${phoneNumber.slice(7)}`
    : phoneNumber;
}

/** Why sharing stopped, for a toast; `isRefusal` when the seller chose it, not a failure. */
export function phoneShareFailure(error: unknown): { message: string; isRefusal: boolean } {
  if (error instanceof PhoneShareRefusedError) {
    return error.refusal === PhoneShareRefusal.NotAllowed
      ? { message: 'Bạn chưa cho phép Zalo chia sẻ số điện thoại.', isRefusal: true }
      : { message: 'Vui lòng mở Mini App trong Zalo để chia sẻ số điện thoại.', isRefusal: false };
  }
  if (getApiErrorStatus(error) === HttpStatus.BadRequest) {
    return { message: 'Zalo chưa xác nhận số điện thoại. Vui lòng thử lại.', isRefusal: false };
  }
  return { message: 'Chưa chia sẻ được số điện thoại. Vui lòng thử lại sau.', isRefusal: false };
}

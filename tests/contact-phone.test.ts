import { AxiosError, AxiosHeaders } from 'axios';

import { PhoneShareRefusal, PhoneShareRefusedError } from '@/features/contact/services/zalo-phone';
import { formatPhoneNumber, phoneShareFailure } from '@/features/contact/utils/phone';

vi.mock('zmp-sdk', () => ({ getAccessToken: vi.fn(), getPhoneNumber: vi.fn() }));

const apiError = (status: number) =>
  new AxiosError('failed', undefined, undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: {},
  });

describe('formatPhoneNumber', () => {
  it('groups a Vietnamese mobile number as it is read, and leaves others as they are', () => {
    expect(formatPhoneNumber('0912345678')).toBe('0912 345 678');
    expect(formatPhoneNumber('+14155552671')).toBe('+14155552671');
  });
});

describe('phoneShareFailure', () => {
  it('tells a seller who closed the prompt that it was their choice, not a failure', () => {
    expect(phoneShareFailure(new PhoneShareRefusedError(PhoneShareRefusal.NotAllowed))).toEqual({
      message: 'Bạn chưa cho phép Zalo chia sẻ số điện thoại.',
      isRefusal: true,
    });
  });

  it('asks to open the app in Zalo, to retry a refused token, or to try later', () => {
    expect(
      phoneShareFailure(new PhoneShareRefusedError(PhoneShareRefusal.OutsideZalo)).message,
    ).toContain('mở Mini App trong Zalo');
    expect(phoneShareFailure(apiError(400)).message).toBe(
      'Zalo chưa xác nhận số điện thoại. Vui lòng thử lại.',
    );
    expect(phoneShareFailure(apiError(503))).toEqual({
      message: 'Chưa chia sẻ được số điện thoại. Vui lòng thử lại sau.',
      isRefusal: false,
    });
  });
});

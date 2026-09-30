import { getPhoneNumber } from 'zmp-sdk';

import { requestSdkToken } from '@/features/auth/api/session';
import { resolveExchangeToken } from '@/features/auth/utils/exchange-token';
import { warnInDev } from '@/utils/dev-log';

/** What `POST /me/phone-number` takes: the number's token and whose access token asked. */
export interface ZaloPhoneShare {
  phoneToken: string;
  zaloAccessToken: string;
}

export enum PhoneShareRefusal {
  /** The seller closed Zalo's permission prompt without allowing it. */
  NotAllowed = 'NOT_ALLOWED',
  /** A browser outside Zalo, without the dev token. */
  OutsideZalo = 'OUTSIDE_ZALO',
}

export class PhoneShareRefusedError extends Error {
  constructor(readonly refusal: PhoneShareRefusal) {
    super(refusal);
  }
}

/**
 * Asks Zalo for the seller's number: Zalo shows its permission prompt, and a token for the
 * server comes back. A dev build outside Zalo sends the dev token, which the server answers
 * with a fixed number.
 */
export async function requestPhoneShare(): Promise<ZaloPhoneShare> {
  const devToken = import.meta.env.DEV ? import.meta.env.VITE_DEV_ZALO_TOKEN : undefined;
  const zaloAccessToken = resolveExchangeToken(await requestSdkToken(), devToken);
  if (!zaloAccessToken) {
    throw new PhoneShareRefusedError(PhoneShareRefusal.OutsideZalo);
  }
  if (zaloAccessToken === devToken) {
    return { phoneToken: 'dev-browser', zaloAccessToken };
  }

  try {
    const { token } = await getPhoneNumber();
    if (!token) {
      throw new Error('getPhoneNumber gave no token');
    }
    return { phoneToken: token, zaloAccessToken };
  } catch (error) {
    warnInDev('contact', 'getPhoneNumber was refused', error);
    throw new PhoneShareRefusedError(PhoneShareRefusal.NotAllowed);
  }
}

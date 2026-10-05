import { useEffect, useRef } from 'react';

import { getSession, refreshSellerProfile } from '@/features/auth/api/session';
import { useSession } from '@/features/auth/hooks/use-session';
import { useMyPhoneNumber, useSharePhoneNumber } from '@/features/contact/api/phone-number';
import { requestPhoneShare } from '@/features/contact/services/zalo-phone';
import {
  askMissingSellerPermissions,
  hasAskedSellerPermissions,
  markSellerPermissionsAsked,
  readSellerPermissions,
  type SellerPermissions,
} from '@/features/contact/services/zalo-permissions';
import { warnInDev } from '@/utils/dev-log';

function skipsZaloPermissions() {
  return import.meta.env.DEV && Boolean(import.meta.env.VITE_DEV_ZALO_TOKEN);
}

function hasStoredPhone(phone: string | null | undefined) {
  return typeof phone === 'string';
}

/**
 * Exchange the phone token before refreshing the name. The token expires in two minutes.
 * The name refresh calls Zalo again without touching the sign-in error.
 */
async function saveGranted(
  granted: SellerPermissions,
  storedPhone: string | null | undefined,
  phoneSettled: boolean,
  sharePhone: () => Promise<unknown>,
) {
  if (granted.phone && phoneSettled && !hasStoredPhone(storedPhone)) {
    try {
      await sharePhone();
    } catch (error) {
      warnInDev('contact', 'saving the shared phone failed', error);
    }
  }
  if (granted.name && !getSession()?.user.name) {
    await refreshSellerProfile();
  }
}

/** The sell page asks once, for the name and the phone together, then stores what they allowed. */
export function SellerPermissionAsk() {
  const userId = useSession().session?.user.id ?? null;
  const phone = useMyPhoneNumber();
  const share = useSharePhoneNumber();
  const started = useRef(false);

  useEffect(() => {
    if (
      !userId ||
      skipsZaloPermissions() ||
      !phone.isFetched ||
      hasAskedSellerPermissions() ||
      started.current
    ) {
      return;
    }
    started.current = true;
    const storedPhone = phone.data;
    const phoneSettled = phone.isSuccess;
    void (async () => {
      const current = await readSellerPermissions();
      if (!current) {
        started.current = false;
        return;
      }
      const asked = await askMissingSellerPermissions(current);
      if (asked.outcome !== 'failed') {
        markSellerPermissionsAsked();
      }
      await saveGranted(asked.permissions, storedPhone, phoneSettled, async () =>
        share.mutateAsync(await requestPhoneShare()),
      );
    })();
  }, [userId, phone.isFetched, phone.data, share]);

  return null;
}

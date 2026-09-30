import { useEffect, useRef, useState } from 'react';

import { getSession, restoreSession } from '@/features/auth/api/session';
import { useSession } from '@/features/auth/hooks/use-session';
import { useMyPhoneNumber, useSharePhoneNumber } from '@/features/contact/api/phone-number';
import { requestPhoneShare } from '@/features/contact/services/zalo-phone';
import {
  askMissingSellerPermissions,
  hasAskedSellerPermissions,
  markSellerPermissionsAsked,
  openSellerPermissionSettings,
  readSellerPermissions,
  type SellerPermissions,
} from '@/features/contact/services/zalo-permissions';
import { warnInDev } from '@/utils/dev-log';

function skipsZaloPermissions() {
  return import.meta.env.DEV && Boolean(import.meta.env.VITE_DEV_ZALO_TOKEN);
}

/**
 * Exchange the phone token before refreshing the name. The token expires in two minutes,
 * and the name refresh is another sign-in.
 */
async function saveGranted(
  granted: SellerPermissions,
  hasPhone: boolean,
  sharePhone: () => Promise<unknown>,
) {
  if (granted.phone && !hasPhone) {
    try {
      await sharePhone();
    } catch (error) {
      warnInDev('contact', 'saving the shared phone failed', error);
    }
  }
  if (granted.name && !getSession()?.user.name) {
    await restoreSession().catch(() => undefined);
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
    const hasPhone = phone.data !== null;
    void (async () => {
      const current = await readSellerPermissions();
      if (!current) {
        started.current = false;
        return;
      }
      markSellerPermissionsAsked();
      const granted = await askMissingSellerPermissions(current);
      await saveGranted(granted, hasPhone, async () =>
        share.mutateAsync(await requestPhoneShare()),
      );
    })();
  }, [userId, phone.isFetched, phone.data, share]);

  return null;
}

/** Profile reads the toggles and opens Zalo's screen to change them. */
export function useSellerPermissionSettings() {
  const userId = useSession().session?.user.id ?? null;
  const phone = useMyPhoneNumber();
  const share = useSharePhoneNumber();
  const [permissions, setPermissions] = useState<SellerPermissions | null>(null);

  useEffect(() => {
    if (!userId || skipsZaloPermissions()) {
      return;
    }
    void readSellerPermissions().then(setPermissions);
  }, [userId]);

  const openSettings = async () => {
    try {
      await openSellerPermissionSettings();
    } catch (error) {
      warnInDev('contact', 'opening Zalo permission settings failed', error);
      return;
    }
    const current = await readSellerPermissions();
    setPermissions(current);
    if (!current) {
      return;
    }
    await saveGranted(current, phone.data !== null, async () =>
      share.mutateAsync(await requestPhoneShare()),
    );
  };

  return { permissions, openSettings };
}

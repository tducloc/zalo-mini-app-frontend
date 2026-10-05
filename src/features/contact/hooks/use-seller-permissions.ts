import { useEffect, useRef, useState } from 'react';

import { getSession, refreshSellerProfile } from '@/features/auth/api/session';
import { useSession } from '@/features/auth/hooks/use-session';
import { useMyPhoneNumber, useSharePhoneNumber } from '@/features/contact/api/phone-number';
import { requestPhoneShare } from '@/features/contact/services/zalo-phone';
import {
  askMissingSellerPermissions,
  hasAskedSellerPermissions,
  markSellerPermissionsAsked,
  readSellerPermissions,
  type PermissionAsk,
  type SellerPermissions,
} from '@/features/contact/services/zalo-permissions';
import { phoneShareFailure } from '@/features/contact/utils/phone';
import { useToast } from '@/hooks/use-toast';
import { warnInDev } from '@/utils/dev-log';

function skipsZaloPermissions() {
  return import.meta.env.DEV && Boolean(import.meta.env.VITE_DEV_ZALO_TOKEN);
}

/**
 * Exchange the phone token before refreshing the name. The token expires in two minutes.
 * The name refresh calls Zalo again without touching the sign-in error, and still runs
 * when the phone exchange fails, which then rethrows.
 */
async function saveGranted(
  granted: SellerPermissions,
  storedPhone: string | null | undefined,
  sharePhone: () => Promise<unknown>,
) {
  try {
    if (granted.phone && storedPhone === null) {
      await sharePhone();
    }
  } finally {
    if (granted.name && !getSession()?.user.name) {
      await refreshSellerProfile();
    }
  }
}

/**
 * One Zalo sheet for the name and phone still off, then stores what the seller allowed. The
 * phone is exchanged only when the server has none (null), not while it loads (undefined).
 * Null where the sheet does not exist: outside Zalo, and in a dev build with the dev token.
 */
async function askSellerPermissions(
  storedPhone: string | null | undefined,
  sharePhone: () => Promise<unknown>,
): Promise<PermissionAsk | null> {
  const current = skipsZaloPermissions() ? null : await readSellerPermissions();
  if (!current) {
    return null;
  }

  const asked = await askMissingSellerPermissions(current);
  if (asked.outcome !== 'failed') {
    markSellerPermissionsAsked();
  }

  await saveGranted(asked.permissions, storedPhone, sharePhone);
  return asked;
}

/** The sell page asks once, for the name and the phone together, then stores what they allowed. */
export function SellerPermissionAsk() {
  const userId = useSession().session?.user.id ?? null;
  const phone = useMyPhoneNumber();
  const share = useSharePhoneNumber();
  const started = useRef(false);

  useEffect(() => {
    if (!userId || !phone.isFetched || hasAskedSellerPermissions() || started.current) {
      return;
    }
    started.current = true;

    const sharePhone = async () => share.mutateAsync(await requestPhoneShare());
    askSellerPermissions(phone.data, sharePhone)
      .then((asked) => {
        if (!asked) {
          started.current = false;
        }
      })
      .catch((error) => warnInDev('contact', 'saving the shared phone failed', error));
  }, [userId, phone.isFetched, phone.data, share]);

  return null;
}

/** What buyers cannot see yet; null when they see both, or while the number loads. */
function describeMissing(name: string | null | undefined, phone: string | null | undefined) {
  if (phone === undefined || (name && phone)) {
    return null;
  }
  if (name) {
    return 'số điện thoại';
  }
  return phone ? 'tên Zalo' : 'tên và số điện thoại';
}

/** The sell page notice's and the profile card's button: the same ask, then a toast. */
export function useShareSellerPermissions() {
  const name = useSession().session?.user.name;
  const phone = useMyPhoneNumber();
  const savePhone = useSharePhoneNumber();
  const { showError, showInfo, showSuccess } = useToast();
  // Also while Zalo's sheet is open, before any request starts.
  const [isSharing, setSharing] = useState(false);

  const missing = describeMissing(name, phone.data);

  const share = async () => {
    setSharing(true);
    const sharePhone = async () => savePhone.mutateAsync(await requestPhoneShare());
    try {
      const asked = await askSellerPermissions(phone.data, sharePhone);
      if (asked?.outcome === 'refused') {
        showInfo(`Bạn chưa cho phép Zalo chia sẻ ${missing}.`);
        return;
      }
      if (asked?.outcome === 'failed') {
        showError(`Chưa chia sẻ được ${missing}. Vui lòng thử lại sau.`);
        return;
      }

      // Without the sheet, the phone share still works with the dev token, or says to open Zalo.
      if (!asked) {
        await sharePhone();
      }
      showSuccess('Đã chia sẻ. Người mua có thể liên hệ với bạn.');
    } catch (error) {
      warnInDev('contact', 'sharing the phone number failed', error);
      const failure = phoneShareFailure(error);
      (failure.isRefusal ? showInfo : showError)(failure.message);
    } finally {
      setSharing(false);
    }
  };

  return { missing, share, isSharing };
}

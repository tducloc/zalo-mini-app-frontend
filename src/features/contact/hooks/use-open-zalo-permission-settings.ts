import { useQueryClient } from '@tanstack/react-query';
import { EventName, events, openPermissionSetting } from 'zmp-sdk';

import { updateSessionUser } from '@/features/auth/api/session';
import { useSession } from '@/features/auth/hooks/use-session';
import {
  fetchMe,
  phoneNumberKey,
  withdrawPhoneNumber,
  withdrawProfile,
} from '@/features/contact/api/phone-number';
import { readSellerPermissions } from '@/features/contact/services/zalo-permissions';
import { warnInDev } from '@/utils/dev-log';

/**
 * "Quản lý quyền" opens Zalo's permission screen. When the app comes back, a permission now off
 * there drops what it shared on the server (Zalo sends a webhook only for "remove information
 * sharing", not for one switch), then the card reads `GET /me` again. Not a new sign-in: that
 * asks Zalo for the name and could bring back a name the user just withdrew.
 *
 * In zmp-sdk 2.53 `openPermissionSetting` resolves right after it asks Zalo to open the screen,
 * so the listener goes on before the call. It is `once` because zmp-sdk wraps each listener,
 * so `events.off` cannot remove it.
 */
export function useOpenZaloPermissionSettings() {
  const queryClient = useQueryClient();
  const userId = useSession().session?.user.id ?? null;

  const reload = async () => {
    // Null outside Zalo, where there is no permission to read.
    const permissions = await readSellerPermissions();
    if (permissions && !permissions.phone) await withdrawPhoneNumber();
    if (permissions && !permissions.name) await withdrawProfile();

    const { name, avatarUrl, phoneNumber } = await fetchMe();
    updateSessionUser({ name, avatarUrl });
    queryClient.setQueryData(phoneNumberKey(userId), phoneNumber);
  };

  return () => {
    events.once(EventName.AppResumed, () => {
      reload().catch((error) => warnInDev('contact', 'reloading the profile failed', error));
    });
    openPermissionSetting().catch((error) =>
      warnInDev('contact', 'opening Zalo permission settings failed', error),
    );
  };
}

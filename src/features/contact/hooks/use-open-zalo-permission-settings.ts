import { useQueryClient } from '@tanstack/react-query';
import { EventName, events, openPermissionSetting } from 'zmp-sdk';

import { updateSessionUser } from '@/features/auth/api/session';
import { useSession } from '@/features/auth/hooks/use-session';
import { fetchMe, phoneNumberKey } from '@/features/contact/api/phone-number';
import { warnInDev } from '@/utils/dev-log';

/**
 * "Quản lý quyền" opens Zalo's permission screen. A withdrawal there reaches the server through
 * Zalo's webhook, so when the app comes back the card reads `GET /me` again. Not a new sign-in:
 * that asks Zalo for the name and could bring back a name the user just withdrew.
 *
 * In zmp-sdk 2.53 `openPermissionSetting` resolves right after it asks Zalo to open the screen,
 * so the listener goes on before the call. It is `once` because zmp-sdk wraps each listener,
 * so `events.off` cannot remove it.
 */
export function useOpenZaloPermissionSettings() {
  const queryClient = useQueryClient();
  const userId = useSession().session?.user.id ?? null;

  const reload = async () => {
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

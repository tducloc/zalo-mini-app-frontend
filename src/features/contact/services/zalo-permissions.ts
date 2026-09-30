import { authorize, getSetting, openPermissionSetting } from 'zmp-sdk';

/** What a seller can share with buyers. Zalo's sheet lets them turn each one on or off. */
export const SELLER_SCOPES = ['scope.userInfo', 'scope.userPhonenumber'] as const;

export type SellerPermissions = {
  /** Name and avatar on the listing. */
  name: boolean;
  /** The number buyers call. */
  phone: boolean;
};

const ASKED_KEY = 'zalo-seller-permissions-asked';

/** True after the sell page has already shown Zalo's sheet, including when the seller closed it. */
export function hasAskedSellerPermissions() {
  try {
    return localStorage.getItem(ASKED_KEY) === '1';
  } catch {
    return false;
  }
}

/** Record the ask before the sheet returns, so closing the app does not ask again. */
export function markSellerPermissionsAsked() {
  try {
    localStorage.setItem(ASKED_KEY, '1');
  } catch {
    // Private mode still gets the sheet this once.
  }
}

/** What Zalo currently allows. Null outside Zalo, where these calls do not exist. */
export async function readSellerPermissions(): Promise<SellerPermissions | null> {
  try {
    const { authSetting } = await getSetting();
    return {
      name: authSetting['scope.userInfo'] === true,
      phone: authSetting['scope.userPhonenumber'] === true,
    };
  } catch {
    return null;
  }
}

/**
 * One Zalo sheet for the scopes still off. Scopes already on are left out, as Zalo's guide
 * says to ask only for what is missing. A refusal keeps the earlier reading.
 */
export async function askMissingSellerPermissions(
  current: SellerPermissions,
): Promise<SellerPermissions> {
  const missing = SELLER_SCOPES.filter((scope) =>
    scope === 'scope.userInfo' ? !current.name : !current.phone,
  );
  if (missing.length === 0) {
    return current;
  }

  try {
    const granted = await authorize({ scopes: [...missing] });
    return {
      name: missing.includes('scope.userInfo') ? granted['scope.userInfo'] === true : current.name,
      phone: missing.includes('scope.userPhonenumber')
        ? granted['scope.userPhonenumber'] === true
        : current.phone,
    };
  } catch {
    return current;
  }
}

/** Zalo's own screen, where the seller turns each permission on or off later. */
export function openSellerPermissionSettings() {
  return openPermissionSetting();
}

import { authorize, getSetting, nativeStorage } from 'zmp-sdk';

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
    // Zalo's WebView has no localStorage. nativeStorage is Zalo's store, and falls back to
    // localStorage only in the browser dev tools.
    return nativeStorage.getItem(ASKED_KEY) === '1';
  } catch {
    return false;
  }
}

/** Record the ask before the sheet returns, so closing the app does not ask again. */
export function markSellerPermissionsAsked() {
  try {
    nativeStorage.setItem(ASKED_KEY, '1');
  } catch {
    // Outside Zalo the sheet cannot open anyway.
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

export type PermissionAsk = {
  /** `failed` is a Zalo error, not a choice, so the sell page may ask again. */
  outcome: 'ready' | 'answered' | 'refused' | 'failed';
  permissions: SellerPermissions;
};

const REFUSED_CODE = -201;

function isRefusal(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === REFUSED_CODE
  );
}

/**
 * One Zalo sheet for the scopes still off. Scopes already on are left out, as Zalo's guide
 * says to ask only for what is missing. A refusal keeps the earlier reading.
 */
export async function askMissingSellerPermissions(
  current: SellerPermissions,
): Promise<PermissionAsk> {
  const missing = SELLER_SCOPES.filter((scope) =>
    scope === 'scope.userInfo' ? !current.name : !current.phone,
  );
  if (missing.length === 0) {
    return { outcome: 'ready', permissions: current };
  }

  try {
    const granted = await authorize({ scopes: [...missing] });
    return {
      outcome: 'answered',
      permissions: {
        name: missing.includes('scope.userInfo')
          ? granted['scope.userInfo'] === true
          : current.name,
        phone: missing.includes('scope.userPhonenumber')
          ? granted['scope.userPhonenumber'] === true
          : current.phone,
      },
    };
  } catch (error) {
    return {
      outcome: isRefusal(error) ? 'refused' : 'failed',
      permissions: current,
    };
  }
}

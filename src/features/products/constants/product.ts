export const productConditions = ['NEW', 'LIKE_NEW', 'USED'] as const;

export const conditionLabels: Record<(typeof productConditions)[number], string> = {
  NEW: 'Mới',
  LIKE_NEW: 'Như mới',
  USED: 'Đã dùng',
};

/**
 * The highest price in whole đồng (api-spec, Conventions): past it a number cannot hold
 * every đồng. Not a business limit; only a typo with 16 digits reaches it.
 */
export const MAX_PRICE_VND = Number.MAX_SAFE_INTEGER;

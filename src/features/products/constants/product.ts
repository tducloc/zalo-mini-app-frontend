export const productConditions = ['NEW', 'LIKE_NEW', 'USED'] as const;

export const conditionLabels: Record<(typeof productConditions)[number], string> = {
  NEW: 'Mới',
  LIKE_NEW: 'Như mới',
  USED: 'Đã dùng',
};

/** The highest price: the server keeps prices in a 32-bit integer column. */
export const MAX_PRICE_VND = 2_147_483_647;

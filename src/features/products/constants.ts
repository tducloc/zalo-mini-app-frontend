export const productConditions = ['NEW', 'LIKE_NEW', 'USED'] as const;

export const conditionLabels: Record<(typeof productConditions)[number], string> = {
  NEW: 'Mới',
  LIKE_NEW: 'Như mới',
  USED: 'Đã dùng',
};

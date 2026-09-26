const numberFormatter = new Intl.NumberFormat('vi-VN');

/** Groups thousands the Vietnamese way: 1000000 → "1.000.000". */
export function formatNumber(value: number) {
  return numberFormatter.format(value);
}

export function formatVnd(value: number) {
  return `${formatNumber(value)} đ`;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const RELATIVE_DAYS_LIMIT = 7;

/**
 * Compact relative time for listing cards ("2 ngày", "20/9"), leaving the narrow meta
 * line room for the place name.
 */
export function formatShortRelativeTime(isoDate: string, now = Date.now()) {
  // A publication time slightly in the future (clock skew) reads as just now.
  const elapsed = Math.max(0, now - new Date(isoDate).getTime());

  if (elapsed < MINUTE_MS) {
    return 'Vừa xong';
  }

  if (elapsed < HOUR_MS) {
    return `${Math.floor(elapsed / MINUTE_MS)} phút`;
  }

  if (elapsed < DAY_MS) {
    return `${Math.floor(elapsed / HOUR_MS)} giờ`;
  }

  if (elapsed < RELATIVE_DAYS_LIMIT * DAY_MS) {
    return `${Math.floor(elapsed / DAY_MS)} ngày`;
  }

  return new Date(isoDate).toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' });
}

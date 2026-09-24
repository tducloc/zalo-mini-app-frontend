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

type RelativeTime =
  | { kind: 'justNow' }
  | { kind: 'ago'; count: number; unit: 'phút' | 'giờ' | 'ngày' }
  | { kind: 'date'; date: Date };

function toRelativeTime(isoDate: string, now: number): RelativeTime {
  const elapsed = Math.max(0, now - new Date(isoDate).getTime());

  if (elapsed < MINUTE_MS) {
    return { kind: 'justNow' };
  }

  if (elapsed < HOUR_MS) {
    return { kind: 'ago', count: Math.floor(elapsed / MINUTE_MS), unit: 'phút' };
  }

  if (elapsed < DAY_MS) {
    return { kind: 'ago', count: Math.floor(elapsed / HOUR_MS), unit: 'giờ' };
  }

  if (elapsed < RELATIVE_DAYS_LIMIT * DAY_MS) {
    return { kind: 'ago', count: Math.floor(elapsed / DAY_MS), unit: 'ngày' };
  }

  return { kind: 'date', date: new Date(isoDate) };
}

/** Vietnamese relative time ("2 ngày trước"); older dates show dd/mm/yyyy. */
export function formatRelativeTime(isoDate: string, now = Date.now()) {
  const time = toRelativeTime(isoDate, now);

  if (time.kind === 'justNow') {
    return 'Vừa xong';
  }

  if (time.kind === 'ago') {
    return `${time.count} ${time.unit} trước`;
  }

  return time.date.toLocaleDateString('vi-VN');
}

/**
 * Compact form for listing cards ("2 ngày", "20/9"), leaving the narrow meta
 * line room for the place name.
 */
export function formatShortRelativeTime(isoDate: string, now = Date.now()) {
  const time = toRelativeTime(isoDate, now);

  if (time.kind === 'justNow') {
    return 'Vừa xong';
  }

  if (time.kind === 'ago') {
    return `${time.count} ${time.unit}`;
  }

  return time.date.toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' });
}
